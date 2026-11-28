import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Radio,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Table2,
  UserCog,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from './ui';
import { useAuth } from '../store/auth';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { FIREBASE_STATUS } from '../lib/firebase';
import { signOutUser } from '../lib/firebaseAuth';
import { canManageUsers, ROLE_META } from '../lib/rbac';
import { formatClock } from '../lib/format';
import type { AppView } from '../types';

const BASE_TABS: { id: AppView; label: string; icon: typeof Activity; adminOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'dashboard', label: 'Live Tracking', icon: MapIcon },
  { id: 'emergencies', label: 'Emergencies', icon: ShieldAlert },
  { id: 'hikers', label: 'Hikers', icon: Table2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'nodes', label: 'Relay Nodes', icon: Radio },
  { id: 'log', label: 'System Log', icon: ScrollText },
  { id: 'users', label: 'Users', icon: UserCog, adminOnly: true },
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
      className="group flex h-8 max-w-[200px] items-center gap-2 rounded-full border border-line bg-canvas px-3 text-[12px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:bg-surface"
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

function UserProfileMenu() {
  const user = useAuth((s) => s.user);
  const setView = useUi((s) => s.setView);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;
  const meta = ROLE_META[user.role];

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
      toast('Signed out — local telemetry cleared');
    } catch {
      toast.error('Unable to sign out cleanly');
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn h-8 gap-2 border-line bg-canvas px-2.5 hover:bg-surface"
        title={`${user.displayName} (${user.email}) — ${meta.label}`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest text-[10.5px] font-bold uppercase text-white">
          {user.displayName.slice(0, 1)}
        </span>
        <span className="hidden max-w-[105px] truncate text-[12px] font-semibold text-ink md:inline">{user.displayName}</span>
        <span className={`rounded-chip border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
          {meta.label}
        </span>
        <ChevronDown size={13} className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full z-40 mt-2 w-[272px] overflow-hidden rounded-panel border border-line bg-surface shadow-float"
          >
            <div className="border-b border-line bg-canvas/70 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-bold text-ink">{user.displayName}</div>
                  <div className="num truncate text-[11.5px] text-ink-2">{user.email}</div>
                </div>
                <span className={`shrink-0 rounded-chip border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-forest">
                <ShieldCheck size={12} />
                <span>Account Status: {user.accountStatus}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{meta.description}</p>
            </div>

            <div className="p-2">
              {canManageUsers(user.role) && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setView('users');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-ctl px-2.5 py-2 text-left text-[12.5px] font-semibold text-ink hover:bg-canvas"
                >
                  <UserCog size={14} className="text-ink-2" />
                  Manage Authorized Users
                </button>
              )}
              <button
                role="menuitem"
                disabled={signingOut}
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-ctl px-2.5 py-2 text-left text-[12.5px] font-semibold text-crimson hover:bg-crimson-tint disabled:opacity-60"
              >
                <LogOut size={14} />
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar({ sosAlarmActive, activeSosCount }: { sosAlarmActive: boolean; activeSosCount: number }) {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const role = useAuth((s) => s.user?.role);
  const muted = useConfig((s) => s.muted);
  const setMuted = useConfig((s) => s.setMuted);
  const layoutId = useId();

  const visibleTabs = BASE_TABS.filter((t) => !t.adminOnly || canManageUsers(role));

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
          {visibleTabs.map((t) => {
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

        <UserProfileMenu />
      </div>
    </header>
  );
}
