import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Segmented } from '../components/ui';
import { useTelemetry } from '../store/telemetry';
import { cleanedCsv, download } from '../lib/export';
import { formatDateTime } from '../lib/format';
import type { LogEntry } from '../types';

type LogFilter = 'all' | 'normal' | 'sos' | 'corrupt';
const ROW = 28;
const COLS = 'grid-cols-[64px_150px_196px_118px_100px_104px_74px_64px_96px_minmax(260px,1fr)]';

function Tag({ e }: { e: LogEntry }) {
  if (e.kind === 'SOS')
    return <span className="rounded-chip border border-crimson/40 bg-crimson-tint px-1.5 text-[10.5px] font-bold text-crimson">VALID (SOS)</span>;
  if (e.kind === 'NORMAL')
    return <span className="rounded-chip border border-forest/30 bg-forest-tint px-1.5 text-[10.5px] font-bold text-forest">VALID (NORMAL)</span>;
  return <span className="rounded-chip border border-amber/40 bg-amber-tint px-1.5 text-[10.5px] font-bold text-amber-ink">CORRUPT / NOISE (DROPPED)</span>;
}

export function SystemLogView() {
  const entries = useTelemetry((s) => s.entries);
  const { total, valid, sos, corrupt } = useTelemetry();
  const [filter, setFilter] = useState<LogFilter>('all');

  const rows = useMemo(() => {
    const out: LogEntry[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (filter === 'normal' && e.kind !== 'NORMAL') continue;
      if (filter === 'sos' && e.kind !== 'SOS') continue;
      if (filter === 'corrupt' && e.kind !== 'CORRUPT') continue;
      out.push(e);
    }
    return out;
  }, [entries, filter]);

  const scroller = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [total]);

  const start = Math.max(0, Math.floor(top / ROW) - 12);
  const end = Math.min(rows.length, Math.ceil((top + height) / ROW) + 12);
  const pdr = total ? (valid / total) * 100 : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-bold">System Log</h2>
            <p className="num mt-0.5 text-[11.5px] text-ink-2">
              {total} packets · {valid} valid · {sos} SOS · {corrupt} dropped · PDR {total ? pdr.toFixed(1) : '—'}%
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Segmented<LogFilter>
              value={filter}
              onChange={setFilter}
              ariaLabel="Log filter"
              options={[
                { value: 'all', label: 'All', count: total },
                { value: 'normal', label: 'Normal', count: valid - sos },
                { value: 'sos', label: 'SOS', count: sos },
                { value: 'corrupt', label: 'Corrupt', count: corrupt },
              ]}
            />
            <button
              className="btn"
              disabled={valid === 0}
              onClick={() => {
                download(`raksa_clean_${Date.now()}.csv`, cleanedCsv(entries), 'text/csv');
                toast.success('Cleaned data exported', { description: `${valid} valid packets` });
              }}
            >
              <Download size={14} />
              Export cleaned CSV
            </button>
          </div>
        </header>

        {total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-[14px] font-bold">No rows ingested</p>
            <p className="max-w-[360px] text-[12.5px] leading-relaxed text-ink-2">
              Every packet received from Firebase is audited here as valid or quarantined noise, with the exact rejection reason.
            </p>
          </div>
        ) : (
          <div ref={scroller} onScroll={(e) => setTop(e.currentTarget.scrollTop)} className="scroll-thin min-h-0 flex-1 overflow-auto">
            <div className="min-w-[1180px]">
              <div className={`sticky top-0 z-10 grid ${COLS} items-center gap-x-3 border-b border-line bg-canvas px-4 py-1.5`}>
                {['Row', 'Time', 'Classification', 'Device', 'Lat', 'Lon', 'MDPL', 'Temp', 'RSSI / SNR', 'Raw payload / rejection reason'].map((h) => (
                  <span key={h} className="label">
                    {h}
                  </span>
                ))}
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12.5px] text-ink-2">No rows in this category.</p>
              ) : (
                <div className="relative" style={{ height: rows.length * ROW }}>
                  {rows.slice(start, end).map((e, k) => {
                    const p = e.packet;
                    return (
                      <div
                        key={`${e.row}-${start + k}`}
                        className={`num absolute left-0 right-0 grid ${COLS} items-center gap-x-3 border-b border-line/60 px-4 text-[11.5px] ${
                          e.kind === 'SOS' ? 'bg-crimson-tint/60' : e.kind === 'CORRUPT' ? 'bg-amber-tint/50' : ''
                        }`}
                        style={{ top: (start + k) * ROW, height: ROW }}
                      >
                        <span className="text-ink-muted">{e.row}</span>
                        <span className="truncate text-ink-2">{p ? `${formatDateTime(p.ts)}${p.tsSource === 'ingest' ? '*' : ''}` : '—'}</span>
                        <span>
                          <Tag e={e} />
                        </span>
                        <span className="truncate font-semibold">{p?.id ?? '—'}</span>
                        <span>{p ? p.lat.toFixed(6) : '—'}</span>
                        <span>{p ? p.lon.toFixed(6) : '—'}</span>
                        <span>{p ? p.alt.toFixed(1) : '—'}</span>
                        <span className={p && p.temp < 15 ? 'font-semibold text-amber' : ''}>{p ? p.temp.toFixed(1) : '—'}</span>
                        <span className="text-ink-2">{p ? `${p.rssi ?? '—'} / ${p.snr ?? '—'}` : '—'}</span>
                        <span className={`truncate ${e.kind === 'CORRUPT' ? 'text-amber-ink' : 'text-ink-muted'}`} title={e.raw}>
                          {e.kind === 'CORRUPT' ? `${e.reason} · ` : ''}
                          <span className="text-ink-muted">{e.raw}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {total > 0 && (
          <footer className="border-t border-line bg-canvas/60 px-4 py-1.5 text-[11px] text-ink-muted">
            Newest first. * = packet had no timestamp; time shown is when the dashboard first received it.
          </footer>
        )}
      </div>
    </div>
  );
}


