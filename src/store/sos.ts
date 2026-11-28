import { create } from 'zustand';
import type { SosHistoryIncident, SosIncident } from '../types';

export type PendingSosAction = 'ack' | 'resolve';

interface SosState {
  /** Unresolved incidents keyed by device_id — mirrored strictly from Firebase `sos_active/`. */
  active: Record<string, SosIncident>;
  /** Resolved incidents sorted newest-resolved first — mirrored strictly from Firebase `sos_history/`. */
  history: SosHistoryIncident[];
  /** True after the first `sos_active` snapshot is received from Firebase. */
  loaded: boolean;
  /** In-flight Firebase mutation per device_id so operators cannot double-submit. */
  pending: Record<string, PendingSosAction>;
  error?: string;

  setActive: (active: Record<string, SosIncident>) => void;
  setHistory: (history: SosHistoryIncident[]) => void;
  setPending: (deviceId: string, action: PendingSosAction | null) => void;
  setError: (error?: string) => void;
  /** Clears sensitive local SOS state on logout/revocation (never deletes Firebase data). */
  reset: () => void;
}

/**
 * Persistent SOS state store.
 * IMPORTANT: Never cleared on temporary disconnect — Firebase `sos_active` is the source of truth.
 * Only reset in local browser memory when the user logs out or loses authorization.
 */
export const useSos = create<SosState>((set) => ({
  active: {},
  history: [],
  loaded: false,
  pending: {},
  error: undefined,

  setActive: (active) => set({ active, loaded: true, error: undefined }),
  setHistory: (history) => set({ history }),
  setPending: (deviceId, action) =>
    set((s) => {
      const next = { ...s.pending };
      if (action) next[deviceId] = action;
      else delete next[deviceId];
      return { pending: next };
    }),
  setError: (error) => set({ error }),
  reset: () => set({ active: {}, history: [], loaded: false, pending: {}, error: undefined }),
}));
