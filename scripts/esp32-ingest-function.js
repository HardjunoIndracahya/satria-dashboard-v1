/**
 * ============================================================================
 *  RAKSA — OPTIONAL CLOUD FUNCTION / CLOUD RUN SECURE ESP32 INGESTION ENDPOINT
 * ============================================================================
 *
 *  Option A (default in firmware/esp32_basecamp_receiver/esp32_basecamp_receiver.ino):
 *    The ESP32 signs in as a dedicated least-privilege `BASECAMP_DEVICE` account
 *    via Firebase Auth Email/Password (registered via `admin-provision.mjs register-basecamp`).
 *
 *  Option B (this file — Firebase Cloud Functions v2 HTTPS endpoint):
 *    Deploy this endpoint if you prefer the ESP32 to send LoRa telemetry to a
 *    trusted backend over HTTPS using a shared device API secret (`BASECAMP_INGEST_KEY`)
 *    stored in Firebase Secret Manager, so the backend writes to RTDB with Admin SDK
 *    while public RTDB access stays completely closed.
 *
 *  Deployment sketch (inside a Firebase Functions project):
 *    firebase functions:secrets:set BASECAMP_INGEST_KEY
 *    firebase deploy --only functions:ingestBasecampPacket
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import crypto from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';

initializeApp();
const BASECAMP_INGEST_KEY = defineSecret('BASECAMP_INGEST_KEY');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export const ingestBasecampPacket = onRequest({ secrets: [BASECAMP_INGEST_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = req.get('x-basecamp-key') || req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!safeEqual(token, BASECAMP_INGEST_KEY.value())) {
    res.status(401).json({ error: 'Unauthorized device credentials' });
    return;
  }

  const body = req.body ?? {};
  const deviceId = String(body.device_id || '').trim();
  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  const alt = Number(body.altitude ?? 0);
  const temp = Number(body.temperature ?? 0);
  const status = String(body.status || 'NORMAL').trim().toUpperCase();
  const rssi = body.rssi !== undefined ? Number(body.rssi) : null;
  const snr = body.snr !== undefined ? Number(body.snr) : null;

  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,31}$/.test(deviceId) || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) {
    res.status(400).json({ error: 'Invalid device_id or GPS coordinates' });
    return;
  }

  const db = getDatabase();

  // 1. Always update `/pendaki/{deviceId}`
  await db.ref(`pendaki/${deviceId}`).set({
    device_id: deviceId,
    latitude: lat,
    longitude: lon,
    altitude: alt,
    temperature: temp,
    status: status === 'SOS' ? 'SOS' : 'NORMAL',
    rssi,
    snr,
    updated_at: ServerValue.TIMESTAMP,
  });

  // 2. Latch persistent SOS ONLY on SOS (NEVER clear on NORMAL)
  if (status === 'SOS') {
    const activeRef = db.ref(`sos_active/${deviceId}`);
    await activeRef.transaction((current) => {
      if (current && current.state !== 'RESOLVED') {
        return {
          ...current,
          last_sos_at: ServerValue.TIMESTAMP,
          latitude: lat,
          longitude: lon,
          altitude: alt,
          temperature: temp,
          rssi,
          snr,
        };
      }
      return {
        device_id: deviceId,
        incident_id: `INC-${deviceId}-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        state: 'ACTIVE',
        triggered_at: ServerValue.TIMESTAMP,
        last_sos_at: ServerValue.TIMESTAMP,
        latitude: lat,
        longitude: lon,
        altitude: alt,
        temperature: temp,
        rssi,
        snr,
        acknowledged_at: null,
        acknowledged_by: null,
        acknowledged_by_uid: null,
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
      };
    });
  }

  res.status(200).json({ ok: true, device_id: deviceId });
});
