import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../store/auth';
import { useConfig } from '../store/config';
import { useSos } from '../store/sos';
import { useTelemetry } from '../store/telemetry';
import { useUi } from '../store/ui';
import { deriveHikers } from '../lib/format';
import { DATABASE_ROOT, disposeRealtimeListeners, FIREBASE_STATUS, LIVE_WITHIN_MS, OFFLINE_AFTER_MS } from '../lib/firebase';
import { subscribeAuthSession } from '../lib/firebaseAuth';
import { subscribeFirebaseStream } from '../lib/firebaseStream';
import { canAccessView, canManageEmergencies, VIEW_PATHS, viewFromPathname } from '../lib/rbac';
import { ensureSosLatchedFromPacket } from '../lib/sosService';
import { startAlarm, stopAlarm, unlockAudio, isAudioRunning } from '../lib/audio';
import type { AppView, Hiker, SosIncident } from '../types';

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
  const activeSos = useSos((s) => s.active);
  const now = useNow(5000);
  return useMemo(() => {
    const list = deriveHikers(tracks, now, LIVE_WITHIN_MS, OFFLINE_AFTER_MS);
    return [...list].sort((a, b) => {
      const incA = activeSos[a.id];
      const incB = activeSos[b.id];
      const priA = incA?.state === 'ACTIVE' ? 0 : incA ? 1 : a.status === 'SOS' ? 2 : 3;
      const priB = incB?.state === 'ACTIVE' ? 0 : incB ? 1 : b.status === 'SOS' ? 2 : 3;
      if (priA !== priB) return priA - priB;
      if (incA && incB) return incA.triggered_at - incB.triggered_at;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [tracks, activeSos, now]);
}

/** Ordered list of all unresolved SOS incidents from Firebase `sos_active/` (ACTIVE first, oldest first). */
export function useActiveSosIncidents(): SosIncident[] {
  const active = useSos((s) => s.active);
  return useMemo(
    () =>
      Object.values(active).sort((a, b) => {
        if (a.state !== b.state) return a.state === 'ACTIVE' ? -1 : 1;
        return a.triggered_at - b.triggered_at;
      }),
    [active],
  );
}

/** Subset of unresolved incidents that have not yet been acknowledged (state === 'ACTIVE'). */
export function useUnackedSosIncidents(incidents: SosIncident[]): SosIncident[] {
  return useMemo(() => incidents.filter((inc) => inc.state === 'ACTIVE'), [incidents]);
}

/**
 * Triggers one toast + optional Browser Notification per unique `incident_id`.
 * Never repeats for unchanged telemetry or repeated SOS packets of the same incident.
 */
export function useSosNotifications(incidents: SosIncident[], hikers: Hiker[]) {
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  const sosLoaded = useSos((s) => s.loaded);

  useEffect(() => {
    if (!sosLoaded) return;
    const isInitialLoad = !initialized.current;
    initialized.current = true;

    for (const inc of incidents) {
      if (seen.current.has(inc.incident_id)) continue;
      seen.current.add(inc.incident_id);
      if (inc.state !== 'ACTIVE') continue;

      const hiker = hikers.find((h) => h.id === inc.device_id);
      const lat = hiker?.latest.lat ?? inc.latitude;
      const lon = hiker?.latest.lon ?? inc.longitude;
      const alt = hiker?.latest.alt ?? inc.altitude;
      const coords = lat !== null && lon !== null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'No GPS fix';
      const altStr = alt !== null ? ` · ${alt.toFixed(0)} m` : '';

      toast.error(`PERSISTENT SOS: ${inc.device_id}`, {
        description: `${inc.incident_id} · ${coords}${altStr}`,
        duration: 14000,
        action: { label: 'Locate', onClick: () => useUi.getState().focusHiker(inc.device_id) },
      });

      if (!isInitialLoad) {
        if (useUi.getState().view === 'dashboard') {
          useUi.getState().focusHiker(inc.device_id);
        }
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const n = new Notification(`SOS Emergency: ${inc.device_id}`, {
              body: `Incident ${inc.incident_id} · ${coords}${altStr}. Remains active until rescued.`,
              tag: inc.incident_id,
              requireInteraction: true,
            });
            n.onclick = () => {
              window.focus();
              useUi.getState().focusHiker(inc.device_id);
              n.close();
            };
          } catch {
            /* ignore unsupported notification context */
          }
        }
      }
    }
  }, [incidents, hikers, sosLoaded]);
}

