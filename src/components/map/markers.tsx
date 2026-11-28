import { memo, useEffect, useRef, useState } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import type { Hiker, NodeType, RelayNode } from '../../types';

const HIKER_COLOR = { SOS: '#DC2626', NORMAL: '#166534' } as const;
const LINK_RING = { LIVE: '#166534', DELAYED: '#D97706', OFFLINE: '#64748B' } as const;

/** Smoothly glides a marker to its newest coordinates instead of teleporting. */
function useAnimatedPosition(lon: number, lat: number, durationMs = 900) {
  const [pos, setPos] = useState({ lon, lat });
  const current = useRef(pos);
  current.current = pos;
  useEffect(() => {
    const from = current.current;
    if (from.lon === lon && from.lat === lat) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const e = 1 - (1 - t) ** 3;
      setPos({ lon: from.lon + (lon - from.lon) * e, lat: from.lat + (lat - from.lat) * e });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lon, lat, durationMs]);
  return pos;
}

function HikerMarkerBase({ hiker, selected, onSelect }: { hiker: Hiker; selected: boolean; onSelect: () => void }) {
  const sos = hiker.status === 'SOS';
  const pos = useAnimatedPosition(hiker.latest.lon, hiker.latest.lat);
  return (
    <Marker
      longitude={pos.lon}
      latitude={pos.lat}
      anchor="center"
      style={{ zIndex: sos ? 30 : selected ? 20 : 10 }}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onSelect();
      }}
    >
      <div className={`relative h-[18px] w-[18px] cursor-pointer ${hiker.link === 'OFFLINE' ? 'opacity-70' : ''}`}>
        {sos && (
          <>
            <span className="radar-ring" />
            <span className="radar-ring" style={{ animationDelay: '1s' }} />
          </>
        )}
        {selected && <span className="absolute -inset-[5px] rounded-full border-2 border-ink/80" />}
        <span
          className="absolute -inset-[2px] rounded-full"
          style={{ border: `2px ${hiker.link === 'LIVE' ? 'solid' : 'dashed'} ${LINK_RING[hiker.link]}` }}
        />
        <span
          className="absolute inset-0 rounded-full border-[2.5px] border-white"
          style={{ background: HIKER_COLOR[hiker.status], boxShadow: '0 1px 4px rgba(15,23,42,.45)' }}
        />
        <span
          className={`num absolute left-1/2 top-full mt-[7px] -translate-x-1/2 whitespace-nowrap rounded-chip border px-1.5 py-px text-[10px] font-bold leading-[14px] shadow-hair ${
            sos ? 'border-crimson bg-crimson text-white' : 'border-line-strong bg-white text-ink'
          }`}
        >
          {hiker.id}
        </span>
      </div>
    </Marker>
  );
}
export const HikerMarker = memo(HikerMarkerBase);

function Glyph({ type }: { type: NodeType }) {
  const p = { fill: 'none', stroke: '#fff', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (type === 'basecamp')
    return (
      <svg width="16" height="16" viewBox="0 0 18 18" {...p}>
        <path d="M2.5 15 9 3.5 15.5 15Z" />
        <path d="M9 15v-4.5" />
      </svg>
    );
  if (type === 'pos')
    return (
      <svg width="16" height="16" viewBox="0 0 18 18" {...p}>
        <path d="M5 16V2.5" />
        <path d="M5 3h8l-2 3 2 3H5" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" {...p}>
      <path d="M9 8.5v1M6 16l3-7.5L12 16M7.2 13.2h3.6" />
      <path d="M5.6 4.6a4.8 4.8 0 0 0 0 4M12.4 4.6a4.8 4.8 0 0 1 0 4" />
    </svg>
  );
}

const NODE_COLOR: Record<NodeType, string> = { basecamp: '#166534', pos: '#0F172A', relay: '#475569' };
export const NODE_LABEL: Record<NodeType, string> = { basecamp: 'Basecamp', pos: 'Pos Pendakian', relay: 'LoRa Relay' };

function NodeMarkerBase({ node, onClick }: { node: RelayNode; onClick?: () => void }) {
  const color = node.active ? NODE_COLOR[node.type] : '#94A3B8';
  return (
    <Marker
      longitude={node.lon}
      latitude={node.lat}
      anchor="bottom"
      style={{ zIndex: 5 }}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick?.();
      }}
    >
      <div className={`flex flex-col items-center ${node.active ? '' : 'opacity-70'}`} title={`${NODE_LABEL[node.type]} — ${node.name}`}>
        <span className="num mb-1 max-w-[120px] truncate rounded-chip border border-line-strong bg-white px-1.5 py-px text-[10px] font-semibold leading-[14px] text-ink-2 shadow-hair">
          {node.name}
        </span>
        <span
          className={`flex h-[26px] w-[26px] items-center justify-center border-2 border-white ${node.type === 'relay' ? 'rounded-full' : node.type === 'pos' ? 'rotate-0 rounded-[4px]' : 'rounded-[5px]'}`}
          style={{ background: color, boxShadow: '0 1px 4px rgba(15,23,42,.4)' }}
        >
          <Glyph type={node.type} />
        </span>
        <span className="h-[7px] w-[2px]" style={{ background: color }} />
        <span className="-mt-px h-[3px] w-[7px] rounded-full bg-ink/30" />
      </div>
    </Marker>
  );
}
export const NodeMarker = memo(NodeMarkerBase);

/** Precision scrub ring shown while hovering the elevation chart or the breadcrumb trail. */
export function ScrubMarker({ lon, lat }: { lon: number; lat: number }) {
  return (
    <Marker longitude={lon} latitude={lat} anchor="center" style={{ zIndex: 25, pointerEvents: 'none' }}>
      <span className="scrub-ring relative block h-[22px] w-[22px]">
        <span className="absolute inset-0 rounded-full border-2 border-ink bg-white/70" style={{ boxShadow: '0 0 0 4px rgba(22,101,52,.25)' }} />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
      </span>
    </Marker>
  );
}

export function PillMarker({ lon, lat, children, tone = 'ink' }: { lon: number; lat: number; children: React.ReactNode; tone?: 'ink' | 'green' }) {
  return (
    <Marker longitude={lon} latitude={lat} anchor="center" style={{ zIndex: 15, pointerEvents: 'none' }}>
      <div
        className={`num whitespace-nowrap rounded-full border bg-white px-2.5 py-[3px] text-[11px] font-semibold shadow-float ${
          tone === 'green' ? 'border-forest text-forest' : 'border-ink text-ink'
        }`}
      >
        {children}
      </div>
    </Marker>
  );
}
