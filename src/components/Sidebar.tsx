import { useEffect, useMemo, useRef } from 'react';
import { PanelLeftClose, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Segmented } from './ui';
import { HikerCard } from './HikerCard';
import { EmptyState } from './EmptyState';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { getEnvironmentFirebaseConfig } from '../lib/firebase';
import type { Hiker, SidebarFilter } from '../types';

export function Sidebar({ hikers }: { hikers: Hiker[] }) {
  const firebaseConfig = useConfig((s) => s.firebaseConfig);
  const connectionDisabled = useConfig((s) => s.connectionDisabled);
  const configured = !connectionDisabled && Boolean(firebaseConfig || getEnvironmentFirebaseConfig());
  const pairings = useConfig((s) => s.pairings);
  const acks = useConfig((s) => s.acks);
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
  const openConnect = useUi((s) => s.openConnect);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const searchFocusNonce = useUi((s) => s.searchFocusNonce);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchFocusNonce > 0) inputRef.current?.focus();
  }, [searchFocusNonce]);

  const counts = useMemo(
    () => ({
      all: hikers.length,
      sos: hikers.filter((h) => h.status === 'SOS').length,
      normal: hikers.filter((h) => h.status === 'NORMAL').length,
      offline: hikers.filter((h) => h.status === 'OFFLINE').length,
    }),
    [hikers],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hikers.filter((h) => {
      if (filter !== 'all' && h.status.toLowerCase() !== filter) return false;
      if (!q) return true;
      const pair = pairings[h.id];
      return h.id.toLowerCase().includes(q) || (pair?.leader ?? '').toLowerCase().includes(q);
    });
  }, [hikers, filter, search, pairings]);

  const options: { value: SidebarFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'sos', label: 'SOS', count: counts.sos },
    { value: 'normal', label: 'Normal', count: counts.normal },
    { value: 'offline', label: 'Offline', count: counts.offline },
  ];

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
        {hikers.length === 0 && !configured && <EmptyState />}

        {hikers.length === 0 && configured && (
          <div className="px-4 py-10 text-center">
            <h3 className="text-[14px] font-bold">{error ? 'Source unreachable' : 'Awaiting valid packets'}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              {error
                ? error
                : total > 0
                  ? `${total} packets received, ${corrupt} quarantined. No packet passed the integrity filter yet — see System Log.`
                  : 'Firebase is connected but no packets have arrived yet.'}
            </p>
            <button className="btn mt-4" onClick={() => openConnect('firebase')}>
              Connection settings
            </button>
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
                selected={selectedId === h.id}
                acked={!!h.sosKey && !!acks[h.sosKey]}
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
