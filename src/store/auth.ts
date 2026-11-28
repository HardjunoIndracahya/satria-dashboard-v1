import { create } from 'zustand';
import type { AuthStatus, OperatorUser } from '../types';

export interface UnauthorizedIdentity {
  uid: string;
  email: string;
  displayName: string;
  reason: string;
}

interface AuthState {
  status: AuthStatus;
  /** Verified authorized user with an active ADMIN, OPERATOR, or VIEWER role. */
  user: OperatorUser | null;
  /** Authenticated Firebase identity that lacks an authorized active role. */
  unauthorizedUser: UnauthorizedIdentity | null;
  /** True when firebase-config.js has apiKey configured for Firebase Auth. */
  authAvailable: boolean;
  error?: string;

  setAuthorized: (user: OperatorUser) => void;
  setUnauthorized: (identity: UnauthorizedIdentity) => void;
  setUnauthenticated: (error?: string) => void;
  setLoading: () => void;
  setAuthAvailable: (available: boolean) => void;
  setError: (error?: string) => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  unauthorizedUser: null,
  authAvailable: false,
  error: undefined,

  setAuthorized: (user) => set({ status: 'authorized', user, unauthorizedUser: null, error: undefined }),
  setUnauthorized: (unauthorizedUser) => set({ status: 'unauthorized', user: null, unauthorizedUser, error: undefined }),
  setUnauthenticated: (error) => set({ status: 'unauthenticated', user: null, unauthorizedUser: null, error }),
  setLoading: () => set({ status: 'loading', error: undefined }),
  setAuthAvailable: (authAvailable) => set({ authAvailable }),
  setError: (error) => set({ error }),
}));
