import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Crosshair,
  ExternalLink,
  History,
  Lock,
  Search,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { IncidentStatePill, LinkPill, Modal, StatusPill } from '../components/ui';
import { useAuth } from '../store/auth';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { acknowledgeSosIncident } from '../lib/sosService';
import { formatAgo, formatDateTime, formatDuration } from '../lib/format';
import { googleMapsUrl } from '../lib/geo';
import type { Hiker, SosHistoryIncident, SosIncident } from '../types';

function MetricCell({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-ctl border border-line bg-surface px-2.5 py-2">
      <div className="label">{label}</div>
      <div className={`num mt-0.5 text-[12.5px] font-semibold ${warn ? 'text-amber-ink' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function ActiveIncidentCard({ incident, hiker, now }: { incident: SosIncident; hiker?: Hiker; now: number }) {
  const operator = useAuth((s) => s.user);
  const pairing = useConfig((s) => s.pairings[incident.device_id]);
  const pending = useSos((s) => s.pending[incident.device_id]);
  const connectionState = useTelemetry((s) => s.connectionState);
  const focusHiker = useUi((s) => s.focusHiker);
  const openRescueModal = useUi((s) => s.openRescueModal);
  const openAuthModal = useUi((s) => s.openAuthModal);

  const isUnacked = incident.state === 'ACTIVE';
  const disconnected = connectionState !== 'connected';
  const busy = Boolean(pending);

  const lat = hiker?.latest.lat ?? incident.latitude;
  const lon = hiker?.latest.lon ?? incident.longitude;
  const alt = hiker?.latest.alt ?? incident.altitude;
  const temp = hiker?.latest.temp ?? incident.temperature;
  const rssi = hiker?.latest.rssi ?? incident.rssi ?? undefined;
  const snr = hiker?.latest.snr ?? incident.snr ?? undefined;

  const handleAck = async () => {
    if (!operator) {
      toast.info('Operator sign-in required to acknowledge SOS.');
      openAuthModal();
      return;
    }
    try {
      await acknowledgeSosIncident(incident, operator);
      toast.success(`Acknowledged ${incident.device_id}`, {
        description: 'Emergency remains visible until rescue is confirmed.',
      });
    } catch (error) {
      toast.error('Acknowledge failed', { description: error instanceof Error ? error.message : 'Firebase error' });
    }
  };

  return (
    <article
      className={`overflow-hidden rounded-panel border-2 bg-surface shadow-float ${
        isUnacked ? 'border-crimson' : 'border-amber'
      }`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${
          isUnacked ? 'border-crimson/30 bg-crimson-tint' : 'border-amber/35 bg-amber-tint'
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-ctl ${
              isUnacked ? 'bg-crimson text-white' : 'bg-amber text-white'
            }`}
          >
            {isUnacked && <span className="absolute inset-0 animate-ping rounded-ctl bg-crimson/40" />}
            <ShieldAlert size={17} className="relative" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="num text-[16px] font-extrabold">{incident.device_id}</h3>
              {pairing?.leader && <span className="text-[13px] font-medium text-ink-2">· {pairing.leader}</span>}
              <IncidentStatePill state={incident.state} />
            </div>
            <div className="num mt-0.5 text-[11px] text-ink-2">
              Incident: <span className="font-semibold text-ink">{incident.incident_id}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-ctl border border-line bg-surface px-2.5 py-1 text-right">
            <div className="label">Elapsed since SOS</div>
            <div className="num text-[14px] font-extrabold text-crimson">{formatDuration(now - incident.triggered_at)}</div>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {/* Explicit separation between Persistent Incident Status and Current Transmitter Telemetry */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-ctl border border-line bg-canvas px-3 py-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Current transmitter status:</span>
            {hiker ? (
              <>
                <StatusPill status={hiker.status} />
                <LinkPill link={hiker.link} />
                {hiker.status === 'NORMAL' && (
                  <span className="text-[11.5px] font-medium text-crimson">
                    Button released — SOS alert stays locked until rescue confirmation
                  </span>
                )}
              </>
            ) : (
              <span className="text-ink-muted">No live telemetry packet in session (loaded from persistent Firebase incident)</span>
            )}
          </div>
          <span className="num text-[11px] text-ink-muted">
            Last SOS pkt: {formatDateTime(incident.last_sos_at)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCell label="Triggered at" value={formatDateTime(incident.triggered_at)} />
          <MetricCell label="Coordinates" value={lat !== null && lon !== null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : '—'} />
          <MetricCell label="Altitude" value={alt !== null ? `${alt.toFixed(1)} m` : '—'} />
          <MetricCell label="Temperature" value={temp !== null ? `${temp.toFixed(1)} °C` : '—'} warn={temp !== null && temp < 15} />
          <MetricCell label="RSSI" value={rssi !== undefined ? `${rssi} dBm` : '—'} warn={rssi !== undefined && rssi <= -105} />
          <MetricCell label="SNR" value={snr !== undefined ? `${snr} dB` : '—'} />
        </div>

        {incident.state === 'ACKNOWLEDGED' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-ctl border border-amber/40 bg-amber-tint px-3 py-2 text-[12px] text-amber-ink">
            <span>
              <strong>Acknowledged by:</strong> {incident.acknowledged_by ?? 'Basecamp Operator'}
            </span>
            {incident.acknowledged_at && (
              <span className="num text-[11.5px]">
                {formatDateTime(incident.acknowledged_at)} ({formatAgo(now - incident.acknowledged_at)})
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => focusHiker(incident.device_id)}>
              <Crosshair size={14} />
              Focus on Map
            </button>
            {lat !== null && lon !== null && (
              <a className="btn" href={googleMapsUrl({ lat, lon })} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
                Google Maps
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isUnacked && (
              <button
                className="btn btn-danger h-9"
                disabled={busy || disconnected}
                onClick={handleAck}
              >
                {!operator && <Lock size={13} />}
                <CheckCircle2 size={14} />
                {pending === 'ack' ? 'Acknowledging…' : 'ACKNOWLEDGE'}
              </button>
            )}
            <button
              className="btn btn-primary h-9"
              disabled={busy}
              onClick={() => {
                if (!operator) {
                  toast.info('Sign in as an authorized Basecamp operator to mark hiker as rescued.');
                  openAuthModal();
                  return;
                }
                openRescueModal(incident.device_id);
              }}
            >
              {!operator ? <Lock size={13} /> : <ShieldCheck size={14} />}
              MARK AS RESCUED
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function EmergenciesView({ incidents, hikers }: { incidents: SosIncident[]; hikers: Hiker[] }) {
  const history = useSos((s) => s.history);
  const sosError = useSos((s) => s.error);
  const connectionState = useTelemetry((s) => s.connectionState);
  const operator = useAuth((s) => s.user);
  const openAuthModal = useUi((s) => s.openAuthModal);
  const now = useNow(1000);

  const [search, setSearch] = useState('');
  const [inspected, setInspected] = useState<SosHistoryIncident | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.device_id.toLowerCase().includes(q) ||
        h.incident_id.toLowerCase().includes(q) ||
        h.resolved_by.toLowerCase().includes(q) ||
        (h.resolution_note ?? '').toLowerCase().includes(q),
    );
  }, [history, search]);

  const requestNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === 'granted') toast.success('Browser SOS notifications enabled');
    else toast.warning('Browser notifications were not granted');
  };

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        {/* Top control bar */}
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div>
            <h1 className="flex items-center gap-2 text-[15px] font-extrabold">
              <ShieldAlert size={17} className={incidents.length > 0 ? 'text-crimson' : 'text-forest'} />
              Persistent SOS Emergency Center
            </h1>
            <p className="mt-0.5 text-[12px] text-ink-2">
              Active SOS alerts stay locked in Firebase even if the transmitter returns to NORMAL, until an operator confirms rescue.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notifPerm !== 'unsupported' && (
              <button
                className="btn"
                onClick={requestNotif}
                disabled={notifPerm === 'granted'}
                title="Desktop notifications for new SOS incidents"
              >
                {notifPerm === 'granted' ? <Bell size={14} className="text-forest" /> : <BellOff size={14} />}
                {notifPerm === 'granted' ? 'Alerts Enabled' : 'Enable Browser Alerts'}
              </button>
            )}
            <button className={operator ? 'btn' : 'btn btn-primary'} onClick={openAuthModal}>
              {operator ? <ShieldCheck size={14} className="text-forest" /> : <Lock size={14} />}
              {operator ? `Operator: ${operator.displayName}` : 'Operator Sign In'}
            </button>
          </div>
        </div>

        {connectionState !== 'connected' && (
          <div className="flex items-start gap-2.5 rounded-panel border border-amber/40 bg-amber-tint px-4 py-3 text-[12.5px] text-amber-ink">
            <WifiOff size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>Firebase connection interrupted ({connectionState}).</strong> Unresolved emergency alerts are preserved on screen and will resynchronize automatically when reconnected. Rescue confirmations require an active connection.
            </span>
          </div>
        )}

        {sosError && (
          <div className="flex items-start gap-2.5 rounded-panel border border-crimson/35 bg-crimson-tint px-4 py-3 text-[12.5px] text-crimson">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{sosError}</span>
          </div>
        )}

        {/* Active Unresolved SOS Incidents */}
        <section aria-label="Active Emergency Alerts" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[14px] font-bold">
              Active Emergency Alerts
              <span
                className={`num rounded-chip px-2 py-0.5 text-[11px] font-bold ${
                  incidents.length > 0 ? 'bg-crimson text-white' : 'bg-forest-tint text-forest'
                }`}
              >
                {incidents.length}
              </span>
            </h2>
          </div>

          {incidents.length === 0 ? (
            <div className="panel flex items-center gap-3 px-4 py-6 text-[13px] text-ink-2">
              <CheckCircle2 size={20} className="shrink-0 text-forest" />
              <div>
                <div className="font-semibold text-ink">No active emergency incidents</div>
                <div className="text-[12px] text-ink-muted">
                  Listening to <code className="num">/sos_active</code> in real time. Any SOS trigger will latch here immediately.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <ActiveIncidentCard
                  key={inc.incident_id}
                  incident={inc}
                  hiker={hikers.find((h) => h.id === inc.device_id)}
                  now={now}
                />
              ))}
            </div>
          )}
        </section>

        {/* Emergency History */}
        <section aria-label="Emergency History" className="panel overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-[14px] font-bold">
                <History size={15} />
                Emergency History
                <span className="num rounded-chip bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                  {history.length}
                </span>
              </h2>
              <p className="mt-0.5 text-[11.5px] text-ink-2">
                Permanently archived resolved incidents from <code className="num">/sos_history</code>. Click a row to inspect details.
              </p>
            </div>
            <div className="relative w-full sm:w-[240px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                className="field !pl-8"
                placeholder="Search hiker, incident, operator…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search emergency history"
              />
            </div>
          </header>

          <div className="scroll-thin overflow-x-auto">
            {history.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] text-ink-2">No resolved SOS incidents recorded yet.</p>
            ) : filteredHistory.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] text-ink-2">No historical incidents match your search.</p>
            ) : (
              <table className="w-full min-w-[920px] border-collapse text-[12.5px]">
                <thead className="bg-canvas">
                  <tr className="border-b border-line text-left">
                    <th className="label px-4 py-2">Hiker ID</th>
                    <th className="label px-3 py-2">Incident ID</th>
                    <th className="label px-3 py-2">Trigger Time</th>
                    <th className="label px-3 py-2">Resolution Time</th>
                    <th className="label px-3 py-2">Duration</th>
                    <th className="label px-3 py-2">Resolved By</th>
                    <th className="label px-3 py-2">Resolution Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr
                      key={`${item.device_id}-${item.incident_id}`}
                      tabIndex={0}
                      onClick={() => setInspected(item)}
                      onKeyDown={(e) => e.key === 'Enter' && setInspected(item)}
                      className="cursor-pointer border-b border-line transition-colors hover:bg-canvas"
                    >
                      <td className="num px-4 py-2.5 font-bold">{item.device_id}</td>
                      <td className="num px-3 py-2.5 text-[11.5px] text-ink-2">{item.incident_id}</td>
                      <td className="num whitespace-nowrap px-3 py-2.5">{item.triggered_at ? formatDateTime(item.triggered_at) : '—'}</td>
                      <td className="num whitespace-nowrap px-3 py-2.5">{formatDateTime(item.resolved_at)}</td>
                      <td className="num whitespace-nowrap px-3 py-2.5 font-semibold text-forest">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          {item.triggered_at ? formatDuration(item.resolved_at - item.triggered_at) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{item.resolved_by}</td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 text-ink-2">{item.resolution_note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Resolved Incident Detail Modal */}
      <Modal
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
        width={520}
        title={inspected ? `Resolved Incident — ${inspected.device_id}` : 'Incident Details'}
        subtitle={inspected?.incident_id}
      >
        {inspected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <IncidentStatePill state="RESOLVED" />
              {inspected.latitude != null && inspected.longitude != null && (
                <a
                  className="btn"
                  href={googleMapsUrl({ lat: inspected.latitude, lon: inspected.longitude })}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={13} />
                  Open Location in Google Maps
                </a>
              )}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-ctl border border-line bg-canvas/70 p-3 text-[12.5px]">
              <dt className="text-ink-muted">Hiker ID</dt>
              <dd className="num text-right font-bold">{inspected.device_id}</dd>
              <dt className="text-ink-muted">Incident ID</dt>
              <dd className="num text-right">{inspected.incident_id}</dd>
              <dt className="text-ink-muted">Triggered at</dt>
              <dd className="num text-right">{inspected.triggered_at ? formatDateTime(inspected.triggered_at) : '—'}</dd>
              {inspected.acknowledged_at && (
                <>
                  <dt className="text-ink-muted">Acknowledged at</dt>
                  <dd className="num text-right">{formatDateTime(inspected.acknowledged_at)}</dd>
                  <dt className="text-ink-muted">Acknowledged by</dt>
                  <dd className="text-right">{inspected.acknowledged_by ?? '—'}</dd>
                </>
              )}
              <dt className="text-ink-muted">Resolved at</dt>
              <dd className="num text-right font-semibold text-forest">{formatDateTime(inspected.resolved_at)}</dd>
              <dt className="text-ink-muted">Duration</dt>
              <dd className="num text-right font-semibold">
                {inspected.triggered_at ? formatDuration(inspected.resolved_at - inspected.triggered_at) : '—'}
              </dd>
              <dt className="text-ink-muted">Resolved by</dt>
              <dd className="text-right font-medium">{inspected.resolved_by}</dd>
              <dt className="text-ink-muted">Last known GPS</dt>
              <dd className="num text-right">
                {inspected.latitude != null && inspected.longitude != null
                  ? `${inspected.latitude.toFixed(6)}, ${inspected.longitude.toFixed(6)}`
                  : '—'}
              </dd>
              <dt className="text-ink-muted">Altitude / Temp</dt>
              <dd className="num text-right">
                {inspected.altitude != null ? `${inspected.altitude.toFixed(1)} m` : '—'} /{' '}
                {inspected.temperature != null ? `${inspected.temperature.toFixed(1)} °C` : '—'}
              </dd>
            </dl>
            <div className="rounded-ctl border border-line bg-surface p-3">
              <div className="label mb-1">Resolution Note</div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
                {inspected.resolution_note || 'No resolution note provided.'}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
