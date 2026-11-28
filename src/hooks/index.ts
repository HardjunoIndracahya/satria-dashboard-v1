import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { deriveHikers } from '../lib/format';
import { DATABASE_ROOT, FIREBASE_STATUS, LIVE_WITHIN_MS, OFFLINE_AFTER_MS, disposeFirebase } from '../lib/firebase';
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
  const now = useNow(5000);
  return useMemo(() => deriveHikers(tracks, now, LIVE_WITHIN_MS, OFFLINE_AFTER_MS), [tracks, now]);
}

/** Hikers whose current SOS episode has not been acknowledged. */
export function useUnackedSos(hikers: Hiker[]): Hiker[] {
  const acks = useConfig((s) => s.acks);
  return useMemo(() => hikers.filter((h) => h.status === 'SOS' && h.sosKey && !acks[h.sosKey]), [hikers, acks]);
}

/** One visible notification per SOS episode (never repeated for unchanged data). */
export function useSosNotifications(hikers: Hiker[]) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const h of hikers) {
      if (h.status !== 'SOS' || !h.sosKey || seen.current.has(h.sosKey)) continue;
      seen.current.add(h.sosKey);
      toast.error(`SOS from ${h.id}`, {
        description: `${h.latest.lat.toFixed(5)}, ${h.latest.lon.toFixed(5)} / ${h.latest.alt.toFixed(0)} m`,
        duration: 12000,
        action: { label: 'Locate', onClick: () => useUi.getState().focusHiker(h.id) },
      });
    }
  }, [hikers]);
}

/**
 * Connects automatically on load using firebase-config.js, with no user interaction.
 * Exactly one RTDB subscription is kept for the lifetime of the app.
 */
export function useFirebaseStream() {
  useEffect(() => {
    const telemetry = useTelemetry.getState();
    if (!FIREBASE_STATUS.config) {
      telemetry.setConnectionState('error');
      telemetry.setError(FIREBASE_STATUS.error);
      return;
    }
    telemetry.reset();
    telemetry.setConnectionState('connecting');
    let unsubscribe: (() => void) | undefined;
    let everConnected = false;
    try {
      unsubscribe = subscribeFirebaseStream(FIREBASE_STATUS.config, DATABASE_ROOT, {
        onConnection: (connected) => {
          const state = useTelemetry.getState();
          if (connected) {
            everConnected = true;
            if (!state.error) state.setConnectionState('connected');
          } else if (everConnected && !state.error) {
            state.setConnectionState('disconnected');
          }
        },
        onPacket: (entry) => {
          const state = useTelemetry.getState();
          if (state.connectionState !== 'connected') state.setConnectionState('connected');
          state.ingestEvent(entry);
        },
        onDeviceCount: (count) => {
          const state = useTelemetry.getState();
          state.setEmptyRoot(count === 0);
          if (state.error) state.setError(undefined);
          if (state.connectionState !== 'connected') state.setConnectionState('connected');
        },
        onError: (error) => {
          useTelemetry.getState().setConnectionState('error');
          useTelemetry.getState().setError(error.message);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firebase initialization failed';
      useTelemetry.getState().setConnectionState('error');
      useTelemetry.getState().setError(`Firebase initialization failed: ${message}. Check firebase-config.js.`);
    }
    return () => {
      unsubscribe?.();
      disposeFirebase();
    };
  }, []);
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

