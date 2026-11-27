import type { Hiker, LogEntry, Packet } from '../types';
import { formatClock } from './format';

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function packetsToCsv(packets: Packet[]): string {
  const head = 'timestamp,id,lat,lon,mdpl,temp_c,status,rssi_dbm,snr_db,battery';
  const rows = packets.map((p) =>
    [new Date(p.ts).toISOString(), p.id, p.lat, p.lon, p.alt, p.temp, p.status, p.rssi, p.snr, p.battery].map(csvCell).join(','),
  );
  return [head, ...rows].join('\r\n');
}

export function cleanedCsv(entries: LogEntry[]): string {
  return packetsToCsv(entries.filter((e) => e.packet).map((e) => e.packet as Packet));
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function hikerToGpx(h: Hiker): string {
  const pts = h.track
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><ele>${p.alt}</ele><time>${new Date(p.ts).toISOString()}</time><extensions><temp>${p.temp}</temp><status>${p.status}</status></extensions></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RAKSA" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(h.id)}</name><time>${new Date().toISOString()}</time></metadata>
  <trk>
    <name>${xml(h.id)} (${formatClock(h.track[0].ts)}–${formatClock(h.latest.ts)})</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
