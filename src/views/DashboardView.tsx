import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelLeftOpen } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { MapView } from '../components/map/MapView';
import { TelemetryDock } from '../components/dock/TelemetryDock';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useUi } from '../store/ui';
import { filterHikers } from '../lib/filter';
import type { Hiker } from '../types';

export function DashboardView({ hikers }: { hikers: Hiker[] }) {
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const selectedId = useUi((s) => s.selectedId);
  const filter = useUi((s) => s.filter);
  const search = useUi((s) => s.search);
  const pairings = useConfig((s) => s.pairings);
  const activeSos = useSos((s) => s.active);
  const selected = hikers.find((h) => h.id === selectedId) ?? null;

  // The same filter/search that drives the hiker list also drives the map markers.
  const mapHikers = useMemo(
    () => filterHikers(hikers, filter, search, (h) => pairings[h.id]?.leader ?? '', activeSos),
    [hikers, filter, search, pairings, activeSos],
  );

  return (
    <div className="relative flex min-h-0 flex-1 gap-3 p-2 md:p-3">
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 310 : 0, opacity: sidebarOpen ? 1 : 0, marginRight: sidebarOpen ? 0 : -12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="panel shrink-0 overflow-hidden max-md:absolute max-md:inset-y-2 max-md:left-2 max-md:z-30 max-md:max-w-[calc(100%-16px)] max-md:shadow-float"
        aria-label="Hikers"
        aria-hidden={!sidebarOpen}
      >
        <Sidebar hikers={hikers} />
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <section className="panel relative min-h-[320px] flex-1 overflow-hidden" aria-label="Map">
          <MapView hikers={mapHikers} totalHikers={hikers.length} />
          <AnimatePresence>
            {!sidebarOpen && (
              <motion.button
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => setSidebarOpen(true)}
                className={`btn absolute top-3 z-20 shadow-float ${selected ? 'left-3 md:left-[340px]' : 'left-3'}`}
                aria-label="Show hiker list"
              >
                <PanelLeftOpen size={15} />
                Hikers
                <span className="num text-[11px] text-ink-muted">{hikers.length}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </section>
        <div className="max-md:hidden">
          <TelemetryDock hiker={selected} />
        </div>
      </div>
    </div>
  );
}
