import { useEffect, useState } from 'react';
import { AlertTriangle, Lock, ShieldCheck, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Field, IncidentStatePill, Modal, StatusPill } from './ui';
import { useAuth } from '../store/auth';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { useNow } from '../hooks';
import { canManageEmergencies } from '../lib/rbac';
import { resolveSosIncident } from '../lib/sosService';
import { formatDateTime, formatDuration } from '../lib/format';
import type { Hiker } from '../types';

export function RescueConfirmModal({ hikers }: { hikers: Hiker[] }) {
  const deviceId = useUi((s) => s.rescueTargetId);
  const close = useUi((s) => s.closeRescueModal);
  const incident = useSos((s) => (deviceId ? s.active[deviceId] : undefined));
  const pending = useSos((s) => (deviceId ? s.pending[deviceId] : undefined));
  const operator = useAuth((s) => s.user);
  const canRespond = canManageEmergencies(operator?.role);
  const connectionState = useTelemetry((s) => s.connectionState);
  const pairing = useConfig((s) => (deviceId ? s.pairings[deviceId] : undefined));
  const now = useNow(1000);

  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setConfirmed(false);
    setNote('');
    setSubmitError(null);
  }, [deviceId, incident?.incident_id]);

  const hiker = deviceId ? hikers.find((h) => h.id === deviceId) : undefined;
  const disconnected = connectionState !== 'connected';
  const busy = pending === 'resolve';
  const lat = hiker?.latest.lat ?? incident?.latitude ?? null;
  const lon = hiker?.latest.lon ?? incident?.longitude ?? null;
  const alt = hiker?.latest.alt ?? incident?.altitude ?? null;

  const handleConfirm = async () => {
    if (!incident || !confirmed) return;
    setSubmitError(null);
    try {
      await resolveSosIncident(incident, operator, note, hiker?.latest);
      toast.success(`Rescue confirmed for ${incident.device_id}`, {
        description: `Incident ${incident.incident_id} has been archived in Emergency History.`,
      });
      close();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to resolve incident in Firebase.';
      setSubmitError(msg);
      toast.error('Rescue confirmation failed — alert remains active', { description: msg });
    }
  };

  return (
    <Modal
      open={Boolean(deviceId && incident)}
      onClose={() => !busy && close()}
      width={520}
      title="Confirm Hiker Rescue"
      subtitle="This action resolves the active SOS alert and moves the incident to Emergency History."
      footer={
        <>
          <button className="btn" disabled={busy} onClick={close}>
            Cancel
          </button>
          {canRespond && (
            <button
              className="btn btn-primary"
              disabled={!confirmed || busy || disconnected}
              onClick={handleConfirm}
            >
              <ShieldCheck size={14} />
              {busy ? 'Resolving in Firebase…' : 'Confirm Rescued & Resolve SOS'}
            </button>
          )}
        </>
      }
    >
      {incident && (
        <div className="space-y-4">
          <div className="rounded-ctl border border-crimson/30 bg-crimson-tint p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-crimson" />
              <p className="text-[13px] font-semibold leading-relaxed text-ink">
                Are you sure that hiker <span className="num font-extrabold text-crimson">{incident.device_id}</span> has been successfully rescued and this emergency incident can now be resolved?
              </p>
            </div>
          </div>

          <div className="rounded-ctl border border-line bg-canvas/70 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="num text-[14px] font-bold">{incident.device_id}</span>
                {pairing?.leader && <span className="text-[12px] text-ink-2">· {pairing.leader}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <IncidentStatePill state={incident.state} />
                {hiker && <StatusPill status={hiker.status} />}
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
              <dt className="text-ink-muted">Incident ID</dt>
              <dd className="num text-right font-semibold">{incident.incident_id}</dd>
              <dt className="text-ink-muted">Triggered at</dt>
              <dd className="num text-right">{formatDateTime(incident.triggered_at)}</dd>
              <dt className="text-ink-muted">Duration</dt>
              <dd className="num text-right font-semibold text-crimson">{formatDuration(now - incident.triggered_at)}</dd>
              <dt className="text-ink-muted">Latest GPS</dt>
              <dd className="num text-right">{lat !== null && lon !== null ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : '—'}</dd>
              <dt className="text-ink-muted">Altitude</dt>
              <dd className="num text-right">{alt !== null ? `${alt.toFixed(1)} MDPL` : '—'}</dd>
              {incident.acknowledged_by && (
                <>
                  <dt className="text-ink-muted">Acknowledged by</dt>
                  <dd className="text-right">{incident.acknowledged_by}</dd>
                </>
              )}
            </dl>
          </div>

          {!canRespond && (
            <div className="flex items-start gap-2 rounded-ctl border border-amber/40 bg-amber-tint p-3 text-[12px] leading-relaxed text-amber-ink">
              <Lock size={15} className="mt-0.5 shrink-0" />
              <span>Your role ({operator?.role ?? 'VIEWER'}) is read-only. Only ADMIN or OPERATOR accounts can confirm a rescue.</span>
            </div>
          )}

          {disconnected && (
            <div className="flex items-start gap-2 rounded-ctl border border-crimson/35 bg-crimson-tint p-3 text-[12px] leading-relaxed text-crimson">
              <WifiOff size={15} className="mt-0.5 shrink-0" />
              <span>Firebase is currently disconnected. Wait for reconnection before resolving — the emergency alert cannot be cleared offline.</span>
            </div>
          )}

          {canRespond && operator && (
            <>
              <Field label="Resolution note (optional)" hint={`Recorded with your operator identity: ${operator.displayName} (${operator.email})`}>
                <textarea
                  className="field min-h-[76px] resize-y py-2"
                  placeholder="e.g., Hiker successfully rescued at Pos 2 by SAR Team Alpha and brought to Basecamp."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                />
              </Field>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-ctl border border-line bg-surface p-3 hover:border-line-strong">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5 h-4 w-4 accent-forest"
                />
                <span className="text-[12.5px] font-medium leading-snug text-ink">
                  I confirm that <span className="num font-bold">{incident.device_id}</span> has been physically verified safe/rescued and this SOS incident can be closed.
                </span>
              </label>
            </>
          )}

          {submitError && (
            <p className="rounded-ctl border border-crimson/30 bg-crimson-tint p-2.5 text-[12px] font-medium text-crimson">
              {submitError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
