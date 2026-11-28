import { onValue, ref } from 'firebase/database';
import type { FirebaseWebConfig } from './firebase';
import {
  disposeFirebase,
  getFirebaseDatabase,
  manageFirebaseListener,
  normalizeDatabaseRoot,
  SOS_ACTIVE_ROOT,
  SOS_HISTORY_ROOT,
} from './firebase';
import { parseFirebasePacket } from './parser';
import { parseSosActiveMap, parseSosHistoryList } from './sosService';
import type { LogEntry, SosHistoryIncident, SosIncident } from '../types';

export interface FirebaseStreamHandlers {
  onConnection: (connected: boolean) => void;
  onPacket: (entry: LogEntry) => void;
  /** Called after every telemetry snapshot with the number of device nodes found (0 = empty node). */
  onDeviceCount?: (count: number) => void;
  onSosActive?: (active: Record<string, SosIncident>) => void;
  onSosHistory?: (history: SosHistoryIncident[]) => void;
  onSosError?: (error: Error) => void;
  onError: (error: Error) => void;
}

function friendlyError(error: Error & { code?: string }, nodeName: string): Error {
  if (error.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(error.message)) {
    return new Error(
      `Permission denied by Firebase Realtime Database rules on "${nodeName}". Check your Security Rules or sign in as an authorized Basecamp operator.`,
    );
  }
  return error;
}

/**
 * Registers exactly ONE `onValue` listener each for:
 *  - `.info/connected`
 *  - `pendaki/` (current hiker telemetry)
 *  - `sos_active/` (persistent unresolved SOS incidents)
 *  - `sos_history/` (resolved SOS incident archive)
 */
export function subscribeFirebaseStream(config: FirebaseWebConfig, rootPath: string, handlers: FirebaseStreamHandlers): () => void {
  const database = getFirebaseDatabase(config);
  const root = normalizeDatabaseRoot(rootPath);
  const sosActivePath = normalizeDatabaseRoot(SOS_ACTIVE_ROOT);
  const sosHistoryPath = normalizeDatabaseRoot(SOS_HISTORY_ROOT);
  let sequence = 0;
  const lastSeen = new Map<string, string>();
  const disposers: Array<() => void> = [];

  try {
    const connectedRef = ref(database, '.info/connected');
    disposers.push(
      manageFirebaseListener(
        connectedRef,
        onValue(
          connectedRef,
          (snapshot) => handlers.onConnection(snapshot.val() === true),
          (error) => handlers.onError(friendlyError(error, '.info/connected')),
        ),
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
          (error) => handlers.onError(friendlyError(error, root || '/')),
        ),
      ),
    );

    if (handlers.onSosActive) {
      const sosActiveRef = ref(database, sosActivePath);
      disposers.push(
        manageFirebaseListener(
          sosActiveRef,
          onValue(
            sosActiveRef,
            (snapshot) => {
              handlers.onSosActive?.(parseSosActiveMap(snapshot.val()));
            },
            (error) => handlers.onSosError?.(friendlyError(error, sosActivePath)),
          ),
        ),
      );
    }

    if (handlers.onSosHistory) {
      const sosHistoryRef = ref(database, sosHistoryPath);
      disposers.push(
        manageFirebaseListener(
          sosHistoryRef,
          onValue(
            sosHistoryRef,
            (snapshot) => {
              handlers.onSosHistory?.(parseSosHistoryList(snapshot.val()));
            },
            (error) => handlers.onSosError?.(friendlyError(error, sosHistoryPath)),
          ),
        ),
      );
    }

    return () => {
      for (const dispose of disposers) dispose();
    };
  } catch (error) {
    for (const dispose of disposers) dispose();
    disposeFirebase();
    throw error;
  }
}
