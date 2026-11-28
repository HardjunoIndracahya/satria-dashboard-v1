import { Database } from 'lucide-react';

/** Topographic contour motif — structural, not data. */
function Contours() {
  return (
    <svg viewBox="0 0 120 72" className="h-[72px] w-[120px]" fill="none" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M${8 + i * 7} 62 C ${24 + i * 6} ${52 - i * 4}, ${34 + i * 7} ${40 - i * 5}, ${58} ${32 - i * 3} S ${96 - i * 6} ${46 - i * 2}, ${112 - i * 7} 62`}
          stroke={i === 4 ? '#166534' : '#B7C4BC'}
          strokeWidth={i === 4 ? 1.5 : 1}
        />
      ))}
      <path d="M8 66h104" stroke="#DCE2DE" />
    </svg>
  );
}

/** Shown when firebase-config.js is missing or invalid. */
export function EmptyState({ compact = false, message }: { compact?: boolean; message?: string }) {
  return (
    <div className="flex flex-col items-center px-5 pb-6 pt-8 text-center">
      <Contours />
      <h3 className="mt-3 text-[14px] font-bold">Firebase not configured</h3>
      <p className="mt-1 max-w-[260px] text-[12.5px] leading-relaxed text-ink-2">
        {message ?? 'Set your Firebase project values in firebase-config.js. The dashboard connects automatically.'}
      </p>
      {!compact && (
        <div className="mt-5 w-full rounded-ctl border border-dashed border-line-strong bg-canvas/60 p-3 text-left">
          <div className="label mb-1.5 flex items-center gap-1.5">
            <Database size={12} /> Expected data
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-2">
            One child per hiker at <span className="num text-[11px] text-ink">/pendaki/{'{deviceId}'}</span> with device_id, latitude, longitude, altitude, temperature, status, rssi, snr and updated_at.
          </p>
        </div>
      )}
    </div>
  );
}
