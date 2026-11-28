import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Crosshair, Search } from 'lucide-react';
import { IncidentStatePill, LinkPill, Segmented, StatusPill } from '../components/ui';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useUi } from '../store/ui';
import { FILTER_LABELS, FILTER_ORDER, filterCounts, filterHikers } from '../lib/filter';
import { formatAgo, formatDateTime } from '../lib/format';
import type { Hiker, SidebarFilter } from '../types';

type SortKey = 'id' | 'lat' | 'lon' | 'alt' | 'temp' | 'status' | 'link' | 'rssi' | 'snr' | 'ts';

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'id', label: 'Device ID' },
  { key: 'lat', label: 'Latitude', align: 'right' },
  { key: 'lon', label: 'Longitude', align: 'right' },
  { key: 'alt', label: 'Altitude (m)', align: 'right' },
  { key: 'temp', label: 'Temp (°C)', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'link', label: 'Connection' },
  { key: 'rssi', label: 'RSSI (dBm)', align: 'right' },
  { key: 'snr', label: 'SNR (dB)', align: 'right' },
  { key: 'ts', label: 'Last update' },
];

const LINK_RANK = { LIVE: 0, DELAYED: 1, OFFLINE: 2 } as const;

function value(h: Hiker, key: SortKey): number | string {
  const p = h.latest;
  switch (key) {
    case 'id':
      return h.id;
    case 'status':
      return h.status;
    case 'link':
      return LINK_RANK[h.link];
    case 'rssi':
      return p.rssi ?? Number.NEGATIVE_INFINITY;
    case 'snr':
      return p.snr ?? Number.NEGATIVE_INFINITY;
    default:
      return p[key];
  }
}

export function HikersView({ hikers }: { hikers: Hiker[] }) {
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const search = useUi((s) => s.search);
  const setSearch = useUi((s) => s.setSearch);
  const selectedId = useUi((s) => s.selectedId);
  const select = useUi((s) => s.select);
  const focusHiker = useUi((s) => s.focusHiker);
  const pairings = useConfig((s) => s.pairings);
  const activeSos = useSos((s) => s.active);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'id', dir: 1 });

  const counts = useMemo(() => filterCounts(hikers, activeSos), [hikers, activeSos]);
  const rows = useMemo(() => {
    const list = filterHikers(hikers, filter, search, (h) => pairings[h.id]?.leader ?? '', activeSos);
    return [...list].sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, undefined, { numeric: true }) : Number(x) - Number(y);
      return (c || a.id.localeCompare(b.id)) * sort.dir;
    });
  }, [hikers, filter, search, pairings, activeSos, sort]);

  const options = FILTER_ORDER.map((v: SidebarFilter) => ({ value: v, label: FILTER_LABELS[v], count: counts[v] }));
  const selected = hikers.find((h) => h.id === selectedId);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-2 md:p-3">
      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 md:px-4">
          <div>
            <h2 className="text-[14px] font-bold">Hiker monitoring</h2>
            <p className="num mt-0.5 text-[11.5px] text-ink-2">
              {rows.length} of {hikers.length} hikers · click a column to sort
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
            <div className="relative min-w-[180px] flex-1 md:w-[220px] md:flex-none">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input className="field !pl-8" placeholder="Search device ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search hikers" />
            </div>
            <div className="scroll-thin max-w-full overflow-x-auto">
              <Segmented<SidebarFilter> size="sm" value={filter} options={options} onChange={setFilter} ariaLabel="Filter hikers" />
            </div>
            <button className="btn btn-primary" disabled={!selected} onClick={() => selected && focusHiker(selected.id)}>
              <Crosshair size={14} />
              Focus on map{selected ? `: ${selected.id}` : ''}
            </button>
          </div>
        </header>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto">
          {hikers.length === 0 ? (
            <p className="px-4 py-14 text-center text-[12.5px] text-ink-2">No hiker data received from Firebase yet.</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-14 text-center text-[12.5px] text-ink-2">No hikers match the current search / filter.</p>
          ) : (
            <table className="w-full min-w-[980px] border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-canvas">
                <tr>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key;
                    const Icon = !active ? ChevronsUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
                    return (
                      <th key={c.key} className="border-b border-line px-3 py-2 font-normal" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                        <button
                          className={`label flex w-full items-center gap-1 ${c.align === 'right' ? 'justify-end' : ''} ${active ? '!text-ink' : ''}`}
                          onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}
                        >
                          {c.label}
                          <Icon size={11} />
                        </button>
                      </th>
                    );
                  })}
                  <th className="border-b border-line px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const p = h.latest;
                  const isSel = h.id === selectedId;
                  const sosInc = activeSos[h.id];
                  return (
                    <tr
                      key={h.id}
                      tabIndex={0}
                      onClick={() => select(h.id)}
                      onDoubleClick={() => focusHiker(h.id)}
                      onKeyDown={(e) => e.key === 'Enter' && focusHiker(h.id)}
                      className={`cursor-pointer border-b border-line transition-colors ${
                        sosInc || h.status === 'SOS' ? 'bg-crimson-tint' : isSel ? 'bg-forest-tint' : 'hover:bg-canvas'
                      } ${h.link === 'OFFLINE' && !sosInc ? 'text-ink-2' : ''}`}
                      aria-selected={isSel}
                    >
                      <td className="num px-3 py-2 font-bold">{h.id}</td>
                      <td className="num px-3 py-2 text-right">{p.lat.toFixed(6)}</td>
                      <td className="num px-3 py-2 text-right">{p.lon.toFixed(6)}</td>
                      <td className="num px-3 py-2 text-right">{p.alt.toFixed(1)}</td>
                      <td className="num px-3 py-2 text-right">{p.temp.toFixed(1)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusPill status={h.status} />
                          {sosInc && <IncidentStatePill state={sosInc.state} />}
                        </div>
                      </td>
                      <td className="px-3 py-2"><LinkPill link={h.link} /></td>
                      <td className="num px-3 py-2 text-right">{p.rssi ?? '—'}</td>
                      <td className="num px-3 py-2 text-right">{p.snr ?? '—'}</td>
                      <td className="num whitespace-nowrap px-3 py-2">
                        {formatDateTime(p.ts)} <span className="text-ink-muted">({formatAgo(h.silentMs)})</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="btn h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            focusHiker(h.id);
                          }}
                          aria-label={`Focus ${h.id} on map`}
                          title="Focus on map"
                        >
                          <Crosshair size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
