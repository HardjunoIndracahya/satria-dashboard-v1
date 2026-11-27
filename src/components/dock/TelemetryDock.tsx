import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ElevationChart } from './ElevationChart';
import { HealthPanel } from './HealthPanel';
import { useUi } from '../../store/ui';
import { formatClock } from '../../lib/format';
import type { Hiker } from '../../types';

export function TelemetryDock({ hiker }: { hiker: Hiker | null }) {
  const open = useUi((s) => s.dockOpen);
  const toggle = useUi((s) => s.toggleDock);
  const scrub = useUi((s) => s.scrubIndex);
  const point = hiker ? (scrub !== null ? hiker.track[scrub] : hiker.latest) : null;

  return (
    <motion.section
      initial={false}
      animate={{ height: open ? 210 : 36 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="panel flex shrink-0 flex-col overflow-hidden"
      aria-label="Telemetry dock"
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="label !text-ink-2">Elevation Profile (MDPL)</span>
          {hiker && <span className="num text-[12px] font-semibold">{hiker.id}</span>}
          {hiker && point && (
            <span className="num hidden items-center gap-2 text-[11.5px] text-ink-2 sm:flex">
              <span className={scrub !== null ? 'rounded-chip bg-ink px-1.5 text-[10px] font-bold text-white' : 'rounded-chip bg-forest-tint px-1.5 text-[10px] font-bold text-forest'}>
                {scrub !== null ? 'SCRUB' : 'LATEST'}
              </span>
              <span>{point.alt.toFixed(1)} MDPL</span>
              <span className={point.temp < 15 ? 'text-amber' : ''}>{point.temp.toFixed(1)} °C</span>
              <span>{formatClock(point.ts)}</span>
              {point.status === 'SOS' && <span className="font-bold text-crimson">SOS</span>}
            </span>
          )}
        </div>
        <button className="btn btn-ghost h-6 w-6 !px-0" onClick={toggle} aria-label={open ? 'Collapse telemetry dock' : 'Expand telemetry dock'} aria-expanded={open}>
          <ChevronDown size={15} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[7fr_3fr]">
        <div className="relative min-w-0 border-r border-line">
          <ElevationChart hiker={hiker} />
        </div>
        <HealthPanel />
      </div>
    </motion.section>
  );
}
