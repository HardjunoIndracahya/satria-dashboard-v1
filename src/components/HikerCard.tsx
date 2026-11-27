import { memo } from 'react';
import { Pencil } from 'lucide-react';
import { SignalBars, StatusPill } from './ui';
import { HYPOTHERMIA_C, WEAK_RSSI, formatAgo } from '../lib/format';
import type { Hiker, Pairing } from '../types';

function HikerCardBase({
  hiker,
  pairing,
  selected,
  acked,
  onSelect,
  onEdit,
}: {
  hiker: Hiker;
  pairing?: Pairing;
  selected: boolean;
  acked: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const p = hiker.latest;
  const isSos = hiker.status === 'SOS';
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
      className={`group relative cursor-pointer rounded-ctl border p-2.5 pl-3 transition-colors ${border} ${bg} ${hiker.status === 'OFFLINE' ? 'opacity-90' : ''}`}
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
          <StatusPill status={hiker.status} />
        </div>
      </div>

      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
        <span>Last seen</span>
        <span className="num text-ink-2">{formatAgo(hiker.silentMs)}</span>
        {isSos && acked && <span className="rounded-chip border border-crimson/30 bg-surface px-1 text-[10px] font-bold text-crimson">ACK</span>}
      </div>

      <div className="mt-2 grid grid-cols-[1.15fr_1fr_0.9fr] gap-2">
        <div>
          <div className="label">RSSI</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <SignalBars rssi={p.rssi} />
            <span className={`num text-[11.5px] ${weak ? 'font-semibold text-amber' : 'text-ink'}`}>{p.rssi !== undefined ? `${p.rssi} dBm` : '—'}</span>
          </div>
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
    </div>
  );
}

export const HikerCard = memo(HikerCardBase);
