import { onChildAdded, onChildChanged, onValue, ref, type DataSnapshot } from 'firebase/database';
import type { FirebaseWebConfig } from './firebase';
import { databasePath, disposeFirebase, getFirebaseDatabase, manageFirebaseListener, normalizeDatabaseRoot } from './firebase';
import { parseFirebasePacket } from './parser';
import type { LogEntry } from '../types';

export interface FirebaseStreamHandlers {
  onConnection: (connected: boolean) => void;
  onPacket: (entry: LogEntry) => void;
  onError: (error: Error) => void;
}

function asError(error: Error): Error {
  return error;
}

/** Streams current hiker snapshots and each subsequent child update over RTDB. */
export function subscribeFirebaseStream(config: FirebaseWebConfig, rootPath: string, handlers: FirebaseStreamHandlers): () => void {
  const database = getFirebaseDatabase(config);
  const root = normalizeDatabaseRoot(rootPath);
  let sequence = 0;
  const disposers: Array<() => void> = [];

  try {
    const connectedRef = ref(database, '.info/connected');
    disposers.push(
      manageFirebaseListener(
        connectedRef,
        onValue(
          connectedRef,
          (snapshot) => handlers.onConnection(snapshot.val() === true),
          (error) => handlers.onError(asError(error)),
        ),
      ),
    );

    const hikersRef = ref(database, databasePath(root, 'hikers'));
    const receive = (snapshot: DataSnapshot) => {
      handlers.onPacket(parseFirebasePacket(snapshot.val(), snapshot.key ?? '', ++sequence));
    };
    disposers.push(
      manageFirebaseListener(
        hikersRef,
        onChildAdded(hikersRef, receive, (error) => handlers.onError(asError(error))),
      ),
    );
    disposers.push(
      manageFirebaseListener(
        hikersRef,
        onChildChanged(hikersRef, receive, (error) => handlers.onError(asError(error))),
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
