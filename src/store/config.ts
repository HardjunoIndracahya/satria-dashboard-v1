import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Pairing, RelayNode } from '../types';

export interface AckRecord {
  id: string;
  at: number;
}

/** Local operator data only. Firebase connection settings live exclusively in firebase-config.js. */
interface ConfigState {
  nodes: RelayNode[];
  pairings: Record<string, Pairing>;
  acks: Record<string, AckRecord>;
  muted: boolean;

  upsertNode: (n: RelayNode) => void;
  removeNode: (id: string) => void;
  toggleNode: (id: string) => void;
  setPairing: (id: string, p: Pairing | null) => void;
  ack: (key: string, id: string) => void;
  setMuted: (m: boolean) => void;
}

export const useConfig = create<ConfigState>()(
  persist(
    (set) => ({
      nodes: [],
      pairings: {},
      acks: {},
      muted: false,

      upsertNode: (n) =>
        set((s) => ({
          nodes: s.nodes.some((x) => x.id === n.id) ? s.nodes.map((x) => (x.id === n.id ? n : x)) : [...s.nodes, n],
        })),
      removeNode: (id) => set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id) })),
      toggleNode: (id) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, active: !n.active } : n)) })),
      setPairing: (id, p) =>
        set((s) => {
          const next = { ...s.pairings };
          if (p) next[id] = p;
          else delete next[id];
          return { pairings: next };
        }),
      ack: (key, id) => set((s) => ({ acks: { ...s.acks, [key]: { id, at: Date.now() } } })),
      setMuted: (muted) => set({ muted }),
    }),
    {
      name: 'raksa.config.v1',
      version: 3,
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<ConfigState>;
        return { nodes: s.nodes ?? [], pairings: s.pairings ?? {}, acks: s.acks ?? {}, muted: s.muted ?? false } as ConfigState;
      },
      partialize: (s) => ({ nodes: s.nodes, pairings: s.pairings, acks: s.acks, muted: s.muted }),
    },
  ),
);
