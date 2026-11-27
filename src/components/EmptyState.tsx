import { Database } from 'lucide-react';
import { useUi } from '../store/ui';

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

export function EmptyState({ compact = false }: { compact?: boolean }) {
  const openConnect = useUi((s) => s.openConnect);
  return (
    <div className="flex flex-col items-center px-5 pb-6 pt-8 text-center">
      <Contours />
      <h3 className="mt-3 text-[14px] font-bold">No telemetry source</h3>
      <p className="mt-1 max-w-[240px] text-[12.5px] leading-relaxed text-ink-2">
        RAKSA only displays packets received from your Basecamp. Connect its Firebase Realtime Database to begin.
      </p>
      <div className="mt-4 flex w-full flex-col gap-2">
        <button className="btn btn-primary h-9" onClick={() => openConnect('firebase')}>
          <Database size={15} />
          Connect Firebase RTDB
        </button>
      </div>
      {!compact && (
        <div className="mt-5 w-full rounded-ctl border border-dashed border-line-strong bg-canvas/60 p-3 text-left">
          <div className="label mb-1.5">Accepted packet formats</div>
          <p className="text-[11.5px] leading-relaxed text-ink-2">
            Structured JSON at <span className="num text-[11px] text-ink">/hikers/{'{deviceId}'}</span> with ID, coordinates, MDPL, temperature, status and timestamp.
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">Raw LoRa payload strings are also accepted:</p>
          <code className="num mt-1 block break-all rounded-chip border border-line bg-surface px-2 py-1 text-[10.5px] text-ink-2">
            ID|lat|lon|mdpl|temp|STATUS[|rssi|snr]
          </code>
        </div>
      )}
    </div>
  );
}
