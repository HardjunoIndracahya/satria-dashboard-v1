import { AnimatedNumber } from '../ui';
import { useConfig } from '../../store/config';
import { useTelemetry } from '../../store/telemetry';
import { formatClock } from '../../lib/format';

function Row({ label, children, warn = false }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex h-[27px] items-center justify-between gap-3 border-b border-line/70 last:border-b-0">
      <span className="text-[12px] text-ink-2">{label}</span>
      <span className={`num text-[12.5px] font-medium ${warn ? 'text-amber' : 'text-ink'}`}>{children}</span>
    </div>
  );
}

export function HealthPanel() {
  const { total, valid, corrupt, latencyMs, lastSyncAt } = useTelemetry();
  const nodes = useConfig((s) => s.nodes);
  const mode = useConfig((s) => s.mode);
  const relays = nodes.filter((n) => n.type === 'relay');
  const activeRelays = relays.filter((n) => n.active).length;
  const has = total > 0;
  const pdr = has ? (valid / total) * 100 : 0;
  const loss = has ? (corrupt / total) * 100 : 0;

  return (
    <div className="flex h-full flex-col px-3.5 py-2">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="label">System &amp; LoRa Health</span>
        {lastSyncAt && <span className="num text-[10.5px] text-ink-muted">{formatClock(lastSyncAt)}</span>}
      </div>
      <Row label="Packet Success Rate (PDR %)" warn={has && pdr < 90}>
        {has ? <AnimatedNumber value={pdr} decimals={1} /> : '—'}
        {has && '%'}
      </Row>
      <Row label="Packet Loss / Corrupt (%)" warn={has && loss > 10}>
        {has ? <AnimatedNumber value={loss} decimals={1} /> : '—'}
        {has && '%'}
      </Row>
      <Row label="Sync Latency (s)">
        {mode === 'sheet' && latencyMs !== undefined ? <AnimatedNumber value={latencyMs / 1000} decimals={2} /> : '—'}
      </Row>
      <Row label="Active Relays">
        {relays.length > 0 ? (
          <>
            <AnimatedNumber value={activeRelays} decimals={0} />
            <span className="text-ink-muted"> / {relays.length}</span>
          </>
        ) : (
          '—'
        )}
      </Row>
      <Row label="Valid / Total Rows">
        {has ? (
          <>
            {valid} <span className="text-ink-muted">/</span> {total}
          </>
        ) : (
          '—'
        )}
      </Row>
    </div>
  );
}
