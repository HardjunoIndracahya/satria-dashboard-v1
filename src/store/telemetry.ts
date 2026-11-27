import { create } from 'zustand';
import type { LogEntry, Packet, ParseResult } from '../types';

/**
 * Rows without an explicit timestamp get the time the dashboard first saw them.
 * Keyed by row number + payload so repeated polls keep stable timestamps.
 */
const seen = new Map<string, number>();
export const fallbackTs = (row: number, raw: string): number => {
  const key = `${row}|${raw}`;
  let t = seen.get(key);
  if (t === undefined) {
    t = Date.now();
    seen.set(key, t);
  }
  return t;
};

interface TelemetryState {
  entries: LogEntry[];
  tracks: Record<string, Packet[]>;
  total: number;
  valid: number;
  sos: number;
  corrupt: number;
  mapping: string[];
  fileName?: string;
  lastSyncAt?: number;
  latencyMs?: number;
  syncing: boolean;
  error?: string;
  /** increments when rows changed — drives the heartbeat micro-animation */
  pulse: number;

  ingest: (r: ParseResult, meta?: { latencyMs?: number; fileName?: string }) => void;
  setSyncing: (s: boolean) => void;
  setError: (e?: string) => void;
  reset: () => void;
}

const EMPTY = {
  entries: [] as LogEntry[],
  tracks: {} as Record<string, Packet[]>,
  total: 0,
  valid: 0,
  sos: 0,
  corrupt: 0,
  mapping: [] as string[],
  fileName: undefined,
  lastSyncAt: undefined,
  latencyMs: undefined,
  error: undefined,
};

export const useTelemetry = create<TelemetryState>((set, get) => ({
  ...EMPTY,
  syncing: false,
  pulse: 0,

  ingest: (r, meta) => {
    const prev = get();
    const tracks: Record<string, Packet[]> = {};
    for (const e of r.entries) {
      if (!e.packet) continue;
      (tracks[e.packet.id] ??= []).push(e.packet);
    }
    for (const t of Object.values(tracks)) t.sort((a, b) => a.ts - b.ts || a.row - b.row);

    const lastNew = r.entries[r.entries.length - 1];
    const lastOld = prev.entries[prev.entries.length - 1];
    const changed = r.entries.length !== prev.entries.length || lastNew?.raw !== lastOld?.raw || meta?.fileName !== undefined;

    set({
      entries: r.entries,
      tracks,
      total: r.total,
      valid: r.valid,
      sos: r.sos,
      corrupt: r.corrupt,
      mapping: r.mapping,
      fileName: meta?.fileName,
      lastSyncAt: Date.now(),
      latencyMs: meta?.latencyMs,
      error: undefined,
      pulse: changed ? prev.pulse + 1 : prev.pulse,
    });
  },
  setSyncing: (syncing) => set({ syncing }),
  setError: (error) => set({ error }),
  reset: () => {
    seen.clear();
    set({ ...EMPTY, syncing: false });
  },
}));
