import { AlertTriangle, CheckCircle2, Database, Radio, ShieldAlert, Signal, WifiOff, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { HikerCard } from '../components/HikerCard';
import { LinkPill, StatusPill } from '../components/ui';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { DATABASE_ROOT, FIREBASE_STATUS, LIVE_WITHIN_MS, OFFLINE_AFTER_MS } from '../lib/firebase';
import { filterCounts } from '../lib/filter';
import { formatAgo, formatClock } from '../lib/format';
import type { Hiker, SidebarFilter } from '../types';

function Kpi({ label, value, tone, icon, onClick }: { label: string; value: number; tone: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="panel group flex items-center gap-3 p-3 text-left transition-colors hover:border-line-strong">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="label block">{label}</span>
        <span className="num block text-[24px] font-bold leading-7">{value}</span>
      </span>
    </button>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[12.5px] last:border-0">
      <span className="text-ink-muted">{k}</span>
      <span className="num text-right">{children}</span>
    </div>
  );
}

export function OverviewView({ hikers }: { hikers: Hiker[] }) {
  const setView = useUi((s) => s.setView);
  const setFilter = useUi((s) => s.setFilter);
  const focusHiker = useUi((s) => s.focusHiker);
  const selectedId = useUi((s) => s.selectedId);
  const openPairing = useUi((s) => s.openPairing);
  const pairings = useConfig((s) => s.pairings);
  const acks = useConfig((s) => s.acks);
  const { connectionState, error, lastSyncAt, total, valid, corrupt, emptyRoot } = useTelemetry();
  const now = useNow(1000);
  const counts = useMemo(() => filterCounts(hikers), [hikers]);
  const sosList = hikers.filter((h) => h.status === 'SOS');

  const go = (f: SidebarFilter) => {
    setFilter(f);
    setView('dashboard');
  };

  const connLabel = !FIREBASE_STATUS.config
    ? 'Not configured'
    : { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected', error: 'Error' }[connectionState];
  const connTone = connectionState === 'connected' && FIREBASE_STATUS.config ? 'text-forest' : connectionState === 'connecting' ? 'text-amber' : 'text-crimson';

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Monitored hikers" value={counts.all} tone="bg-slate2-tint text-ink-2" icon={<Signal size={18} />} onClick={() => go('all')} />
          <Kpi label="Active (live)" value={counts.live} tone="bg-forest-tint text-forest" icon={<CheckCircle2 size={18} />} onClick={() => go('live')} />
          <Kpi label="Delayed" value={counts.delayed} tone="bg-amber-tint text-amber-ink" icon={<Clock size={18} />} onClick={() => go('delayed')} />
          <Kpi label="Offline" value={counts.offline} tone="bg-slate2-tint text-ink-2" icon={<WifiOff size={18} />} onClick={() => go('offline')} />
          <Kpi label="SOS" value={counts.sos} tone="bg-crimson-tint text-crimson" icon={<ShieldAlert size={18} />} onClick={() => go('sos')} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
          <section className="panel p-3" aria-label="Hikers">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[14px] font-bold">Hiker status</h2>
              <button className="btn" onClick={() => setView('dashboard')}>Open live map</button>
            </div>
            {hikers.length === 0 ? (
              <p className="px-2 py-10 text-center text-[12.5px] text-ink-2">
                {!FIREBASE_STATUS.config
                  ? FIREBASE_STATUS.error
                  : error ?? (emptyRoot ? `Connected — no devices under "${DATABASE_ROOT}" yet.` : 'Waiting for hikers with a valid GPS fix…')}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {hikers.map((h) => (
                  <li key={h.id}>
                    <HikerCard
                      hiker={h}
                      pairing={pairings[h.id]}
                      selected={selectedId === h.id}
                      acked={!!h.sosKey && !!acks[h.sosKey]}
                      onSelect={() => focusHiker(h.id)}
                      onEdit={() => openPairing(h.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-3">
            <section className="panel p-3" aria-label="System status">
              <h2 className="mb-1.5 flex items-center gap-2 text-[14px] font-bold">
                <Database size={15} /> System status
              </h2>
              <Row k="Firebase">
                <span className={`font-semibold ${connTone}`}>{connLabel}</span>
              </Row>
              <Row k="Watching">/{DATABASE_ROOT}</Row>
              <Row k="Last data">{lastSyncAt ? `${formatClock(lastSyncAt)} (${formatAgo(now - lastSyncAt)})` : '—'}</Row>
              <Row k="Packets valid / total">{valid} / {total}</Row>
              <Row k="Quarantined">{corrupt}</Row>
              <Row k="LIVE if newer than">{LIVE_WITHIN_MS / 1000}s</Row>
              <Row k="OFFLINE after">{OFFLINE_AFTER_MS / 1000}s</Row>
              {(error || !FIREBASE_STATUS.config) && (
                <p className="mt-2 flex gap-2 rounded-ctl border border-crimson/25 bg-crimson-tint p-2 text-[12px] leading-relaxed text-crimson">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {error ?? FIREBASE_STATUS.error}
                </p>
              )}
              <p className="mt-2 text-[11px] text-ink-muted">Connection is automatic and configured only in firebase-config.js.</p>
            </section>

            <section className="panel p-3" aria-label="Emergencies">
              <h2 className="mb-1.5 flex items-center gap-2 text-[14px] font-bold">
                <Radio size={15} /> Emergencies
              </h2>
              {sosList.length === 0 ? (
                <p className="py-3 text-[12.5px] text-ink-2">No hiker is reporting SOS.</p>
              ) : (
                <ul className="space-y-1.5">
                  {sosList.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => focusHiker(h.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-ctl border border-crimson/30 bg-crimson-tint px-2.5 py-2 text-left"
                      >
                        <span className="num text-[13px] font-bold">{h.id}</span>
                        <span className="flex items-center gap-1.5">
                          <LinkPill link={h.link} />
                          <StatusPill status={h.status} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
