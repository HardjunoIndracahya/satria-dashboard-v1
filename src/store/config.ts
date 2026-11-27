import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Pairing, RelayNode, SourceMode } from '../types';

export interface AckRecord {
  id: string;
  at: number;
}

interface ConfigState {
  mode: SourceMode;
  sheetUrl: string;
  /** 0 = manual */
  intervalMs: number;
  offlineAfterMin: number;
  nodes: RelayNode[];
  pairings: Record<string, Pairing>;
  acks: Record<string, AckRecord>;
  muted: boolean;

  connectSheet: (url: string, intervalMs: number) => void;
  setFileMode: () => void;
  disconnect: () => void;
  setInterval: (ms: number) => void;
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
      mode: 'none',
      sheetUrl: '',
      intervalMs: 10_000,
      offlineAfterMin: 5,
      nodes: [],
      pairings: {},
      acks: {},
      muted: false,

      connectSheet: (url, intervalMs) => set({ mode: 'sheet', sheetUrl: url, intervalMs }),
      setFileMode: () => set({ mode: 'file' }),
      disconnect: () => set({ mode: 'none' }),
      setInterval: (ms) => set({ intervalMs: ms }),
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
        // uploaded files are in-memory only, so never restore 'file' mode
        mode: s.mode === 'sheet' ? 'sheet' : 'none',
        sheetUrl: s.sheetUrl,
        intervalMs: s.intervalMs,
        offlineAfterMin: s.offlineAfterMin,
        nodes: s.nodes,
        pairings: s.pairings,
        acks: s.acks,
        muted: s.muted,
      }),
    },
  ),
);
