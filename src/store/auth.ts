import { create } from 'zustand';
import type { OperatorUser } from '../types';

interface AuthState {
  user: OperatorUser | null;
  /** True once Firebase Auth has checked the persisted session on load. */
  ready: boolean;
  /** True when firebase-config.js has apiKey configured for Firebase Auth. */
  authAvailable: boolean;
  error?: string;

  setUser: (user: OperatorUser | null) => void;
  setReady: (ready: boolean) => void;
  setAuthAvailable: (available: boolean) => void;
  setError: (error?: string) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  authAvailable: false,
  error: undefined,

  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  setAuthAvailable: (authAvailable) => set({ authAvailable }),
  setError: (error) => set({ error }),
}));
