import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useConfig } from '../store/config';
import { useTelemetry, fallbackTs } from '../store/telemetry';
import { useUi } from '../store/ui';
import { deriveHikers } from '../lib/format';
import { fetchSheet, resolveSheetUrl } from '../lib/sheets';
import { SHEET_QUERY_KEY } from '../lib/queryClient';
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

/** TanStack Query polling engine for Google Sheets / CSV / Apps Script endpoints. */
export function useSheetSync() {
  const mode = useConfig((s) => s.mode);
  const sheetUrl = useConfig((s) => s.sheetUrl);
  const intervalMs = useConfig((s) => s.intervalMs);
  const resolved = useMemo(() => resolveSheetUrl(sheetUrl), [sheetUrl]);
  const enabled = mode === 'sheet' && !!resolved;

  const q = useQuery({
    queryKey: [...SHEET_QUERY_KEY, resolved?.url ?? null],
    enabled,
    queryFn: ({ signal }) => fetchSheet(resolved!.url, fallbackTs, signal),
    refetchInterval: intervalMs > 0 ? intervalMs : false,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 0,
    gcTime: 0,
    structuralSharing: false,
  });

  const { data, dataUpdatedAt, error, isFetching } = q;
  const ingest = useTelemetry((s) => s.ingest);
  const setSyncing = useTelemetry((s) => s.setSyncing);
  const setError = useTelemetry((s) => s.setError);

  useEffect(() => {
    if (enabled && data) ingest(data.result, { latencyMs: data.latencyMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, enabled]);

  useEffect(() => {
    setSyncing(enabled && isFetching);
  }, [enabled, isFetching, setSyncing]);

  useEffect(() => {
    setError(enabled && error ? (error as Error).message : undefined);
  }, [enabled, error, setError]);

  // switching away from a live sheet clears its data
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === 'sheet' && mode === 'none') useTelemetry.getState().reset();
    prevMode.current = mode;
  }, [mode]);
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
        case 'r':
        case 'R': {
          const cfg = useConfig.getState();
          if (cfg.mode === 'sheet') {
            void import('../lib/queryClient').then((m) => m.syncNow());
            toast('Re-syncing spreadsheet…');
          } else {
            toast('No live spreadsheet connected', { description: 'Connect a Google Sheet to enable sync.' });
          }
          break;
        }
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
