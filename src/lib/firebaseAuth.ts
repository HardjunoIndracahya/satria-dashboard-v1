import {
  browserLocalPersistence,
  browserSessionPersistence,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { get, onValue, ref } from 'firebase/database';
import { disposeRealtimeListeners, FIREBASE_STATUS, getFirebaseAuth, getFirebaseDatabase } from './firebase';
import { normalizeRole } from './rbac';
import { stopAlarm } from './audio';
import { useAuth } from '../store/auth';
import { useSos } from '../store/sos';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import type { OperatorUser, UserRole } from '../types';

function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password. Contact a RAKSA Basecamp administrator if you need access.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Wait a few minutes before trying again.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication. Check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console → Authentication → Sign-in method.';
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
      return 'The apiKey in firebase-config.js is invalid. Verify your Firebase Web App configuration.';
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
      return 'Your session has expired. Please sign in again.';
    default:
      return error instanceof Error ? error.message : 'Unable to complete authentication.';
  }
}

function clearProtectedClientState(): void {
  stopAlarm();
  disposeRealtimeListeners();
  useTelemetry.getState().reset();
  useSos.getState().reset();
  useUi.getState().resetProtectedUi();
}

interface VerifiedRoleResult {
  authorized: true;
  role: UserRole;
  roleSource: 'claims' | 'database';
  displayName?: string;
}

interface DeniedRoleResult {
  authorized: false;
  reason: string;
}

/**
 * Verifies the user's authorized role strictly from trusted sources:
 *   1. Firebase Auth Custom Claims (`token.claims.role`, managed via Firebase Admin SDK)
 *   2. Protected RTDB `/users/{uid}` directory (`role` + `active === true`, `.write: false` for clients)
 *   3. Legacy `/operators/{uid} === true` fallback mapped to OPERATOR (if still present from migration)
 */
async function resolveAuthorizedRole(fbUser: User): Promise<VerifiedRoleResult | DeniedRoleResult> {
  if (!FIREBASE_STATUS.config) {
    return { authorized: false, reason: 'Firebase configuration is missing.' };
  }

  // 1. Check Firebase Auth custom claims (force fresh token to catch revocations/role changes)
  let claimRole: UserRole | null = null;
  let claimDisabled = false;
  try {
    const tokenResult = await fbUser.getIdTokenResult(true);
    claimRole = normalizeRole(tokenResult.claims.role);
    claimDisabled = tokenResult.claims.disabled === true || tokenResult.claims.active === false;
  } catch {
    // Fall through to database verification or fail closed below
  }

  if (claimDisabled) {
    return { authorized: false, reason: 'Your account authorization has been revoked by an administrator.' };
  }

  // 2. Check protected server-managed RTDB `/users/{uid}` record
  const db = getFirebaseDatabase(FIREBASE_STATUS.config);
  try {
    const userSnap = await get(ref(db, `users/${fbUser.uid}`));
    if (userSnap.exists()) {
      const val = userSnap.val() as Record<string, unknown> | null;
      if (val && typeof val === 'object') {
        if (val.active === false) {
          return { authorized: false, reason: 'Your account is currently disabled in the RAKSA authorization directory.' };
        }
        const dbRole = normalizeRole(val.role);
        if (dbRole && val.active !== false) {
          return {
            authorized: true,
            role: claimRole ?? dbRole,
            roleSource: claimRole ? 'claims' : 'database',
            displayName: typeof val.displayName === 'string' && val.displayName.trim() ? val.displayName.trim() : undefined,
          };
        }
      }
    }
  } catch {
    // If custom claim already verified the user, allow custom claim even if `/users/$uid` isn't populated
    if (claimRole) {
      return { authorized: true, role: claimRole, roleSource: 'claims' };
    }
  }

  if (claimRole) {
    return { authorized: true, role: claimRole, roleSource: 'claims' };
  }

  // 3. Backwards-compatible check for legacy `/operators/{uid} === true`
  try {
    const legacySnap = await get(ref(db, `operators/${fbUser.uid}`));
    if (legacySnap.val() === true) {
      return { authorized: true, role: 'OPERATOR', roleSource: 'database' };
    }
  } catch {
    /* permission denied or absent */
  }

  return {
    authorized: false,
    reason: 'Your Firebase account is authenticated, but no authorized RAKSA role (ADMIN, OPERATOR, or VIEWER) has been assigned.',
  };
}

function buildOperatorUser(fbUser: User, verified: VerifiedRoleResult): OperatorUser {
  const email = fbUser.email ?? fbUser.uid;
  return {
    uid: fbUser.uid,
    email,
    displayName: verified.displayName || fbUser.displayName?.trim() || email.split('@')[0] || 'Authorized Personnel',
    role: verified.role,
    roleSource: verified.roleSource,
    accountStatus: 'ACTIVE',
  };
}

let activeRoleWatcher: (() => void) | null = null;

function stopRoleWatcher() {
  if (activeRoleWatcher) {
    activeRoleWatcher();
    activeRoleWatcher = null;
  }
}

/**
 * Watches Firebase Authentication state + ID token lifecycle (`onIdTokenChanged`).
 * Verifies role authorization BEFORE granting access to any dashboard route or RTDB stream.
 * Also subscribes to `/users/{uid}` while authorized so admin revocation takes effect immediately.
 */
