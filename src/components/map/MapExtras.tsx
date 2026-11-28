import { ChevronDown, ChevronUp, Crosshair, Users } from 'lucide-react';
import { Popup } from 'react-map-gl/maplibre';
import { IncidentStatePill, LinkPill, StatusPill } from '../ui';
import { formatAgo, formatDateTime } from '../../lib/format';
import type { Hiker, SosIncident } from '../../types';

export type PopupAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const f = (v: number | undefined, unit: string, d = 1) => (v === undefined ? '—' : `${v.toFixed(d)} ${unit}`);

/**
 * Click popup attached to a hiker marker.
 * Uses adaptive `anchor` calculated from marker screen coordinates & overlay safe zones
 * so it stays inside the viewport and never collides with the left panels or right toolbar.
 */
export function HikerPopup({
  hiker,
  sosIncident,
  anchor,
  onClose,
}: {
  hiker: Hiker;
  sosIncident?: SosIncident;
  anchor?: PopupAnchor;
  onClose: () => void;
}) {
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
      anchor={anchor}
      offset={16}
      closeButton
      closeOnClick={false}
      maxWidth="292px"
      onClose={onClose}
    >
      <div className="min-w-[215px] text-ink">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 pr-6">
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
            <div className="num mt-0.5 break-all text-[10px] text-ink-2">{sosIncident.incident_id}</div>
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
        <div className="mt-1.5 text-right text-[10.5px] text-ink-muted">{formatAgo(hiker.silentMs)}</div>
      </div>
    </Popup>
  );
}

/**
 * Collapsible Monitored Hikers & Map Legend panel.
 * Rendered inside MapView's unified left flex stack (never positioned independently on top of Inspector).
 */
export function MapLegend({
  hikers,
  activeSos,
  collapsed,
  onToggleCollapse,
  onFocus,
}: {
  hikers: Hiker[];
  activeSos: Record<string, SosIncident>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onFocus: (id: string) => void;
}) {
  const live = hikers.filter((h) => h.link === 'LIVE').length;
  const delayed = hikers.filter((h) => h.link === 'DELAYED').length;
  const offline = hikers.filter((h) => h.link === 'OFFLINE').length;
  const sos = hikers.filter((h) => Boolean(activeSos[h.id]) || h.status === 'SOS').length;

  return (
    <section
      aria-label="Monitored hikers and map legend"
      className="pointer-events-auto shrink-0 rounded-panel border border-line bg-surface/95 text-[11.5px] shadow-float backdrop-blur-[2px] w-[206px] max-w-[calc(100vw-80px)]"
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-canvas/70 rounded-panel"
      >
        <span className="label flex items-center gap-1.5 !text-ink-2">
          <Users size={12} className="shrink-0" />
          Monitored hikers
        </span>
        <span className="flex items-center gap-1.5">
          {sos > 0 && (
            <span className="num rounded-chip bg-crimson px-1.5 py-px text-[10px] font-bold text-white" title={`${sos} active SOS`}>
              {sos} SOS
            </span>
          )}
          <span className="num text-[12.5px] font-bold text-ink">{hikers.length}</span>
          {collapsed ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-line px-2.5 pb-2.5 pt-2">
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
            <Crosshair size={10} className="shrink-0" /> Fill = SOS/normal · Ring = link
          </div>
        </div>
      )}
    </section>
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
