import { useId } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Lock,
  Map as MapIcon,
  Radio,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Logo } from './ui';
import { useAuth } from '../store/auth';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { FIREBASE_STATUS } from '../lib/firebase';
import { formatClock } from '../lib/format';
import type { AppView } from '../types';

const TABS: { id: AppView; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'dashboard', label: 'Live Tracking', icon: MapIcon },
  { id: 'emergencies', label: 'Emergencies', icon: ShieldAlert },
  { id: 'hikers', label: 'Hikers', icon: Table2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'nodes', label: 'Relay Nodes', icon: Radio },
  { id: 'log', label: 'System Log', icon: ScrollText },
];

/** Read-only Firebase connection indicator (connection is automatic, via firebase-config.js). */
function SourcePill() {
  const connectionState = useTelemetry((s) => s.connectionState);
  const pulse = useTelemetry((s) => s.pulse);
  const error = useTelemetry((s) => s.error);
  const setView = useUi((s) => s.setView);

  let dot = 'bg-slate-400';
  let text = 'Firebase: Offline';
  if (!FIREBASE_STATUS.config) {
    dot = 'bg-crimson';
    text = 'Firebase: Not configured';
  } else if (connectionState === 'connected') {
    dot = 'bg-forest';
    text = 'Firebase: Connected';
  } else if (connectionState === 'error') {
    dot = 'bg-crimson';
    text = 'Firebase: Error';
  } else if (connectionState === 'connecting') {
    dot = 'bg-amber';
    text = 'Firebase: Connecting';
  }

  return (
    <button
      onClick={() => setView('overview')}
      className="group flex h-8 max-w-[220px] items-center gap-2 rounded-full border border-line bg-canvas px-3 text-[12px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:bg-surface"
      title={error ?? 'Realtime Database connection status — click for details'}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {connectionState === 'connected' && pulse > 0 && <span key={pulse} className="heartbeat-ring" />}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="truncate">{text}</span>
    </button>
  );
}

function Clock() {
  const now = useNow(1000);
  return (
    <span className="num hidden whitespace-nowrap text-[12px] text-ink-2 2xl:inline">
      <span className="mr-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-muted">System</span>
      {formatClock(now)}
    </span>
  );
}

export function TopBar({ sosAlarmActive, activeSosCount }: { sosAlarmActive: boolean; activeSosCount: number }) {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const openAuthModal = useUi((s) => s.openAuthModal);
  const operator = useAuth((s) => s.user);
  const muted = useConfig((s) => s.muted);
  const setMuted = useConfig((s) => s.setMuted);
  const layoutId = useId();

  return (
    <header className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line bg-surface px-3 py-2 md:px-4 lg:h-14 lg:flex-nowrap lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-[0.14em]">RAKSA</div>
            <div className="hidden text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:block">Basecamp Command Center</div>
          </div>
        </div>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <SourcePill />
        <Clock />
      </div>

      <div className="flex shrink-0 items-center gap-2 max-lg:order-last max-lg:w-full">
        <nav
          className="scroll-thin relative flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-ctl border border-line bg-canvas p-0.5 max-lg:flex-1"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {TABS.map((t) => {
            const active = view === t.id;
            const Icon = t.icon;
            const isEmergencies = t.id === 'emergencies';
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setView(t.id)}
                className={`relative flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-semibold transition-colors ${
                  active ? 'text-ink' : isEmergencies && activeSosCount > 0 ? 'text-crimson hover:text-crimson' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-[6px] border border-line bg-surface shadow-hair"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <Icon size={14} className="relative z-10" />
                <span className="relative z-10">{t.label}</span>
                {isEmergencies && activeSosCount > 0 && (
                  <span className="num relative z-10 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-extrabold text-white">
                    {activeSosCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {sosAlarmActive && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setMuted(!muted)}
            className="btn h-8 w-8 shrink-0 border-crimson/40 !px-0 text-crimson hover:border-crimson hover:bg-crimson-tint"
            title={muted ? 'Unmute SOS siren (M)' : 'Mute SOS siren (M) — muting does NOT resolve the alert'}
            aria-label={muted ? 'Unmute SOS siren' : 'Mute SOS siren'}
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </motion.button>
        )}

        <button
          onClick={openAuthModal}
          className={`btn h-8 shrink-0 ${operator ? 'border-forest/35 bg-forest-tint text-forest hover:bg-forest-tint' : ''}`}
          title={operator ? `Signed in as ${operator.email}` : 'Sign in as authorized Basecamp operator'}
        >
          {operator ? <ShieldCheck size={14} /> : <Lock size={13} />}
          <span className="hidden max-w-[110px] truncate sm:inline">{operator ? operator.displayName : 'Operator'}</span>
        </button>
      </div>
    </header>
  );
}
