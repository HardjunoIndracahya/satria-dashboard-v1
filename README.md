# RAKSA — Basecamp & SAR Telemetry Dashboard

Precision outdoor GIS dashboard for mountain Basecamp / SAR teams tracking hikers carrying ESP32 + LoRa SX1278 (433 MHz) + GPS devices. Telemetry streams directly from Firebase Realtime Database (RTDB). **No demo data is bundled.**

## Run

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

## Stack

Vite · React · TypeScript · Tailwind CSS · MapLibre GL + `react-map-gl/maplibre` · Firebase modular SDK · Zustand (`persist`) · Recharts · Sonner.

## Firebase connection

The dashboard connects using either:

* **Build-time environment variables** for Vercel/Netlify: `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. All four are required for automatic connection on boot.
* **Runtime configuration** from the top-bar connection modal. Paste a Realtime Database URL or Firebase Web App config JSON and set the database root path (default `/`). The selected config is persisted in browser localStorage and can be changed without redeploying.

Runtime config takes precedence over environment config. Disconnect disables the active connection, including environment auto-connect, until a project is connected again.

The browser listens to Firebase's `.info/connected` sentinel for connection state and streams `child_added` and `child_changed` events from `<root>/hikers`. Each hiker record is updated by the Basecamp with HTTP PUT:

```json
{
  "id": "RAKSA_01",
  "lat": -7.482529,
  "lon": 110.214327,
  "mdpl": 370.8,
  "suhu": 26.4,
  "status": "SOS",
  "rssi": -108,
  "snr": 6.5,
  "battery": 84,
  "timestamp": 1764241200000
}
```

Raw pipe-delimited LoRa strings are also accepted, e.g. `RAKSA_01|-7.482529|110.214327|370.8|26.4|SOS|-108|6.5`. Timestamps should be Unix epoch milliseconds; packets without one use local receive time. Invalid packets are quarantined in System Log. Export CSV and per-hiker GPX remain available for local archiving.

Configure RTDB Security Rules for your deployment. Do not allow unauthenticated writes. Public read rules expose live hiker locations; for private deployments, add an authenticated dashboard flow before restricting read access.

## Layout

```
src/
  lib/parser.ts        RTDB structured-packet and raw LoRa payload validation
  lib/firebase.ts      Firebase app lifecycle and database configuration
  lib/firebaseStream.ts RTDB WebSocket listeners and packet delivery
  lib/geo.ts           geodesic calculations and formatting
  lib/audio.ts         Web Audio two-tone SAR siren
  lib/export.ts        local GPX / CSV exporters
  store/               persisted operator config and in-memory telemetry
  hooks/               RTDB stream, hotkeys, alarm, derived hikers
  components/          map, telemetry, connection modal and setup guide
  views/               dashboard, relay nodes, system log
```

## Shortcuts

`/` search · `3` 2D/3D terrain · `M` mute siren · `Esc` close / deselect
