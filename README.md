# RAKSA — Basecamp & SAR Telemetry Dashboard

Precision outdoor GIS dashboard for mountain Basecamp / SAR teams tracking hikers that carry
ESP32 + LoRa SX1278 (433 MHz) + NEO-6M GPS + BMP280 devices. All telemetry comes from a spreadsheet
written by the Basecamp ESP32 receiver. **No demo data is bundled.**

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run typecheck
```

## Stack

Vite 6 · React 19 · TypeScript (strict) · Tailwind CSS 3 (Swiss GIS tokens in `tailwind.config.ts`) ·
MapLibre GL + `react-map-gl/maplibre` (OpenTopoMap / Esri Imagery / OSM + AWS Terrarium DEM) ·
Framer Motion · TanStack Query · Zustand (`persist`) · Recharts · SheetJS · PapaParse · Sonner · Lucide.

## Layout

```
src/
  lib/parser.ts     column mapper, pipe-payload parser, integrity filter
  lib/sheets.ts     Google Sheets URL resolver, fetch, .xlsx/.csv file parsing
  lib/geo.ts        haversine distance, bearing, midpoint, formatting
  lib/audio.ts      Web Audio two-tone SAR siren
  lib/export.ts     GPX / CSV exporters
  store/            config (persisted), telemetry (in-memory), ui
  hooks/            polling engine, hotkeys, alarm, derived hikers
  components/       top bar, banner, sidebar, map, dock, modals
  views/            dashboard, relay nodes, system log
```

## Data sources

* **Google Sheets** – share link (`/edit` → `/export?format=csv&gid=`), published CSV, or Apps Script `/exec` JSON.
  The sheet must be viewable by “Anyone with the link”, published, or served by the Apps Script.
* **Upload** – `.xlsx`, `.xls`, `.csv` parsed in the browser.
* **ESP32 guide** – the connection modal has a copy-ready `doPost` / `doGet` Apps Script and an ESP32 snippet.

Recognised columns (case-insensitive, Indonesian/English): ID/Device/Device_ID/Pendaki, Lat/Latitude/Lintang,
Lon/Lng/Longitude/Bujur, MDPL/Altitude/Elevasi/Ketinggian, Suhu/Temp/Temperature, Status/Kondisi,
RSSI, SNR, Timestamp/Waktu, Battery/Baterai. Raw payloads are also accepted:
`ID|lat|lon|mdpl|temp|STATUS[|rssi|snr]`, optionally prefixed with `ISI DATA:`.

Rows failing validation (non-ASCII ID, wrong field count, non-numeric or out-of-range values, `0,0` no-fix, unknown
status) are quarantined in **System Log** with the rejection reason; PDR = valid / total rows.

Rows without a timestamp column use the time the dashboard first received them (marked `*` in the log).

## Shortcuts

`/` search · `3` 2D/3D terrain · `R` re-sync · `M` mute siren · `Esc` close / deselect
