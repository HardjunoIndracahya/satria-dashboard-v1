import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Crosshair, ExternalLink, Lock, ShieldAlert, ShieldCheck, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../store/auth';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { acknowledgeSosIncident } from '../lib/sosService';
import { formatElapsed } from '../lib/format';
import type { Hiker, SosIncident } from '../types';

function Elapsed({ since }: { since: number }) {
  const now = useNow(1000);
  return <span className="num font-semibold">{formatElapsed(now - since)}</span>;
}

/**
 * Persistent top emergency banner.
 * Remains visible for BOTH `ACTIVE` and `ACKNOWLEDGED` incidents, even if the hiker's
 * latest transmitter telemetry returns to `NORMAL`. Only clears after rescue confirmation.
 */
export function EmergencyBanner({ incidents, hikers }: { incidents: SosIncident[]; hikers: Hiker[] }) {
  const pairings = useConfig((s) => s.pairings);
  const operator = useAuth((s) => s.user);
  const pending = useSos((s) => s.pending);
  const connectionState = useTelemetry((s) => s.connectionState);
  const focusHiker = useUi((s) => s.focusHiker);
  const openRescueModal = useUi((s) => s.openRescueModal);
  const openAuthModal = useUi((s) => s.openAuthModal);
  const setView = useUi((s) => s.setView);

  const first = incidents[0];
  const hiker = first ? hikers.find((h) => h.id === first.device_id) : undefined;
  const isUnacked = first?.state === 'ACTIVE';
  const busy = first ? Boolean(pending[first.device_id]) : false;
  const disconnected = connectionState !== 'connected';

  const handleAck = async () => {
    if (!first) return;
    if (!operator) {
      toast.info('Basecamp operator sign-in required to acknowledge an SOS alert.');
      openAuthModal();
      return;
    }
    try {
      await acknowledgeSosIncident(first, operator);
      toast.success(`SOS acknowledged for ${first.device_id}`, {
        description: 'Incident remains active until rescue is confirmed.',
      });
    } catch (error) {
      toast.error('Unable to acknowledge SOS', {
        description: error instanceof Error ? error.message : 'Firebase write failed.',
      });
    }
  };

  return (
    <AnimatePresence initial={false}>
      {first && (
        <motion.div
          key="persistent-sos-banner"
          role="alert"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className={`shrink-0 overflow-hidden ${isUnacked ? 'bg-crimson text-white' : 'border-b border-crimson/40 bg-[#7F1D1D] text-white'}`}
        >
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-3 py-1.5 md:px-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                {isUnacked && <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />}
                <ShieldAlert size={17} className="relative" />
              </span>
              <span className="rounded-chip bg-white/20 px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-[0.08em]">
                {isUnacked ? 'ACTIVE SOS' : 'ACKNOWLEDGED SOS'}
              </span>
              <span className="num font-bold">{first.device_id}</span>
              {pairings[first.device_id]?.leader && <span className="truncate font-medium opacity-95">{pairings[first.device_id].leader}</span>}
              <span className="num hidden text-[11px] opacity-85 lg:inline">({first.incident_id})</span>
              {hiker && (
                <span
                  className={`rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold ${
                    hiker.status === 'NORMAL' ? 'bg-white/15 text-white' : 'bg-white text-crimson'
                  }`}
                  title="Current transmitter telemetry status (separate from persistent SOS incident)"
                >
                  TX: {hiker.status}
                </span>
              )}
              <span className="hidden items-center gap-1.5 opacity-95 sm:flex">
                <span className="text-[10.5px] uppercase tracking-wider opacity-80">Elapsed</span>
                <Elapsed since={first.triggered_at} />
              </span>
              {incidents.length > 1 && (
                <button
                  onClick={() => setView('emergencies')}
                  className="rounded-chip bg-white/25 px-1.5 py-0.5 text-[11px] font-bold hover:bg-white/35"
                >
                  +{incidents.length - 1} more active
                </button>
              )}
              {disconnected && (
                <span className="inline-flex items-center gap-1 rounded-chip bg-amber px-1.5 py-0.5 text-[10.5px] font-bold text-ink">
                  <WifiOff size={11} /> Offline — alert preserved
                </span>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <button
                onClick={() => focusHiker(first.device_id)}
                className="inline-flex h-7 items-center gap-1 rounded-ctl border border-white/60 px-2.5 text-[11.5px] font-semibold transition-colors hover:bg-white/15"
              >
                <Crosshair size={13} />
                Focus Map
              </button>
              <button
                onClick={() => setView('emergencies')}
                className="inline-flex h-7 items-center gap-1 rounded-ctl border border-white/50 px-2.5 text-[11.5px] font-semibold transition-colors hover:bg-white/15"
              >
                <ExternalLink size={12} />
                Alerts ({incidents.length})
              </button>
              {isUnacked && (
                <button
                  disabled={busy || disconnected}
                  onClick={handleAck}
                  className="inline-flex h-7 items-center gap-1 rounded-ctl bg-white px-2.5 text-[11.5px] font-bold text-crimson transition-colors hover:bg-crimson-tint disabled:opacity-60"
                >
                  {!operator && <Lock size={11} />}
                  <CheckCircle2 size={13} />
                  {busy ? 'Saving…' : 'Acknowledge'}
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  if (!operator) {
                    toast.info('Sign in as an authorized Basecamp operator to confirm rescue.');
                    openAuthModal();
                    return;
                  }
                  openRescueModal(first.device_id);
                }}
                className="inline-flex h-7 items-center gap-1 rounded-ctl border border-white bg-forest px-2.5 text-[11.5px] font-bold text-white transition-colors hover:bg-forest-hover disabled:opacity-60"
              >
                {!operator ? <Lock size={11} /> : <ShieldCheck size={13} />}
                Mark as Rescued
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
