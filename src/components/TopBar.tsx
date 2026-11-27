import { useId } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Volume2, VolumeX } from 'lucide-react';
import { Logo } from './ui';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { formatClock } from '../lib/format';
import type { AppView } from '../types';

const TABS: { id: AppView; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'nodes', label: 'Relay Nodes' },
  { id: 'log', label: 'System Log' },
];

function SourcePill() {
  const mode = useConfig((s) => s.mode);
  const intervalMs = useConfig((s) => s.intervalMs);
  const syncing = useTelemetry((s) => s.syncing);
  const error = useTelemetry((s) => s.error);
  const lastSyncAt = useTelemetry((s) => s.lastSyncAt);
  const pulse = useTelemetry((s) => s.pulse);
  const fileName = useTelemetry((s) => s.fileName);
  const openConnect = useUi((s) => s.openConnect);

  let dot = 'bg-slate-400';
  let text = 'Spreadsheet: Not Connected';
  if (mode === 'sheet') {
    if (error && !syncing) {
      dot = 'bg-amber';
      text = 'Sync Error • Retrying';
    } else if (syncing && !lastSyncAt) {
      dot = 'bg-amber';
      text = 'Syncing...';
    } else if (syncing) {
      dot = 'bg-amber';
      text = 'Syncing...';
    } else {
      dot = 'bg-forest';
      text = `Live Sync • ${intervalMs > 0 ? `${intervalMs / 1000}s` : 'Manual'}`;
    }
  } else if (mode === 'file') {
    dot = 'bg-forest';
    text = `File • ${fileName ?? 'loaded'}`;
  }

  return (
    <button
      onClick={() => openConnect()}
      className="group flex h-8 max-w-[260px] items-center gap-2 rounded-full border border-line bg-canvas px-3 text-[12px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:bg-surface"
      title="Open spreadsheet connection"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {mode !== 'none' && pulse > 0 && <span key={pulse} className="heartbeat-ring" />}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="truncate">{text}</span>
    </button>
  );
}

function Clock() {
  const now = useNow(1000);
  return (
    <span className="num hidden whitespace-nowrap text-[12px] text-ink-2 lg:inline">
      <span className="mr-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-muted">System</span>
      {formatClock(now)}
    </span>
  );
}

export function TopBar({ sosActive }: { sosActive: boolean }) {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const openConnect = useUi((s) => s.openConnect);
  const muted = useConfig((s) => s.muted);
  const setMuted = useConfig((s) => s.setMuted);
  const layoutId = useId();

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-extrabold tracking-[0.14em]">RAKSA</span>
        </div>
        <span className="h-5 w-px bg-line" />
        <SourcePill />
        <Clock />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <nav className="relative flex items-center gap-0.5 rounded-ctl border border-line bg-canvas p-0.5" role="tablist">
          {TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setView(t.id)}
                className={`relative h-8 rounded-[6px] px-3 text-[12.5px] font-semibold transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-[6px] border border-line bg-surface shadow-hair"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {sosActive && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setMuted(!muted)}
            className="btn h-8 w-8 border-crimson/40 !px-0 text-crimson hover:border-crimson hover:bg-crimson-tint"
            title={muted ? 'Unmute SOS siren (M)' : 'Mute SOS siren (M)'}
            aria-label={muted ? 'Unmute SOS siren' : 'Mute SOS siren'}
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </motion.button>
        )}

        <button className="btn btn-primary" onClick={() => openConnect()}>
          <FileSpreadsheet size={15} />
          Hubungkan Spreadsheet
        </button>
      </div>
    </header>
  );
}
