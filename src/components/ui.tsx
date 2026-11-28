import { useEffect, useId, type ReactNode } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { X } from 'lucide-react';
import type { HikerStatus, LinkState } from '../types';
import { signalLevel } from '../lib/format';

/* ------------------------------- Brand mark ------------------------------- */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#166534" />
      <path d="M4.5 24 12 11l4.2 7 3.3-4.6L27.5 24Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M4.5 24h23" stroke="#86EFAC" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ Status pill ------------------------------- */
const PILL: Record<HikerStatus, string> = {
  SOS: 'bg-crimson text-white border-crimson',
  NORMAL: 'bg-forest-tint text-forest border-forest/25',
  OFFLINE: 'bg-slate2-tint text-ink-2 border-line-strong',
};

export function StatusPill({ status, className = '' }: { status: HikerStatus; className?: string }) {
  return (
    <span
      className={`inline-flex h-[20px] items-center rounded-chip border px-1.5 text-[10.5px] font-bold tracking-[0.05em] ${PILL[status]} ${className}`}
    >
      {status}
    </span>
  );
}

/** Connection state pill (LIVE / DELAYED / OFFLINE) — separate from the NORMAL / SOS condition pill. */
const LINK_PILL: Record<LinkState, string> = {
  LIVE: 'bg-forest-tint text-forest border-forest/25',
  DELAYED: 'bg-amber-tint text-amber-ink border-amber/40',
  OFFLINE: 'bg-slate2-tint text-ink-2 border-line-strong',
};

export function LinkPill({ link, className = '' }: { link: LinkState; className?: string }) {
  const dot = link === 'LIVE' ? 'bg-forest' : link === 'DELAYED' ? 'bg-amber' : 'bg-slate-400';
  return (
    <span
      title={`Connection: ${link}`}
      className={`inline-flex h-[20px] items-center gap-1 rounded-chip border px-1.5 text-[10.5px] font-bold tracking-[0.05em] ${LINK_PILL[link]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {link}
    </span>
  );
}

/* ------------------------------- Signal bars ------------------------------ */
export function SignalBars({ rssi, className = '' }: { rssi?: number; className?: string }) {
  const level = signalLevel(rssi);
  const color = rssi === undefined ? '#C5CEC9' : level >= 3 ? '#166534' : '#D97706';
  return (
    <span className={`inline-flex h-3.5 items-end gap-[2px] ${className}`} role="img" aria-label={rssi === undefined ? 'No signal data' : `Signal ${level} of 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{ height: 4 + i * 3, background: i < level ? color : '#DCE2DE' }}
        />
      ))}
    </span>
  );
}

/* ----------------------------- Animated number ---------------------------- */
export function AnimatedNumber({ value, decimals = 1, className = '' }: { value: number; decimals?: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={`num ${className}`}>{text}</motion.span>;
}

/* -------------------------------- Segmented ------------------------------- */
export interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
  count?: number;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
  className = '',
  ariaLabel,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  const layoutId = useId();
  const h = size === 'sm' ? 'h-[26px] text-[11.5px]' : 'h-8 text-[12.5px]';
  return (
    <div role="tablist" aria-label={ariaLabel} className={`inline-flex items-center gap-0.5 rounded-ctl border border-line bg-canvas p-0.5 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative ${h} rounded-[6px] px-2.5 font-semibold transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[6px] border border-line bg-surface shadow-hair"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined && <span className="num text-[10.5px] text-ink-muted">{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Modal --------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 640,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-float"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
              <div>
                <h2 className="text-[15px] font-bold leading-tight">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[12px] text-ink-2">{subtitle}</p>}
              </div>
              <button className="btn btn-ghost -mr-2 h-8 w-8 !px-0" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------- Tiny layout helpers -------------------------- */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-medium text-amber-ink">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>
      )}
    </label>
  );
}
