import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Pairing, RelayNode } from '../types';
import type { FirebaseWebConfig } from '../lib/firebase';

export interface AckRecord {
  id: string;
  at: number;
}

interface ConfigState {
  firebaseConfig: FirebaseWebConfig | null;
  databaseRoot: string;
  connectionDisabled: boolean;
  offlineAfterMin: number;
  nodes: RelayNode[];
  pairings: Record<string, Pairing>;
  acks: Record<string, AckRecord>;
  muted: boolean;

  connectFirebase: (config: FirebaseWebConfig, root: string) => void;
  disconnect: () => void;
  setOfflineAfter: (min: number) => void;
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
      firebaseConfig: null,
      databaseRoot: '/',
      connectionDisabled: false,
      offlineAfterMin: 5,
      nodes: [],
      pairings: {},
      acks: {},
      muted: false,

      connectFirebase: (firebaseConfig, databaseRoot) => set({ firebaseConfig, databaseRoot, connectionDisabled: false }),
      disconnect: () => set({ connectionDisabled: true }),
      setOfflineAfter: (min) => set({ offlineAfterMin: Math.max(1, Math.min(240, min)) }),
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
      version: 1,
      partialize: (s) => ({
        firebaseConfig: s.firebaseConfig,
        databaseRoot: s.databaseRoot,
        connectionDisabled: s.connectionDisabled,
        offlineAfterMin: s.offlineAfterMin,
        nodes: s.nodes,
        pairings: s.pairings,
        acks: s.acks,
        muted: s.muted,
      }),
    },
  ),
);
