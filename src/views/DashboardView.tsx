import { AnimatePresence, motion } from 'framer-motion';
import { PanelLeftOpen } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { MapView } from '../components/map/MapView';
import { TelemetryDock } from '../components/dock/TelemetryDock';
import { useUi } from '../store/ui';
import type { Hiker } from '../types';

export function DashboardView({ hikers }: { hikers: Hiker[] }) {
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const selectedId = useUi((s) => s.selectedId);
  const selected = hikers.find((h) => h.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 gap-3 p-3">
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 310 : 0, opacity: sidebarOpen ? 1 : 0, marginRight: sidebarOpen ? 0 : -12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="panel shrink-0 overflow-hidden"
        aria-label="Hikers"
        aria-hidden={!sidebarOpen}
      >
        <Sidebar hikers={hikers} />
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <section className="panel relative min-h-0 flex-1 overflow-hidden" aria-label="Map">
          <MapView hikers={hikers} />
          <AnimatePresence>
            {!sidebarOpen && (
              <motion.button
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => setSidebarOpen(true)}
                className="btn absolute bottom-10 left-3 z-20 shadow-float"
                aria-label="Show hiker list"
              >
                <PanelLeftOpen size={15} />
                Hikers
                <span className="num text-[11px] text-ink-muted">{hikers.length}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </section>
        <TelemetryDock hiker={selected} />
      </div>
    </div>
  );
}