export function subscribeAuthSession(): () => void {
  const store = useAuth.getState();
  if (!FIREBASE_STATUS.config || !FIREBASE_STATUS.authReady) {
    store.setAuthAvailable(false);
    store.setUnauthenticated('Firebase Authentication requires a valid apiKey and databaseURL in firebase-config.js.');
    return () => {};
  }

  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  if (!auth) {
    store.setAuthAvailable(false);
    store.setUnauthenticated('Firebase Authentication is not configured in firebase-config.js.');
    return () => {};
  }

  store.setAuthAvailable(true);
  let verifySeq = 0;

  const unsubscribeAuth = onIdTokenChanged(
    auth,
    (fbUser) => {
      const seq = ++verifySeq;
      stopRoleWatcher();

      if (!fbUser) {
        clearProtectedClientState();
        useAuth.getState().setUnauthenticated();
        return;
      }

      // Only show loading splash on initial boot or unauthenticated -> checking transition
      if (useAuth.getState().status !== 'authorized' || useAuth.getState().user?.uid !== fbUser.uid) {
        useAuth.getState().setLoading();
      }

      void resolveAuthorizedRole(fbUser).then((result) => {
        if (seq !== verifySeq) return;
        const email = fbUser.email ?? fbUser.uid;
        const fallbackName = fbUser.displayName?.trim() || email.split('@')[0] || 'User';

        if (!result.authorized) {
          clearProtectedClientState();
          useAuth.getState().setUnauthorized({
            uid: fbUser.uid,
            email,
            displayName: fallbackName,
            reason: result.reason,
          });
          return;
        }

        const operator = buildOperatorUser(fbUser, result);
        useAuth.getState().setAuthorized(operator);

        // Live-watch own `/users/{uid}` entry so admin role updates or revocations apply in real time
        if (FIREBASE_STATUS.config) {
          const db = getFirebaseDatabase(FIREBASE_STATUS.config);
          const selfRef = ref(db, `users/${fbUser.uid}`);
          activeRoleWatcher = onValue(
            selfRef,
            (snap) => {
              if (seq !== verifySeq) return;
              if (!snap.exists()) {
                // If user was authorized via custom claims only, keep claims active
                if (operator.roleSource === 'claims') return;
                clearProtectedClientState();
                useAuth.getState().setUnauthorized({
                  uid: fbUser.uid,
                  email,
                  displayName: fallbackName,
                  reason: 'Your account authorization was removed by an administrator.',
                });
                return;
              }
              const val = snap.val() as Record<string, unknown> | null;
              if (!val || val.active === false) {
                clearProtectedClientState();
                useAuth.getState().setUnauthorized({
                  uid: fbUser.uid,
                  email,
                  displayName: fallbackName,
                  reason: 'Your account has been disabled by an administrator.',
                });
                return;
              }
              const nextRole = normalizeRole(val.role) ?? (operator.roleSource === 'claims' ? operator.role : null);
              if (!nextRole) {
                clearProtectedClientState();
                useAuth.getState().setUnauthorized({
                  uid: fbUser.uid,
                  email,
                  displayName: fallbackName,
                  reason: 'Your account no longer holds a valid authorized role.',
                });
                return;
              }
              const nextName =
                typeof val.displayName === 'string' && val.displayName.trim() ? val.displayName.trim() : operator.displayName;
              const cur = useAuth.getState().user;
              if (!cur || cur.role !== nextRole || cur.displayName !== nextName) {
                useAuth.getState().setAuthorized({ ...operator, role: nextRole, displayName: nextName });
              }
            },
            () => {
              /* ignore transient watch errors; token refresh will re-verify */
            },
          );
        }
      });
    },
    (err) => {
      stopRoleWatcher();
      clearProtectedClientState();
      useAuth.getState().setUnauthenticated(friendlyAuthError(err));
    },
  );

  return () => {
    verifySeq++;
    stopRoleWatcher();
    unsubscribeAuth();
  };
}

/** Re-verifies the currently signed-in Firebase user's claims and role directory entry. */
export async function refreshAuthorization(): Promise<boolean> {
  if (!FIREBASE_STATUS.config || !FIREBASE_STATUS.authReady) return false;
  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  const fbUser = auth?.currentUser;
  if (!fbUser) return false;

  const result = await resolveAuthorizedRole(fbUser);
  if (result.authorized) {
    useAuth.getState().setAuthorized(buildOperatorUser(fbUser, result));
    return true;
  }
  const email = fbUser.email ?? fbUser.uid;
  useAuth.getState().setUnauthorized({
    uid: fbUser.uid,
    email,
    displayName: fbUser.displayName?.trim() || email.split('@')[0] || 'User',
    reason: result.reason,
  });
  return false;
}

export async function signInWithEmail(email: string, password: string, rememberSession: boolean): Promise<void> {
  if (!FIREBASE_STATUS.config || !FIREBASE_STATUS.authReady) {
    throw new Error('Firebase Authentication requires apiKey and authDomain in firebase-config.js.');
  }
  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  if (!auth) {
    throw new Error('Firebase Authentication is not available. Check firebase-config.js.');
  }
  try {
    await setPersistence(auth, rememberSession ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
    // Role verification and navigation are completed automatically by `onIdTokenChanged`.
  } catch (error) {
    const msg = friendlyAuthError(error);
    useAuth.getState().setError(msg);
    throw new Error(msg);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!FIREBASE_STATUS.config || !FIREBASE_STATUS.authReady) {
    throw new Error('Firebase Authentication is not configured in firebase-config.js.');
  }
  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  if (!auth) {
    throw new Error('Firebase Authentication is not available.');
  }
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function signOutUser(): Promise<void> {
  stopRoleWatcher();
  clearProtectedClientState();
  if (FIREBASE_STATUS.config) {
    const auth = getFirebaseAuth(FIREBASE_STATUS.config);
    if (auth) {
      await signOut(auth);
    }
  }
  useAuth.getState().setUnauthenticated();
}
