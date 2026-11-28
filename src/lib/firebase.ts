import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, off, type Database, type DatabaseReference } from 'firebase/database';
import { dashboardSettings, firebaseConfig } from '../../firebase-config.js';

export type FirebaseWebConfig = FirebaseOptions & { databaseURL: string };

export const DATABASE_ROOT = dashboardSettings.databaseRoot || 'pendaki';
export const SOS_ACTIVE_ROOT = dashboardSettings.sosActiveRoot || 'sos_active';
export const SOS_HISTORY_ROOT = dashboardSettings.sosHistoryRoot || 'sos_history';
export const LIVE_WITHIN_MS = Math.max(5, dashboardSettings.liveWithinSec) * 1000;
export const OFFLINE_AFTER_MS = Math.max(dashboardSettings.offlineAfterSec, dashboardSettings.liveWithinSec) * 1000;

export interface FirebaseConfigStatus {
  config?: FirebaseWebConfig;
  authReady: boolean;
  error?: string;
}

const isPlaceholder = (value: unknown) => typeof value !== 'string' || !value.trim() || /YOUR[_.]|YOUR$/i.test(value);

/** Validates firebase-config.js once. Placeholder values are dropped, never sent to Firebase. */
function resolveFirebaseConfig(): FirebaseConfigStatus {
  const raw = firebaseConfig as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') return { authReady: false, error: 'firebase-config.js does not export a firebaseConfig object.' };
  if (isPlaceholder(raw.databaseURL)) {
    return { authReady: false, error: 'Firebase is not configured. Open firebase-config.js and set databaseURL (and the other web-app values).' };
  }
  let url: URL;
  try {
    url = new URL(String(raw.databaseURL));
  } catch {
    return { authReady: false, error: 'Invalid databaseURL in firebase-config.js. Use the https:// Realtime Database URL from Firebase Console.' };
  }
  if (url.protocol !== 'https:') return { authReady: false, error: 'databaseURL in firebase-config.js must start with https://.' };

  const config: FirebaseWebConfig = { databaseURL: url.origin };
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'databaseURL' && !isPlaceholder(value)) (config as unknown as Record<string, string>)[key] = String(value).trim();
  }
  const authReady = Boolean(config.apiKey);
  return { config, authReady };
}

export const FIREBASE_STATUS: FirebaseConfigStatus = resolveFirebaseConfig();

let activeApp: FirebaseApp | null = null;
let activeDatabase: Database | null = null;
let activeAuth: Auth | null = null;
let activeConfigKey = '';
let appSequence = 0;
const listenerCleanups = new Set<() => void>();

export function getFirebaseApp(config: FirebaseWebConfig): FirebaseApp {
  const key = JSON.stringify(config);
  if (activeApp && activeConfigKey === key) return activeApp;
  disposeFirebase();

  const app = initializeApp(config, `raksa-${Date.now()}-${appSequence++}`);
  activeApp = app;
  activeConfigKey = key;
  activeDatabase = getDatabase(app);
  activeAuth = config.apiKey ? getAuth(app) : null;
  return app;
}

export function getFirebaseDatabase(config: FirebaseWebConfig): Database {
  getFirebaseApp(config);
  return activeDatabase!;
}

export function getFirebaseAuth(config: FirebaseWebConfig): Auth | null {
  if (!config.apiKey) return null;
  getFirebaseApp(config);
  return activeAuth;
}

export function getActiveDatabase(): Database | null {
  if (activeDatabase) return activeDatabase;
  if (!FIREBASE_STATUS.config) return null;
  return getFirebaseDatabase(FIREBASE_STATUS.config);
}

export function manageFirebaseListener(reference: DatabaseReference, unsubscribe: () => void): () => void {
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    unsubscribe();
    off(reference);
    listenerCleanups.delete(cleanup);
  };
  listenerCleanups.add(cleanup);
  return cleanup;
}

export function disposeFirebase(): void {
  for (const cleanup of [...listenerCleanups]) cleanup();
  const app = activeApp;
  activeApp = null;
  activeDatabase = null;
  activeAuth = null;
  activeConfigKey = '';
  if (app) {
    void deleteApp(app).catch((error: unknown) => {
      console.error('Unable to dispose Firebase app', error);
    });
  }
}

export function normalizeDatabaseRoot(path: string): string {
  return path.split('/').filter(Boolean).join('/');
}
