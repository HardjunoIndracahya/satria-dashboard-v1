import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getDatabase, off, type Database, type DatabaseReference } from 'firebase/database';

export type FirebaseWebConfig = FirebaseOptions & { databaseURL: string };

let activeApp: ReturnType<typeof initializeApp> | null = null;
let activeDatabase: Database | null = null;
let activeConfigKey = '';
let appSequence = 0;
const listenerCleanups = new Set<() => void>();

export function getEnvironmentFirebaseConfig(): FirebaseWebConfig | null {
  const { VITE_FIREBASE_DATABASE_URL, VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID } = import.meta.env;
  if (!VITE_FIREBASE_DATABASE_URL || !VITE_FIREBASE_API_KEY || !VITE_FIREBASE_PROJECT_ID || !VITE_FIREBASE_APP_ID) return null;
  return {
    databaseURL: VITE_FIREBASE_DATABASE_URL,
    apiKey: VITE_FIREBASE_API_KEY,
    projectId: VITE_FIREBASE_PROJECT_ID,
    appId: VITE_FIREBASE_APP_ID,
  };
}

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
  const segments = path.split('/').filter(Boolean);
  return segments.join('/');
}

export function databasePath(root: string, child: string): string {
  return [normalizeDatabaseRoot(root), child].filter(Boolean).join('/');
}

