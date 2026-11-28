import { memo } from 'react';
import { Pencil, ShieldAlert } from 'lucide-react';
import { IncidentStatePill, LinkPill, SignalBars, StatusPill } from './ui';
import { HYPOTHERMIA_C, WEAK_RSSI, formatAgo, formatClock } from '../lib/format';
import type { Hiker, Pairing, SosIncident } from '../types';

function HikerCardBase({
  hiker,
  pairing,
  sosIncident,
  selected,
  onSelect,
  onEdit,
}: {
  hiker: Hiker;
  pairing?: Pairing;
  sosIncident?: SosIncident;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const p = hiker.latest;
  const hasPersistentSos = Boolean(sosIncident);
  const isSos = hasPersistentSos || hiker.status === 'SOS';
  const cold = p.temp < HYPOTHERMIA_C;
  const weak = p.rssi !== undefined && p.rssi <= WEAK_RSSI;

  const border = isSos ? 'border-crimson' : selected ? 'border-forest' : 'border-line hover:border-line-strong';
  const bg = isSos ? 'bg-crimson-tint' : selected ? 'bg-forest-tint' : 'bg-surface';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative cursor-pointer rounded-ctl border p-2.5 pl-3 transition-colors ${border} ${bg} ${hiker.link === 'OFFLINE' && !isSos ? 'opacity-90' : ''}`}
    >
      {isSos && <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-ctl bg-crimson" />}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="num truncate text-[13px] font-bold">{hiker.id}</span>
          {pairing?.leader && <span className="truncate text-[12px] text-ink-2">{pairing.leader}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-chip p-1 text-ink-muted opacity-0 transition-opacity hover:bg-canvas hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Edit pairing for ${hiker.id}`}
            title="Device pairing"
          >
            <Pencil size={13} />
          </button>
          <LinkPill link={hiker.link} />
          <StatusPill status={hiker.status} />
        </div>
      </div>

      {sosIncident && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 rounded-chip border border-crimson/25 bg-surface/90 px-2 py-1">
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-crimson">
            <ShieldAlert size={12} />
            Incident
          </span>
          <IncidentStatePill state={sosIncident.state} />
        </div>
      )}

      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
        <span>Updated</span>
        <span className="num text-ink-2">{formatClock(p.ts)}</span>
        <span>·</span>
        <span className="num text-ink-2">{formatAgo(hiker.silentMs)}</span>
      </div>

      <div className="mt-2 grid grid-cols-[1.15fr_1fr_0.9fr] gap-2">
        <div>
          <div className="label">RSSI</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <SignalBars rssi={p.rssi} />
            <span className={`num text-[11.5px] ${weak ? 'font-semibold text-amber' : 'text-ink'}`}>{p.rssi !== undefined ? `${p.rssi} dBm` : '—'}</span>
          </div>
          <div className="num mt-0.5 text-[10.5px] text-ink-muted">SNR {p.snr !== undefined ? `${p.snr} dB` : '—'}</div>
        </div>
        <div>
          <div className="label">Temp</div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className={`num text-[11.5px] ${cold ? 'font-semibold text-amber' : 'text-ink'}`}>{p.temp.toFixed(1)}°C</span>
            {cold && (
              <span className="rounded-chip border border-amber/40 bg-amber-tint px-1 text-[9.5px] font-bold leading-[14px] text-amber-ink" title="Hypothermia risk (< 15°C)">
                HYPO
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="label">MDPL</div>
          <div className="num mt-0.5 text-[11.5px]">{p.alt.toFixed(0)} m</div>
        </div>
      </div>
      {selected && (
        <dl className="num mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px]">
          <dt className="text-ink-muted">Latitude</dt>
          <dd className="text-right">{p.lat.toFixed(6)}</dd>
          <dt className="text-ink-muted">Longitude</dt>
          <dd className="text-right">{p.lon.toFixed(6)}</dd>
          <dt className="text-ink-muted">TX Status</dt>
          <dd className="text-right">{hiker.status}</dd>
          <dt className="text-ink-muted">Emergency</dt>
          <dd className={`text-right font-bold ${sosIncident ? 'text-crimson' : ''}`}>{sosIncident ? sosIncident.state : 'None'}</dd>
          <dt className="text-ink-muted">Connection</dt>
          <dd className="text-right">{hiker.link}</dd>
          <dt className="text-ink-muted">Updates seen</dt>
          <dd className="text-right">{hiker.track.length}</dd>
        </dl>
      )}
    </div>
  );
}

export const HikerCard = memo(HikerCardBase);
