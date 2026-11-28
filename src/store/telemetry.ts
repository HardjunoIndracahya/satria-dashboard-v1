import { create } from 'zustand';
import type { LogEntry, Packet } from '../types';

export type FirebaseConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TelemetryState {
  entries: LogEntry[];
  tracks: Record<string, Packet[]>;
  total: number;
  valid: number;
  sos: number;
  corrupt: number;
  lastSyncAt?: number;
  connectionState: FirebaseConnectionState;
  error?: string;
  pulse: number;
  /** True when the watched Firebase node exists but holds no device children. */
  emptyRoot: boolean;

  setEmptyRoot: (empty: boolean) => void;
  ingestEvent: (entry: LogEntry) => void;
  setConnectionState: (state: FirebaseConnectionState) => void;
  setError: (error?: string) => void;
  reset: () => void;
}

const MAX_ENTRIES = 3000;
const MAX_TRACK = 1000;

const EMPTY = {
  emptyRoot: false,
  entries: [] as LogEntry[],
  tracks: {} as Record<string, Packet[]>,
  total: 0,
  valid: 0,
  sos: 0,
  corrupt: 0,
  lastSyncAt: undefined,
  error: undefined,
};

export const useTelemetry = create<TelemetryState>((set) => ({
  ...EMPTY,
  connectionState: 'disconnected',
  pulse: 0,

  ingestEvent: (entry) =>
    set((state) => {
      const entries = [...state.entries, entry].slice(-MAX_ENTRIES);
      const tracks = entry.packet
        ? { ...state.tracks, [entry.packet.id]: [...(state.tracks[entry.packet.id] ?? []), entry.packet].slice(-MAX_TRACK) }
        : state.tracks;
      const valid = state.valid + (entry.packet ? 1 : 0);
      const sos = state.sos + (entry.kind === 'SOS' ? 1 : 0);
      return {
        entries,
        tracks,
        total: state.total + 1,
        valid,
        sos,
        corrupt: state.corrupt + (entry.kind === 'CORRUPT' ? 1 : 0),
        lastSyncAt: Date.now(),
        error: undefined,
        pulse: state.pulse + 1,
      };
    }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setEmptyRoot: (emptyRoot) => set({ emptyRoot }),
  setError: (error) => set({ error }),
  reset: () => set({ ...EMPTY, connectionState: 'disconnected', pulse: 0 }),
}));
