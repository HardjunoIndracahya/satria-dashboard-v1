import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, Copy, Download, ExternalLink, Eye, Phone, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatedNumber, IncidentStatePill, LinkPill, SignalBars, StatusPill } from '../ui';
import { useAuth } from '../../store/auth';
import { useConfig } from '../../store/config';
import { useSos } from '../../store/sos';
import { useTelemetry } from '../../store/telemetry';
import { useUi } from '../../store/ui';
import { useNow } from '../../hooks';
import { canManageEmergencies } from '../../lib/rbac';
import { acknowledgeSosIncident } from '../../lib/sosService';
import { HYPOTHERMIA_C, WEAK_RSSI, formatAgo, formatDateTime, formatDuration, nearestNode } from '../../lib/format';
import { bearingDeg, distanceM, formatBearing, formatCoord, formatDelta, formatDistance, googleMapsUrl } from '../../lib/geo';
import { download, hikerToGpx, packetsToCsv } from '../../lib/export';
import type { Hiker, SosIncident } from '../../types';

function Stat({ label, children, warn = false }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-0.5 text-[13px] ${warn ? 'font-semibold text-amber' : 'text-ink'}`}>{children}</div>
    </div>
  );
}

function ExportMenu({ hiker }: { hiker: Hiker }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button className="btn w-full" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Download size={14} />
        Export GPX / CSV
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-ctl border border-line bg-surface shadow-float"
          >
            <button
              role="menuitem"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] font-medium hover:bg-canvas"
              onClick={() => {
                download(`${hiker.id}_track.gpx`, hikerToGpx(hiker), 'application/gpx+xml');
                toast.success('GPX exported', { description: `${hiker.track.length} track points` });
                setOpen(false);
              }}
            >
              GPX track <span className="num text-[11px] text-ink-muted">.gpx</span>
            </button>
            <button
              role="menuitem"
              className="flex w-full items-center justify-between border-t border-line px-3 py-2 text-left text-[12.5px] font-medium hover:bg-canvas"
              onClick={() => {
                download(`${hiker.id}_telemetry.csv`, packetsToCsv(hiker.track), 'text/csv');
                toast.success('CSV exported', { description: `${hiker.track.length} packets` });
                setOpen(false);
              }}
            >
              Telemetry table <span className="num text-[11px] text-ink-muted">.csv</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Inspector({ hiker }: { hiker: Hiker | null }) {
  const nodes = useConfig((s) => s.nodes);
  const pairing = useConfig((s) => (hiker ? s.pairings[hiker.id] : undefined));
  const sosIncident = useSos((s) => (hiker ? s.active[hiker.id] : undefined));
  const pending = useSos((s) => (hiker ? s.pending[hiker.id] : undefined));
  const operator = useAuth((s) => s.user);
  const connectionState = useTelemetry((s) => s.connectionState);
  const select = useUi((s) => s.select);
  const scrubIndex = useUi((s) => s.scrubIndex);
  const setScrub = useUi((s) => s.setScrub);
  const setView = useUi((s) => s.setView);
  const openRescueModal = useUi((s) => s.openRescueModal);
  const [copied, setCopied] = useState(false);
  const canRespond = canManageEmergencies(operator?.role);

  const handleAck = async () => {
    if (!sosIncident || !canRespond || !operator) return;
    try {
      await acknowledgeSosIncident(sosIncident, operator);
      toast.success(`SOS acknowledged for ${sosIncident.device_id}`, {
        description: 'Alert remains visible until rescue is confirmed.',
      });
    } catch (error) {
      toast.error('Acknowledge failed', { description: error instanceof Error ? error.message : 'Firebase error' });
    }
  };

  return (
    <AnimatePresence mode="wait">
      {hiker && (
        <motion.aside
          key={hiker.id}
          initial={{ opacity: 0, x: -14, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="scroll-thin pointer-events-auto min-h-0 w-[min(316px,calc(100vw-72px))] overflow-y-auto rounded-panel border border-line bg-surface shadow-float sm:w-[316px]"
          aria-label={`Inspector ${hiker.id}`}
        >
          <InspectorBody
            hiker={hiker}
            pairing={pairing}
            sosIncident={sosIncident}
            busy={Boolean(pending)}
            canRespond={canRespond}
            disconnected={connectionState !== 'connected'}
            nodes={nodes}
            scrubIndex={scrubIndex}
            copied={copied}
            onCopy={() => {
              const p = scrubIndex !== null ? (hiker.track[scrubIndex] ?? hiker.latest) : hiker.latest;
              const text = formatCoord(p);
              const done = () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
                toast.success('Coordinates copied', { description: text });
              };
              if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => toast.error('Clipboard unavailable'));
              else toast.error('Clipboard unavailable');
            }}
            onClose={() => select(null)}
            onAck={handleAck}
            onResolve={() => canRespond && openRescueModal(hiker.id)}
            onLive={() => setScrub(null)}
            onSetupNodes={() => setView('nodes')}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function InspectorBody({
  hiker,
  pairing,
  sosIncident,
  busy,
  canRespond,
  disconnected,
  nodes,
  scrubIndex,
  copied,
  onCopy,
  onClose,
  onAck,
  onResolve,
  onLive,
  onSetupNodes,
}: {
  hiker: Hiker;
  pairing?: ReturnType<typeof useConfig.getState>['pairings'][string];
  sosIncident?: SosIncident;
  busy: boolean;
  canRespond: boolean;
  disconnected: boolean;
  nodes: ReturnType<typeof useConfig.getState>['nodes'];
  scrubIndex: number | null;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  onAck: () => void;
  onResolve: () => void;
  onLive: () => void;
  onSetupNodes: () => void;
}) {
  const now = useNow(1000);
  const shown = scrubIndex !== null ? (hiker.track[scrubIndex] ?? hiker.latest) : hiker.latest;
  const playback = scrubIndex !== null;
  const base = nearestNode(
    nodes.filter((n) => n.active && n.type === 'basecamp'),
    hiker.latest,
  );
  const dist = base ? distanceM(base, hiker.latest) : null;
  const brg = base ? bearingDeg(base, hiker.latest) : null;
  const delta = base && base.elevation !== undefined ? hiker.latest.alt - base.elevation : null;

  const cold = shown.temp < HYPOTHERMIA_C;
  const weak = shown.rssi !== undefined && shown.rssi <= WEAK_RSSI;
  const isSos = Boolean(sosIncident) || hiker.status === 'SOS';
  const [hh, mm] = (pairing?.descentTime ?? '').split(':').map(Number);
  const overdue = (() => {
    if (!pairing?.descentTime || Number.isNaN(hh) || Number.isNaN(mm)) return false;
    const t = new Date();
    t.setHours(hh, mm, 0, 0);
    return Date.now() > t.getTime();
  })();

  return (
    <>
      <header className={`flex items-start justify-between gap-3 border-b px-3.5 py-3 ${isSos ? 'border-crimson/30 bg-crimson-tint' : 'border-line'}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="num truncate text-[15px] font-bold">{hiker.id}</h3>
            <StatusPill status={hiker.status} />
            <LinkPill link={hiker.link} />
          </div>
          {(pairing?.leader || pairing?.groupSize) && (
            <p className="mt-1 truncate text-[12px] text-ink-2">
              {pairing.leader || 'Unassigned'}
              {pairing.groupSize ? ` · group of ${pairing.groupSize}` : ''}
            </p>
          )}
        </div>
        <button className="btn btn-ghost -mr-1.5 -mt-1 h-7 w-7 shrink-0 !px-0" onClick={onClose} aria-label="Close inspector">
          <X size={15} />
        </button>
      </header>

      {sosIncident && (
        <div className="border-b border-crimson/30 bg-crimson-tint/70 px-3.5 py-2.5 text-[11.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-crimson">
              <ShieldAlert size={13} /> Persistent SOS Incident
            </span>
            <IncidentStatePill state={sosIncident.state} />
          </div>
          <div className="num mt-1 text-[11px] text-ink-2">{sosIncident.incident_id}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-ink-2">
            <span>Triggered: {formatDateTime(sosIncident.triggered_at)}</span>
            <span className="num font-bold text-crimson">{formatDuration(now - sosIncident.triggered_at)}</span>
          </div>
          {hiker.status === 'NORMAL' && (
            <div className="mt-1 font-medium text-crimson">TX returned to NORMAL — alert stays locked until rescued.</div>
          )}
          {sosIncident.acknowledged_by && (
            <div className="mt-1 text-amber-ink">Ack by: {sosIncident.acknowledged_by}</div>
          )}
        </div>
      )}

      {playback && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3.5 py-1.5">
          <span className="num text-[11px] text-ink-2">
            PLAYBACK · {formatDateTime(shown.ts)} · pkt {scrubIndex + 1}/{hiker.track.length}
          </span>
          <button className="text-[11px] font-semibold text-forest hover:underline" onClick={onLive}>
            Back to live
          </button>
        </div>
      )}

      <div className="space-y-3 px-3.5 py-3">
        <Stat label="Coordinates (Lat, Lon)">
          <span className="num text-[13px] font-medium">{formatCoord(shown)}</span>
        </Stat>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Altitude">
            <AnimatedNumber value={shown.alt} decimals={1} /> <span className="num text-[11px] text-ink-muted">MDPL</span>
          </Stat>
          <Stat label="Temp" warn={cold}>
            <AnimatedNumber value={shown.temp} decimals={1} />
            <span className="num text-[11px]">°C</span>
            {cold && <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-ink">Hypothermia risk</div>}
          </Stat>
          <Stat label="RSSI / SNR" warn={weak}>
            <div className="flex items-center gap-1.5">
              <SignalBars rssi={shown.rssi} />
            </div>
            <div className="num mt-0.5 text-[11.5px]">
              {shown.rssi !== undefined ? `${shown.rssi} dBm` : '—'}
              {shown.snr !== undefined ? ` / ${shown.snr} dB` : ''}
            </div>
          </Stat>
        </div>

        <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
          <span>
            Last packet <span className="num text-ink-2">{formatAgo(hiker.silentMs)}</span>
            <span className="num text-ink-muted"> · {formatDateTime(hiker.latest.ts)}</span>
            {hiker.latest.tsSource === 'ingest' && <span title="No packet timestamp — using time first received"> *</span>}
          </span>
          <span className="num">{hiker.track.length} pkts</span>
        </div>

        <div className="rounded-ctl border border-line bg-canvas/70 p-2.5">
          <div className="label mb-1.5">Geodesic vector{base ? ` · from ${base.name}` : ''}</div>
          {base && dist !== null && brg !== null ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Distance">
                <span className="num">{formatDistance(dist)}</span>
              </Stat>
              <Stat label="Bearing">
                <span className="num">{formatBearing(brg)}</span>
              </Stat>
              <Stat label="Δ MDPL">
                <span className="num">{delta !== null ? formatDelta(delta) : '—'}</span>
              </Stat>
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-ink-2">
              No active Basecamp node.{' '}
              <button className="font-semibold text-forest hover:underline" onClick={onSetupNodes}>
                Set one in Relay Nodes
              </button>{' '}
              to enable the rescue vector.
            </p>
          )}
        </div>

        {(pairing?.contact || pairing?.descentTime) && (
          <div className="grid grid-cols-2 gap-3">
            {pairing.descentTime && (
              <Stat label="Target descent" warn={overdue && !isSos}>
                <span className="num">{pairing.descentTime}</span>
                {overdue && <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-ink">Overdue</span>}
              </Stat>
            )}
            {pairing.contact && (
              <Stat label="Emergency contact">
                <a className="num inline-flex items-center gap-1 hover:text-forest hover:underline" href={`tel:${pairing.contact.replace(/\s+/g, '')}`}>
                  <Phone size={11} />
                  {pairing.contact}
                </a>
              </Stat>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        {sosIncident && canRespond && sosIncident.state === 'ACTIVE' && (
          <button className="btn btn-danger col-span-2 h-9" disabled={busy || disconnected} onClick={onAck}>
            <CheckCircle2 size={14} />
            Acknowledge SOS
          </button>
        )}
        {sosIncident && canRespond && (
          <button className="btn btn-primary col-span-2 h-9" disabled={busy} onClick={onResolve}>
            <ShieldCheck size={14} />
            Mark as Rescued
          </button>
        )}
        {sosIncident && !canRespond && (
          <div className="col-span-2 flex items-center justify-center gap-1.5 rounded-ctl border border-line bg-canvas px-3 py-1.5 text-[11.5px] font-semibold text-ink-2">
            <Eye size={13} />
            Viewer (Read-Only) — SOS actions restricted
          </div>
        )}
        <button className="btn" onClick={onCopy}>
          {copied ? <Check size={14} className="text-forest" /> : <Copy size={14} />}
          Copy Coordinates
        </button>
        <a className="btn" href={googleMapsUrl(shown)} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          Open in Google Maps
        </a>
        <div className="col-span-2">
          <ExportMenu hiker={hiker} />
        </div>
      </div>
    </>
  );
}
