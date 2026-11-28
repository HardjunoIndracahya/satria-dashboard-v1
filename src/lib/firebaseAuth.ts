import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FIREBASE_STATUS, getFirebaseAuth } from './firebase';
import { useAuth } from '../store/auth';
import type { OperatorUser } from '../types';

function toOperator(user: { uid: string; email: string | null; displayName: string | null }): OperatorUser {
  const email = user.email ?? user.uid;
  return {
    uid: user.uid,
    email,
    displayName: user.displayName?.trim() || email.split('@')[0] || 'Basecamp Operator',
  };
}

function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid operator email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console → Authentication → Sign-in method.';
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
      return 'The apiKey in firebase-config.js is not valid for Firebase Authentication.';
    default:
      return error instanceof Error ? error.message : 'Unable to sign in.';
  }
}

export function subscribeOperatorAuth(): () => void {
  const store = useAuth.getState();
  if (!FIREBASE_STATUS.config || !FIREBASE_STATUS.authReady) {
    store.setAuthAvailable(false);
    store.setUser(null);
    store.setReady(true);
    return () => {};
  }

  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  if (!auth) {
    store.setAuthAvailable(false);
    store.setUser(null);
    store.setReady(true);
    return () => {};
  }

  store.setAuthAvailable(true);
  return onAuthStateChanged(
    auth,
    (fbUser) => {
      const s = useAuth.getState();
      s.setUser(fbUser ? toOperator(fbUser) : null);
      s.setReady(true);
      s.setError(undefined);
    },
    (err) => {
      const s = useAuth.getState();
      s.setReady(true);
      s.setError(friendlyAuthError(err));
    },
  );
}

export async function signInOperator(email: string, password: string): Promise<OperatorUser> {
  if (!FIREBASE_STATUS.config || !FIREBASE_STATUS.authReady) {
    throw new Error('Firebase Authentication requires apiKey and authDomain in firebase-config.js.');
  }
  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  if (!auth) {
    throw new Error('Firebase Authentication is not available. Check apiKey in firebase-config.js.');
  }
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const op = toOperator(credential.user);
    useAuth.getState().setUser(op);
    useAuth.getState().setError(undefined);
    return op;
  } catch (error) {
    const msg = friendlyAuthError(error);
    useAuth.getState().setError(msg);
    throw new Error(msg);
  }
}

export async function signOutOperator(): Promise<void> {
  if (!FIREBASE_STATUS.config) return;
  const auth = getFirebaseAuth(FIREBASE_STATUS.config);
  if (!auth) return;
  await signOut(auth);
  useAuth.getState().setUser(null);
}
