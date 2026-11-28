import { onValue, ref } from 'firebase/database';
import type { FirebaseWebConfig } from './firebase';
import { disposeFirebase, getFirebaseDatabase, manageFirebaseListener, normalizeDatabaseRoot } from './firebase';
import { parseFirebasePacket } from './parser';
import type { LogEntry } from '../types';

export interface FirebaseStreamHandlers {
  onConnection: (connected: boolean) => void;
  onPacket: (entry: LogEntry) => void;
  /** Called after every snapshot with the number of device nodes found (0 = empty node). */
  onDeviceCount?: (count: number) => void;
  onError: (error: Error) => void;
}

function friendlyError(error: Error & { code?: string }): Error {
  if (error.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(error.message)) {
    return new Error(
      'Permission denied by Firebase Realtime Database rules. Allow read access to the "pendaki" node (".read": true) or sign in with Firebase Auth. Rules were not modified by the dashboard.',
    );
  }
  return error;
}

/**
 * Streams the whole `pendaki/` node with ONE onValue listener. Every child is a hiker device
 * (any device ID is accepted). A packet is emitted only for devices whose data actually changed.
 */
export function subscribeFirebaseStream(config: FirebaseWebConfig, rootPath: string, handlers: FirebaseStreamHandlers): () => void {
  const database = getFirebaseDatabase(config);
  const root = normalizeDatabaseRoot(rootPath);
  let sequence = 0;
  const lastSeen = new Map<string, string>();
  const disposers: Array<() => void> = [];
  const fail = (error: Error) => handlers.onError(friendlyError(error));

  try {
    const connectedRef = ref(database, '.info/connected');
    disposers.push(
      manageFirebaseListener(
        connectedRef,
        onValue(connectedRef, (snapshot) => handlers.onConnection(snapshot.val() === true), fail),
      ),
    );

    const rootRef = root ? ref(database, root) : ref(database);
    disposers.push(
      manageFirebaseListener(
        rootRef,
        onValue(
          rootRef,
          (snapshot) => {
            let count = 0;
            snapshot.forEach((child) => {
              const key = child.key;
              if (!key) return;
              count++;
              const value: unknown = child.val();
              let signature: string;
              try {
                signature = JSON.stringify(value);
              } catch {
                return;
              }
              if (lastSeen.get(key) === signature) return;
              lastSeen.set(key, signature);
              try {
                handlers.onPacket(parseFirebasePacket(value, key, ++sequence));
              } catch (error) {
                console.error(`Unable to parse device ${key}`, error);
              }
            });
            handlers.onDeviceCount?.(count);
          },
          fail,
        ),
      ),
    );

    return () => {
      for (const dispose of disposers) dispose();
    };
  } catch (error) {
    for (const dispose of disposers) dispose();
    disposeFirebase();
    throw error;
  }
}
