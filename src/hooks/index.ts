import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { deriveHikers } from '../lib/format';
import { disposeFirebase, getEnvironmentFirebaseConfig } from '../lib/firebase';
import { subscribeFirebaseStream } from '../lib/firebaseStream';
import { startAlarm, stopAlarm, unlockAudio, isAudioRunning } from '../lib/audio';
import type { Hiker } from '../types';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useHikers(): Hiker[] {
  const tracks = useTelemetry((s) => s.tracks);
  const offlineMin = useConfig((s) => s.offlineAfterMin);
  const now = useNow(5000);
  return useMemo(() => deriveHikers(tracks, now, offlineMin * 60_000), [tracks, offlineMin, now]);
}

/** Hikers whose current SOS episode has not been acknowledged. */
export function useUnackedSos(hikers: Hiker[]): Hiker[] {
  const acks = useConfig((s) => s.acks);
  return useMemo(() => hikers.filter((h) => h.status === 'SOS' && h.sosKey && !acks[h.sosKey]), [hikers, acks]);
}

/** Keeps one RTDB subscription active for the selected runtime or environment config. */
export function useFirebaseStream() {
  const runtimeConfig = useConfig((s) => s.firebaseConfig);
  const databaseRoot = useConfig((s) => s.databaseRoot);
  const connectionDisabled = useConfig((s) => s.connectionDisabled);
  const environmentConfig = useMemo(() => getEnvironmentFirebaseConfig(), []);
  const config = runtimeConfig ?? environmentConfig;

  useEffect(() => {
    if (!config || connectionDisabled) {
      disposeFirebase();
      useTelemetry.getState().reset();
      return;
    }

    const telemetry = useTelemetry.getState();
    telemetry.reset();
    telemetry.setConnectionState('connecting');
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeFirebaseStream(config, databaseRoot, {
        onConnection: (connected) => {
          useTelemetry.getState().setConnectionState(connected ? 'connected' : 'disconnected');
          if (connected) useTelemetry.getState().setError(undefined);
        },
        onPacket: (entry) => useTelemetry.getState().ingestEvent(entry),
        onError: (error) => {
          useTelemetry.getState().setConnectionState('error');
          useTelemetry.getState().setError(error.message);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firebase initialization failed';
      useTelemetry.getState().setConnectionState('error');
      useTelemetry.getState().setError(message);
    }
    return () => {
      unsubscribe?.();
      disposeFirebase();
    };
  }, [config, databaseRoot, connectionDisabled]);
}

/** Plays the siren while an unacknowledged SOS exists and audio is not muted. */
export function useAlarm(unacked: number) {
  const muted = useConfig((s) => s.muted);
  const warned = useRef(false);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (unacked > 0 && !muted) {
      startAlarm();
      if (!warned.current) {
        setTimeout(() => {
          if (!isAudioRunning() && !warned.current) {
            warned.current = true;
            toast.warning('SOS alarm is waiting for audio permission', { description: 'Click anywhere on the page to enable the siren.' });
          }
        }, 600);
      }
    } else {
      stopAlarm();
    }
    return () => stopAlarm();
  }, [unacked, muted]);
}

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const ui = useUi.getState();

      if (e.key === 'Escape') {
        if (typing) el?.blur();
        ui.dismiss();
        return;
      }
      if (typing) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          ui.focusSearch();
          break;
        case '3':
          ui.toggle3d();
          break;
        case 'm':
        case 'M': {
          const cfg = useConfig.getState();
          cfg.setMuted(!cfg.muted);
          toast(cfg.muted ? 'SOS siren unmuted' : 'SOS siren muted');
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
