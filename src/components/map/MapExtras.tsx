import { Popup } from 'react-map-gl/maplibre';
import { Crosshair, Users } from 'lucide-react';
import { IncidentStatePill, LinkPill, StatusPill } from '../ui';
import { formatAgo, formatDateTime } from '../../lib/format';
import type { Hiker, SosIncident } from '../../types';

const f = (v: number | undefined, unit: string, d = 1) => (v === undefined ? '—' : `${v.toFixed(d)} ${unit}`);

/** Click popup for a hiker marker. Reads the live hiker & persistent SOS objects, updating in real time. */
export function HikerPopup({ hiker, sosIncident, onClose }: { hiker: Hiker; sosIncident?: SosIncident; onClose: () => void }) {
  const p = hiker.latest;
  const rows: [string, string][] = [
    ['Latitude', p.lat.toFixed(6)],
    ['Longitude', p.lon.toFixed(6)],
    ['Altitude', f(p.alt, 'm')],
    ['Temperature', f(p.temp, '°C')],
    ['RSSI', f(p.rssi, 'dBm', 0)],
    ['SNR', f(p.snr, 'dB')],
    ['Last update', formatDateTime(p.ts)],
  ];
  return (
    <Popup
      longitude={p.lon}
      latitude={p.lat}
      anchor="bottom"
      offset={18}
      closeButton
      closeOnClick={false}
      maxWidth="280px"
      onClose={onClose}
    >
      <div className="min-w-[225px] text-ink">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="num text-[13px] font-bold">{hiker.id}</span>
          <StatusPill status={hiker.status} />
          <LinkPill link={hiker.link} />
        </div>
        {sosIncident && (
          <div className="mb-2 rounded-chip border border-crimson/35 bg-crimson-tint px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-crimson">Persistent Incident</span>
              <IncidentStatePill state={sosIncident.state} />
            </div>
            <div className="num mt-0.5 text-[10px] text-ink-2">{sosIncident.incident_id}</div>
            <div className="num text-[10px] text-ink-2">Triggered: {formatDateTime(sosIncident.triggered_at)}</div>
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="num text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-1 text-right text-[10.5px] text-ink-muted">{formatAgo(hiker.silentMs)}</div>
      </div>
    </Popup>
  );
}

/** Hiker counter, status legend and a "focus hiker" picker, overlaid on the map. */
export function MapLegend({
  hikers,
  activeSos,
  onFocus,
}: {
  hikers: Hiker[];
  activeSos: Record<string, SosIncident>;
  onFocus: (id: string) => void;
}) {
  const live = hikers.filter((h) => h.link === 'LIVE').length;
  const delayed = hikers.filter((h) => h.link === 'DELAYED').length;
  const offline = hikers.filter((h) => h.link === 'OFFLINE').length;
  const sos = hikers.filter((h) => Boolean(activeSos[h.id]) || h.status === 'SOS').length;
  return (
    <div className="absolute bottom-10 left-3 z-10 w-[195px] rounded-panel border border-line bg-surface/95 p-2.5 text-[11.5px] shadow-float">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label flex items-center gap-1">
          <Users size={12} /> Monitored hikers
        </span>
        <span className="num text-[13px] font-bold">{hikers.length}</span>
      </div>
      <select
        className="field mb-2 !h-7 !py-0 text-[12px]"
        aria-label="Focus on a hiker"
        value=""
        disabled={hikers.length === 0}
        onChange={(e) => e.target.value && onFocus(e.target.value)}
      >
        <option value="">Focus on hiker…</option>
        {hikers.map((h) => (
          <option key={h.id} value={h.id}>
            {h.id}{activeSos[h.id] ? ' [SOS]' : ''}
          </option>
        ))}
      </select>
      <div className="space-y-1">
        <Row color="#166534" label="NORMAL" hint="no incident" count={hikers.length - sos} />
        <Row color="#DC2626" label="SOS" hint="active / ack" count={sos} />
        <div className="my-1 h-px bg-line" />
        <Row color="#166534" label="LIVE" hint="solid ring" count={live} />
        <Row color="#D97706" label="DELAYED" hint="dashed ring" count={delayed} />
        <Row color="#64748B" label="OFFLINE" hint="faded" count={offline} />
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-muted">
        <Crosshair size={10} /> Fill = SOS/normal · Ring = link
      </div>
    </div>
  );
}

function Row({ color, label, hint, count }: { color: string; label: string; hint: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-semibold">{label}</span>
      <span className="text-[10px] text-ink-muted">{hint}</span>
      <span className="num ml-auto">{count}</span>
    </div>
  );
}
