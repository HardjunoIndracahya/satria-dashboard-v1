import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import { useUi } from '../store/ui';
import { formatClock } from '../lib/format';
import type { Hiker, Packet } from '../types';

interface Metric {
  key: 'temp' | 'alt' | 'rssi' | 'snr';
  title: string;
  unit: string;
  color: string;
  pick: (p: Packet) => number | undefined;
}

const METRICS: Metric[] = [
  { key: 'temp', title: 'Temperature', unit: '°C', color: '#D97706', pick: (p) => p.temp },
  { key: 'alt', title: 'Altitude', unit: 'm', color: '#166534', pick: (p) => p.alt },
  { key: 'rssi', title: 'RSSI signal strength', unit: 'dBm', color: '#0F172A', pick: (p) => p.rssi },
  { key: 'snr', title: 'SNR', unit: 'dB', color: '#475569', pick: (p) => p.snr },
];

function ChartCard({ metric, track }: { metric: Metric; track: Packet[] }) {
  const data = useMemo(
    () => track.flatMap((p) => { const v = metric.pick(p); return v === undefined ? [] : [{ ts: p.ts, v }]; }),
    [track, metric],
  );
  const last = data[data.length - 1];
  return (
    <section className="panel p-3" aria-label={metric.title}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[13px] font-bold">{metric.title}</h3>
        <span className="num text-[13px] font-semibold" style={{ color: metric.color }}>
          {last ? `${last.v} ${metric.unit}` : '—'}
        </span>
      </div>
      <div className="h-[200px]">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-ctl border border-dashed border-line-strong bg-canvas/60 px-4 text-center text-[12px] text-ink-2">
            {data.length === 0 ? `This hiker has not reported ${metric.title.toLowerCase()}.` : 'One sample so far — waiting for the next Firebase update to draw a trend.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E7ECE9" vertical={false} />
              <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={{ stroke: '#DCE2DE' }} minTickGap={40} tickFormatter={(t: number) => formatClock(t).slice(0, 8)} fontSize={11} />
              <YAxis width={44} tickLine={false} axisLine={false} domain={['auto', 'auto']} fontSize={11} />
              <Tooltip
                labelFormatter={(t) => formatClock(Number(t))}
                formatter={(v) => [`${v} ${metric.unit}`, metric.title]}
                contentStyle={{ borderRadius: 8, border: '1px solid #DCE2DE', fontSize: 12 }}
              />
              <Line type="monotone" dataKey="v" stroke={metric.color} strokeWidth={2} dot={data.length < 25} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export function AnalyticsView({ hikers }: { hikers: Hiker[] }) {
  const selectedId = useUi((s) => s.selectedId);
  const select = useUi((s) => s.select);
  const hiker = hikers.find((h) => h.id === selectedId) ?? hikers[0] ?? null;

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3">
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <h2 className="text-[14px] font-bold">Data analytics</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-2">Trends of real values received from Firebase for one hiker.</p>
          </div>
          <select
            className="field !w-[200px]"
            aria-label="Select hiker"
            value={hiker?.id ?? ''}
            disabled={hikers.length === 0}
            onChange={(e) => select(e.target.value)}
          >
            {hikers.length === 0 && <option value="">No hikers</option>}
            {hikers.map((h) => (
              <option key={h.id} value={h.id}>{h.id}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 rounded-ctl border border-amber/30 bg-amber-tint px-3 py-2 text-[12px] leading-relaxed text-amber-ink">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Firebase holds only each hiker's latest reading, so long-term history is not stored yet. Charts show the {hiker ? hiker.track.length : 0} update(s) received
            since this page was opened; they reset on reload. Persistent history requires the Basecamp to also write records (e.g. a history node) — not implemented.
          </span>
        </div>

        {hiker ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {METRICS.map((m) => (
              <ChartCard key={m.key} metric={m} track={hiker.track} />
            ))}
          </div>
        ) : (
          <p className="panel px-4 py-14 text-center text-[12.5px] text-ink-2">No hiker data received from Firebase yet.</p>
        )}
      </div>
    </div>
  );
}
