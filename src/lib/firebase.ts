import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getDatabase, off, type Database, type DatabaseReference } from 'firebase/database';
import { dashboardSettings, firebaseConfig } from '../../firebase-config.js';

export type FirebaseWebConfig = FirebaseOptions & { databaseURL: string };

export const DATABASE_ROOT = dashboardSettings.databaseRoot;
export const LIVE_WITHIN_MS = Math.max(5, dashboardSettings.liveWithinSec) * 1000;
export const OFFLINE_AFTER_MS = Math.max(dashboardSettings.offlineAfterSec, dashboardSettings.liveWithinSec) * 1000;

export interface FirebaseConfigStatus {
  config?: FirebaseWebConfig;
  error?: string;
}

const isPlaceholder = (value: unknown) => typeof value !== 'string' || !value.trim() || /YOUR[_.]|YOUR$/i.test(value);

/** Validates firebase-config.js once. Placeholder values are dropped, never sent to Firebase. */
function resolveFirebaseConfig(): FirebaseConfigStatus {
  const raw = firebaseConfig as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') return { error: 'firebase-config.js does not export a firebaseConfig object.' };
  if (isPlaceholder(raw.databaseURL)) {
    return { error: 'Firebase is not configured. Open firebase-config.js and set databaseURL (and the other web-app values).' };
  }
  let url: URL;
  try {
    url = new URL(String(raw.databaseURL));
  } catch {
    return { error: 'Invalid databaseURL in firebase-config.js. Use the https:// Realtime Database URL from Firebase Console.' };
  }
  if (url.protocol !== 'https:') return { error: 'databaseURL in firebase-config.js must start with https://.' };

  const config: FirebaseWebConfig = { databaseURL: url.origin };
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'databaseURL' && !isPlaceholder(value)) (config as unknown as Record<string, string>)[key] = String(value).trim();
  }
  return { config };
}

export const FIREBASE_STATUS: FirebaseConfigStatus = resolveFirebaseConfig();

let activeApp: ReturnType<typeof initializeApp> | null = null;
let activeDatabase: Database | null = null;
let activeConfigKey = '';
let appSequence = 0;
const listenerCleanups = new Set<() => void>();

export function getFirebaseDatabase(config: FirebaseWebConfig): Database {
  const key = JSON.stringify(config);
  if (activeDatabase && activeConfigKey === key) return activeDatabase;
  disposeFirebase();

  const app = initializeApp(config, `raksa-${Date.now()}-${appSequence++}`);
  activeApp = app;
  activeConfigKey = key;
  activeDatabase = getDatabase(app);
  return activeDatabase;
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
