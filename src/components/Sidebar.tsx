import { useEffect, useMemo, useRef } from 'react';
import { PanelLeftClose, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Segmented } from './ui';
import { HikerCard } from './HikerCard';
import { EmptyState } from './EmptyState';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { FIREBASE_STATUS } from '../lib/firebase';
import { FILTER_LABELS, FILTER_ORDER, filterCounts, filterHikers } from '../lib/filter';
import type { Hiker, SidebarFilter } from '../types';

export function Sidebar({ hikers }: { hikers: Hiker[] }) {
  const pairings = useConfig((s) => s.pairings);
  const activeSos = useSos((s) => s.active);
  const error = useTelemetry((s) => s.error);
  const corrupt = useTelemetry((s) => s.corrupt);
  const total = useTelemetry((s) => s.total);

  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const search = useUi((s) => s.search);
  const setSearch = useUi((s) => s.setSearch);
  const selectedId = useUi((s) => s.selectedId);
  const focusHiker = useUi((s) => s.focusHiker);
  const openPairing = useUi((s) => s.openPairing);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const searchFocusNonce = useUi((s) => s.searchFocusNonce);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchFocusNonce > 0) inputRef.current?.focus();
  }, [searchFocusNonce]);

  const counts = useMemo(() => filterCounts(hikers, activeSos), [hikers, activeSos]);

  const visible = useMemo(
    () => filterHikers(hikers, filter, search, (h) => pairings[h.id]?.leader ?? '', activeSos),
    [hikers, filter, search, pairings, activeSos],
  );

  const options: { value: SidebarFilter; label: string; count: number }[] = FILTER_ORDER.map((value) => ({ value, label: FILTER_LABELS[value], count: counts[value] }));

  return (
    <div className="flex h-full w-[310px] flex-col">
      <div className="space-y-2.5 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              ref={inputRef}
              className="field !pl-8 !pr-8"
              placeholder="Search Hikers / ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search hikers"
            />
            <kbd className="num pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] border border-line bg-canvas px-1.5 text-[10px] text-ink-muted">/</kbd>
          </div>
          <button className="btn btn-ghost h-9 w-9 !px-0" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>
        <Segmented size="sm" value={filter} options={options} onChange={setFilter} ariaLabel="Filter hikers" className="w-full [&>button]:flex-1" />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2.5">
        {hikers.length === 0 && !FIREBASE_STATUS.config && <EmptyState message={FIREBASE_STATUS.error} />}

        {hikers.length === 0 && FIREBASE_STATUS.config && (
          <div className="px-4 py-10 text-center">
            <h3 className="text-[14px] font-bold">{error ? 'Source unreachable' : 'Awaiting hiker data'}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              {error
                ? error
                : total > 0
                  ? `${total} packets received, ${corrupt} quarantined. No packet passed the integrity filter yet. See System Log.`
                  : 'Connected. Waiting for devices under the pendaki node.'}
            </p>
          </div>
        )}

        {hikers.length > 0 && visible.length === 0 && (
          <p className="px-4 py-10 text-center text-[12.5px] text-ink-2">No hikers match the current filter.</p>
        )}

        <motion.ul layout className="space-y-2">
          {visible.map((h) => (
            <motion.li layout="position" key={h.id} transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
              <HikerCard
                hiker={h}
                pairing={pairings[h.id]}
                sosIncident={activeSos[h.id]}
                selected={selectedId === h.id}
                onSelect={() => focusHiker(h.id)}
                onEdit={() => openPairing(h.id)}
              />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
}

