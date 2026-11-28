import { ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { getActiveDatabase, normalizeDatabaseRoot, SOS_ACTIVE_ROOT, SOS_HISTORY_ROOT } from './firebase';
import { useTelemetry } from '../store/telemetry';
import { useSos } from '../store/sos';
import type { OperatorUser, Packet, SosHistoryIncident, SosIncident } from '../types';

function numOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeKey(id: string): string {
  return id.replace(/[.#$[\]/]/g, '_');
}

export function generateIncidentId(deviceId: string, ts = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INC-${sanitizeKey(deviceId)}-${ts}-${rand}`;
}

/** Parses `sos_active/` snapshot into a normalized map keyed by device_id. */
export function parseSosActiveMap(raw: unknown): Record<string, SosIncident> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, SosIncident> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const r = val as Record<string, unknown>;
    const rawState = String(r.state ?? 'ACTIVE').toUpperCase();
    // Ignore anything already marked RESOLVED if left behind accidentally
    if (rawState === 'RESOLVED') continue;
    const state: 'ACTIVE' | 'ACKNOWLEDGED' = rawState === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'ACTIVE';
    const device_id = strOrNull(r.device_id) ?? key;
    const triggered_at = numOrNull(r.triggered_at) ?? numOrNull(r.last_sos_at) ?? Date.now();
    const last_sos_at = numOrNull(r.last_sos_at) ?? triggered_at;
    const incident_id = strOrNull(r.incident_id) ?? `INC-${sanitizeKey(device_id)}-${triggered_at}`;

    result[device_id] = {
      device_id,
      incident_id,
      state,
      triggered_at,
      last_sos_at,
      latitude: numOrNull(r.latitude ?? r.lat),
      longitude: numOrNull(r.longitude ?? r.lon ?? r.lng),
      altitude: numOrNull(r.altitude ?? r.alt ?? r.mdpl),
      temperature: numOrNull(r.temperature ?? r.temp ?? r.suhu),
      rssi: numOrNull(r.rssi),
      snr: numOrNull(r.snr),
      acknowledged_at: numOrNull(r.acknowledged_at),
      acknowledged_by: strOrNull(r.acknowledged_by),
      acknowledged_by_uid: strOrNull(r.acknowledged_by_uid),
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
    };
  }
  return result;
}

/** Parses `sos_history/` snapshot (`sos_history/{deviceId}/{incidentId}`) into a sorted array. */
export function parseSosHistoryList(raw: unknown): SosHistoryIncident[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const items: SosHistoryIncident[] = [];
  for (const [deviceKey, deviceNode] of Object.entries(raw as Record<string, unknown>)) {
    if (!deviceNode || typeof deviceNode !== 'object' || Array.isArray(deviceNode)) continue;
    for (const [incKey, val] of Object.entries(deviceNode as Record<string, unknown>)) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const r = val as Record<string, unknown>;
      const device_id = strOrNull(r.device_id) ?? deviceKey;
      const incident_id = strOrNull(r.incident_id) ?? incKey;
      const triggered_at = numOrNull(r.triggered_at) ?? 0;
      const resolved_at = numOrNull(r.resolved_at) ?? triggered_at;
      items.push({
        device_id,
        incident_id,
        state: 'RESOLVED',
        triggered_at,
        last_sos_at: numOrNull(r.last_sos_at),
        latitude: numOrNull(r.latitude ?? r.lat),
        longitude: numOrNull(r.longitude ?? r.lon ?? r.lng),
        altitude: numOrNull(r.altitude ?? r.alt ?? r.mdpl),
        temperature: numOrNull(r.temperature ?? r.temp ?? r.suhu),
        rssi: numOrNull(r.rssi),
        snr: numOrNull(r.snr),
        acknowledged_at: numOrNull(r.acknowledged_at),
        acknowledged_by: strOrNull(r.acknowledged_by),
        acknowledged_by_uid: strOrNull(r.acknowledged_by_uid),
        resolved_at,
        resolved_by: strOrNull(r.resolved_by) ?? 'Basecamp Operator',
        resolved_by_uid: strOrNull(r.resolved_by_uid),
        resolution_note: strOrNull(r.resolution_note),
      });
    }
  }
  items.sort((a, b) => b.resolved_at - a.resolved_at);
  return items;
}

function formatWriteError(error: unknown, actionLabel: string): Error {
  const err = error as { code?: string; message?: string };
  if (err?.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(err?.message ?? '')) {
    return new Error(
      `Permission denied while trying to ${actionLabel}. Verify your operator account is authorized under /operators/<uid> in Firebase Realtime Database rules.`,
    );
  }
  return new Error(err?.message || `Failed to ${actionLabel}. Check Firebase connection.`);
}

function assertWritable(operator: OperatorUser | null): ReturnType<typeof getActiveDatabase> {
  if (!operator) {
    throw new Error('Operator sign-in is required to perform emergency actions.');
  }
  if (useTelemetry.getState().connectionState !== 'connected') {
    throw new Error('Firebase is currently disconnected. Cannot synchronize changes — the emergency alert remains active.');
  }
  const db = getActiveDatabase();
  if (!db) {
    throw new Error('Firebase database is not initialized. Check firebase-config.js.');
  }
  return db;
}

/**
 * Marks an active SOS incident as ACKNOWLEDGED in Firebase.
 * Does NOT remove or resolve the emergency warning.
 */
export async function acknowledgeSosIncident(incident: SosIncident, operator: OperatorUser | null): Promise<void> {
  const db = assertWritable(operator)!;
  const activeRoot = normalizeDatabaseRoot(SOS_ACTIVE_ROOT);
  const sosStore = useSos.getState();
  sosStore.setPending(incident.device_id, 'ack');

  try {
    const targetRef = ref(db, `${activeRoot}/${sanitizeKey(incident.device_id)}`);
    await update(targetRef, {
      state: 'ACKNOWLEDGED',
      acknowledged_at: serverTimestamp(),
      acknowledged_by: operator!.displayName ? `${operator!.displayName} (${operator!.email})` : operator!.email,
      acknowledged_by_uid: operator!.uid,
    });
  } catch (error) {
    throw formatWriteError(error, 'acknowledge SOS incident');
  } finally {
    useSos.getState().setPending(incident.device_id, null);
  }
}

/**
 * Atomically resolves an SOS incident: archives it in `sos_history/{device_id}/{incident_id}`
 * AND removes it from `sos_active/{device_id}` in a single Firebase multi-path update.
 * If the write fails (offline / permission denied), `sos_active` remains untouched.
 */
export async function resolveSosIncident(
  incident: SosIncident,
  operator: OperatorUser | null,
  resolutionNote: string,
  latestPacket?: Packet,
): Promise<void> {
  const db = assertWritable(operator)!;
  const activeRoot = normalizeDatabaseRoot(SOS_ACTIVE_ROOT);
  const historyRoot = normalizeDatabaseRoot(SOS_HISTORY_ROOT);
  const deviceKey = sanitizeKey(incident.device_id);
  const incidentKey = sanitizeKey(incident.incident_id);

  const sosStore = useSos.getState();
  sosStore.setPending(incident.device_id, 'resolve');

  const resolvedBy = operator!.displayName ? `${operator!.displayName} (${operator!.email})` : operator!.email;
  const note = resolutionNote.trim() || null;

  const archivedRecord = {
    device_id: incident.device_id,
    incident_id: incident.incident_id,
    state: 'RESOLVED',
    triggered_at: incident.triggered_at,
    last_sos_at: incident.last_sos_at,
    latitude: latestPacket?.lat ?? incident.latitude,
    longitude: latestPacket?.lon ?? incident.longitude,
    altitude: latestPacket?.alt ?? incident.altitude,
    temperature: latestPacket?.temp ?? incident.temperature,
    rssi: latestPacket?.rssi ?? incident.rssi ?? null,
    snr: latestPacket?.snr ?? incident.snr ?? null,
    acknowledged_at: incident.acknowledged_at,
    acknowledged_by: incident.acknowledged_by,
    acknowledged_by_uid: incident.acknowledged_by_uid ?? null,
    resolved_at: serverTimestamp(),
    resolved_by: resolvedBy,
    resolved_by_uid: operator!.uid,
    resolution_note: note,
  };

  try {
    await update(ref(db), {
      [`${historyRoot}/${deviceKey}/${incidentKey}`]: archivedRecord,
      [`${activeRoot}/${deviceKey}`]: null,
    });
  } catch (error) {
    throw formatWriteError(error, 'mark hiker as rescued');
  } finally {
    useSos.getState().setPending(incident.device_id, null);
  }
}

/**
 * Safely ensures a persistent `sos_active/{device_id}` incident exists when an SOS packet
 * arrives in `pendaki/` (e.g. if tested directly via Firebase Console or legacy firmware).
 *
 * - Uses `runTransaction` so it NEVER overwrites `triggered_at`, `incident_id`, `state`,
 *   or `acknowledged_*` of an existing incident, and NEVER creates duplicates.
 * - NEVER clears or resolves an incident when `status === 'NORMAL'`.
 * - Ignores stale SOS packets whose timestamp is older than or equal to the last resolved incident.
 * - Fails silently on PERMISSION_DENIED (when a read-only viewer is connected).
 */
export async function ensureSosLatchedFromPacket(packet: Packet, lastResolvedAt: number): Promise<void> {
  if (packet.status !== 'SOS') return;
  if (packet.tsSource === 'firebase' && lastResolvedAt > 0 && packet.ts <= lastResolvedAt) return;
  const db = getActiveDatabase();
  if (!db) return;

  const activeRoot = normalizeDatabaseRoot(SOS_ACTIVE_ROOT);
  const deviceKey = sanitizeKey(packet.id);
  const targetRef = ref(db, `${activeRoot}/${deviceKey}`);

  try {
    await runTransaction(targetRef, (current: Record<string, unknown> | null) => {
      if (current && typeof current === 'object' && String(current.state ?? '').toUpperCase() !== 'RESOLVED') {
        // Already active or acknowledged — update only latest telemetry & last_sos_at
        return {
          ...current,
          last_sos_at: serverTimestamp(),
          latitude: packet.lat,
          longitude: packet.lon,
          altitude: packet.alt,
          temperature: packet.temp,
          rssi: packet.rssi ?? current.rssi ?? null,
          snr: packet.snr ?? current.snr ?? null,
        };
      }
      // No unresolved incident exists — create a fresh ACTIVE incident
      return {
        device_id: packet.id,
        incident_id: generateIncidentId(packet.id),
        state: 'ACTIVE',
        triggered_at: serverTimestamp(),
        last_sos_at: serverTimestamp(),
        latitude: packet.lat,
        longitude: packet.lon,
        altitude: packet.alt,
        temperature: packet.temp,
        rssi: packet.rssi ?? null,
        snr: packet.snr ?? null,
        acknowledged_at: null,
        acknowledged_by: null,
        acknowledged_by_uid: null,
        resolved_at: null,
        resolved_by: null,
        resolved_by_uid: null,
        resolution_note: null,
      };
    });
  } catch {
    // Non-fatal: ESP32 receiver creates `sos_active` directly; read-only viewers cannot write.
  }
}
