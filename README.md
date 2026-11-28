# RAKSA — Basecamp & SAR Telemetry Dashboard

Precision outdoor GIS dashboard for mountain Basecamp / SAR teams tracking hikers carrying ESP32 + LoRa SX1278 (433 MHz) + GPS devices. Telemetry and persistent SOS emergencies stream directly from Firebase Realtime Database (RTDB). **No demo data is bundled.**

## Quick Start

```bash
npm install
npm run dev      # On Windows PowerShell if scripts are blocked: npm.cmd run dev
npm run build
npm run typecheck
```

## Firebase Configuration (`firebase-config.js`)

The dashboard connects automatically on load using [`firebase-config.js`](firebase-config.js). There is no manual Connect button.

1. Open Firebase Console → **Project settings → General → Your apps** (Web app) and copy `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId` into `firebase-config.js`.
2. In Firebase Console → **Authentication → Sign-in method**, enable **Email/Password** and create:
   - At least one **Basecamp Operator** account (used to sign in on the dashboard to Acknowledge & Mark as Rescued).
   - One dedicated **Basecamp Receiver** account (used by the ESP32 firmware).
3. In Firebase Console → **Realtime Database → Data**, register the authorized UIDs:
   ```json
   {
     "operators": {
       "<OPERATOR_UID>": true
     },
     "basecamp_devices": {
       "<BASECAMP_RECEIVER_UID>": true
     }
   }
   ```
4. Deploy the security rules from [`database.rules.json`](database.rules.json) in Firebase Console → **Realtime Database → Rules**.

> **Security note:** Never expose Firebase service-account keys in frontend code, and do not leave `.write: true` publicly open in production. Only authenticated UIDs listed under `/operators` can acknowledge or resolve SOS incidents, and `/sos_history` is append-only.

## Firebase Database Structure

- `pendaki/{device_id}` — latest live hiker telemetry (`device_id`, `latitude`, `longitude`, `altitude`, `temperature`, `status`, `rssi`, `snr`, `updated_at`).
- `sos_active/{device_id}` — persistent unresolved SOS incidents (`ACTIVE` or `ACKNOWLEDGED`). Never automatically cleared when `pendaki/{device_id}/status` changes back to `NORMAL`.
- `sos_history/{device_id}/{incident_id}` — permanently archived `RESOLVED` incidents with `resolved_at`, `resolved_by`, `resolved_by_uid`, and `resolution_note`.

## ESP32 Basecamp Receiver Firmware

See [`firmware/esp32_basecamp_receiver/esp32_basecamp_receiver.ino`](firmware/esp32_basecamp_receiver/esp32_basecamp_receiver.ino):
- Receives LoRa packets (`RAKSA_01|-7.559294|110.255239|347.7|22.3|SOS`) non-blocking on Core 1 and pushes them into a FreeRTOS queue.
- Worker task on Core 0 updates `/pendaki/{device_id}` and manages `/sos_active/{device_id}`:
  - First SOS → checks Firebase `/sos_active/{device_id}` and creates a new `ACTIVE` incident with a unique `incident_id` and server timestamps.
  - Repeated SOS → `PATCH`es only coordinates, telemetry, and `last_sos_at` while preserving `incident_id`, `state`, `triggered_at`, and `acknowledged_*`.
  - Return to `NORMAL` → updates `/pendaki/{device_id}` only; never deletes or resolves `/sos_active/{device_id}`.

## Testing the Complete SOS Lifecycle

1. **Test 1 (Trigger SOS):** Send `RAKSA_01|-7.559294|110.255239|347.7|22.3|SOS` from the transmitter (or set `pendaki/RAKSA_01/status = "SOS"` / create `sos_active/RAKSA_01`). Verify the red pulsing banner, siren, red map marker, and **Emergencies** tab counter appear.
2. **Test 2 (Button Released → NORMAL):** Send `RAKSA_01|-7.559294|110.255239|347.7|22.3|NORMAL`. Verify telemetry displays `NORMAL` while the persistent SOS incident remains `ACTIVE SOS`.
3. **Test 3 (Acknowledge):** Sign in via the top-right **Operator** button, then click **ACKNOWLEDGE**. Verify the state changes to `ACKNOWLEDGED` with operator identity & server timestamp across all open tabs, while remaining visible in Active Emergency Alerts.
4. **Test 4 (Mark as Rescued):** Click **MARK AS RESCUED**, enter a resolution note, check the explicit confirmation box, and confirm. Verify the alert disappears from `sos_active` and appears permanently under **Emergency History** (`sos_history`).
5. **Test 5 (Page Refresh & Offline Resilience):** Trigger a new SOS, refresh the browser, and verify the exact same `incident_id` and elapsed time reload from Firebase.
6. **Test 6 (Subsequent SOS):** After resolving an incident, trigger SOS again from `RAKSA_01`. Verify a new unique `incident_id` is created without overwriting the previous entry in `sos_history`.

## Shortcuts

`/` search · `3` 2D/3D terrain · `M` mute siren (does not resolve SOS) · `Esc` close / deselect
