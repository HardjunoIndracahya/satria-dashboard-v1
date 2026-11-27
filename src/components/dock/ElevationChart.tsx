import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useUi } from '../../store/ui';
import { formatClock } from '../../lib/format';
import type { Hiker } from '../../types';

interface Row {
  i: number;
  alt: number;
  temp: number;
  ts: number;
  sos: boolean;
}

export function ElevationChart({ hiker }: { hiker: Hiker | null }) {
  const gradId = useId().replace(/:/g, '');
  const scrub = useUi((s) => s.scrubIndex);
  const setScrub = useUi((s) => s.setScrub);

  const data = useMemo<Row[]>(
    () => (hiker ? hiker.track.map((p, i) => ({ i, alt: p.alt, temp: p.temp, ts: p.ts, sos: p.status === 'SOS' })) : []),
    [hiker],
  );

  if (!hiker || data.length === 0) {
    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-x-8 bottom-6 top-3 border-b border-l border-line">
          {[25, 50, 75].map((p) => (
            <div key={p} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${p}%` }} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-ctl bg-surface px-3 py-1 text-[12.5px] text-ink-2">Select a hiker to plot MDPL over received packets</p>
        </div>
      </div>
    );
  }

  const active = scrub !== null ? data[scrub] : undefined;
  const single = data.length === 1;

  return (
    <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
          onMouseMove={(s) => {
            const idx = s?.activeTooltipIndex;
            if (idx !== undefined && idx !== null) setScrub(Number(idx));
          }}
          onMouseLeave={() => setScrub(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#166534" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#166534" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E7ECE9" vertical={false} />
          <XAxis
            dataKey="i"
            type="number"
            domain={[0, Math.max(1, data.length - 1)]}
            tickLine={false}
            axisLine={{ stroke: '#DCE2DE' }}
            minTickGap={48}
            tickFormatter={(i: number) => (data[Math.round(i)] ? formatClock(data[Math.round(i)].ts).slice(0, 5) : '')}
          />
          <YAxis
            width={46}
            tickLine={false}
            axisLine={false}
            domain={[(min: number) => Math.floor(min - 8), (max: number) => Math.ceil(max + 8)]}
            tickFormatter={(v: number) => `${Math.round(v)}`}
          />
          <Tooltip content={() => null} cursor={false} isAnimationActive={false} />
          <Area
            type="monotone"
            dataKey="alt"
            stroke="#166534"
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            activeDot={false}
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: Row }) => {
              const k = `dot-${props.index}`;
              if (props.payload?.sos)
                return <circle key={k} cx={props.cx} cy={props.cy} r={4} fill="#DC2626" stroke="#FFFFFF" strokeWidth={1.5} />;
              if (single) return <circle key={k} cx={props.cx} cy={props.cy} r={3.5} fill="#166534" stroke="#FFFFFF" strokeWidth={1.5} />;
              return <g key={k} />;
            }}
          />
          {active && (
            <>
              <ReferenceLine x={active.i} stroke="#0F172A" strokeWidth={1} ifOverflow="visible" />
              <ReferenceLine y={active.alt} stroke="#0F172A" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.45} ifOverflow="visible" />
              <ReferenceDot x={active.i} y={active.alt} r={5} fill="#FFFFFF" stroke="#0F172A" strokeWidth={2} ifOverflow="visible" />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
