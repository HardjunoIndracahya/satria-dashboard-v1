import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, ShieldAlert } from 'lucide-react';
import { useConfig } from '../store/config';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { formatElapsed } from '../lib/format';
import type { Hiker } from '../types';

function Elapsed({ since }: { since: number }) {
  const now = useNow(1000);
  return <span className="num font-semibold">{formatElapsed(now - since)}</span>;
}

export function EmergencyBanner({ unacked }: { unacked: Hiker[] }) {
  const pairings = useConfig((s) => s.pairings);
  const ack = useConfig((s) => s.ack);
  const focusHiker = useUi((s) => s.focusHiker);
  const first = unacked[0];

  return (
    <AnimatePresence initial={false}>
      {first && (
        <motion.div
          key="banner"
          role="alert"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 44, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="shrink-0 overflow-hidden bg-crimson text-white"
        >
          <div className="flex h-11 items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3 text-[13px]">
              <ShieldAlert size={18} className="shrink-0" />
              <span className="font-extrabold tracking-[0.08em]">SOS</span>
              <span className="num font-semibold">{first.id}</span>
              {pairings[first.id]?.leader && <span className="truncate font-medium opacity-95">{pairings[first.id].leader}</span>}
              <span className="hidden items-center gap-1.5 opacity-95 md:flex">
                <span className="text-[11px] uppercase tracking-wider opacity-80">Elapsed</span>
                <Elapsed since={first.sosSince ?? first.latest.ts} />
              </span>
              {unacked.length > 1 && (
                <span className="rounded-chip bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">+{unacked.length - 1} more</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => focusHiker(first.id)}
                className="inline-flex h-7 items-center gap-1.5 rounded-ctl border border-white/60 px-2.5 text-[12px] font-semibold transition-colors hover:bg-white/15"
              >
                <Crosshair size={14} />
                Focus on Map
              </button>
              <button
                onClick={() => first.sosKey && ack(first.sosKey, first.id)}
                className="inline-flex h-7 items-center rounded-ctl bg-white px-3 text-[12px] font-bold text-crimson transition-colors hover:bg-crimson-tint"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