/** Subscribes to Firebase Authentication & RBAC role verification once on load. */
export function useAuthSession() {
  useEffect(() => subscribeAuthSession(), []);
}

/**
 * Protects all URL paths and synchronizes browser history with authentication & role state:
 * - Unauthenticated visitors attempting any URL are redirected to `/login`.
 * - Unauthorized signed-in users are redirected to `/access-denied`.
 * - Authorized users are synced to their allowed section URL (non-admins blocked from `/admin/users`).
 */
export function useRouteGuard() {
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.user?.role ?? null);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const intendedViewRef = useRef<AppView | null>(
    typeof window !== 'undefined' ? viewFromPathname(window.location.pathname) : null,
  );

  // Sync URL on auth state or active view changes
  useEffect(() => {
    if (typeof window === 'undefined' || status === 'loading') return;

    if (status === 'unauthenticated') {
      const requested = viewFromPathname(window.location.pathname);
      if (requested) intendedViewRef.current = requested;
      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
      return;
    }

    if (status === 'unauthorized') {
      if (window.location.pathname !== '/access-denied') {
        window.history.replaceState(null, '', '/access-denied');
      }
      return;
    }

    // status === 'authorized'
    if (intendedViewRef.current) {
      const target = canAccessView(intendedViewRef.current, role) ? intendedViewRef.current : 'overview';
      intendedViewRef.current = null;
      if (target !== view) {
        setView(target);
        return;
      }
    }

    if (!canAccessView(view, role)) {
      setView('overview');
      return;
    }

    const desiredPath = VIEW_PATHS[view];
    if (window.location.pathname !== desiredPath) {
      window.history.replaceState(null, '', desiredPath);
    }
  }, [status, role, view, setView]);

  // Handle browser back/forward navigation safely
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const auth = useAuth.getState();
      if (auth.status === 'unauthenticated') {
        if (window.location.pathname !== '/login') window.history.replaceState(null, '', '/login');
        return;
      }
      if (auth.status === 'unauthorized') {
        if (window.location.pathname !== '/access-denied') window.history.replaceState(null, '', '/access-denied');
        return;
      }
      if (auth.status === 'authorized') {
        const parsed = viewFromPathname(window.location.pathname) ?? 'overview';
        const allowed = canAccessView(parsed, auth.user?.role) ? parsed : 'overview';
        useUi.getState().setView(allowed);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}

/**
 * Registers Firebase RTDB listeners ONLY after the user is authenticated AND authorized.
 * Tears down all listeners and clears local sensitive state when authorization ends (logout / revocation).
 */
export function useFirebaseStream(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      disposeRealtimeListeners();
      useTelemetry.getState().reset();
      useSos.getState().reset();
      return;
    }

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

          // Backup latch: only ADMIN / OPERATOR roles may create/update sos_active from telemetry.
          // NEVER clears or resolves on NORMAL status.
          if (entry.packet && entry.packet.status === 'SOS') {
            const role = useAuth.getState().user?.role;
            if (canManageEmergencies(role)) {
              const sosState = useSos.getState();
              const lastResolved = sosState.history
                .filter((h) => h.device_id === entry.packet!.id)
                .reduce((max, h) => Math.max(max, h.resolved_at), 0);
              void ensureSosLatchedFromPacket(entry.packet, lastResolved);
            }
          }
        },
        onDeviceCount: (count) => {
          const state = useTelemetry.getState();
          state.setEmptyRoot(count === 0);
          if (state.error) state.setError(undefined);
          if (state.connectionState !== 'connected') state.setConnectionState('connected');
        },
        onSosActive: (activeMap) => {
          useSos.getState().setActive(activeMap);
        },
        onSosHistory: (historyList) => {
          useSos.getState().setHistory(historyList);
        },
        onSosError: (error) => {
          useSos.getState().setError(error.message);
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
      disposeRealtimeListeners();
    };
  }, [enabled]);
}

/** Plays the siren while an ACTIVE (unacknowledged) persistent SOS incident exists and audio is not muted. */
export function useAlarm(activeUnackedCount: number) {
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
    if (activeUnackedCount > 0 && !muted) {
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
  }, [activeUnackedCount, muted]);
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
