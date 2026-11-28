import type { Hiker, Packet } from '../types';
import { distanceM } from './geo';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatClock(ts)}`;
}

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${pad(m % 60)}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Derives per-hiker state from packet tracks. SOS is always listed first. */
export function deriveHikers(tracks: Record<string, Packet[]>, now: number, liveMs: number, offlineMs: number): Hiker[] {
  const out: Hiker[] = [];
  for (const [id, track] of Object.entries(tracks)) {
    const latest = track[track.length - 1];
    if (!latest) continue;
    const silentMs = Math.max(0, now - latest.ts);
    const status: Hiker['status'] = latest.status;
    const link: Hiker['link'] = silentMs <= liveMs ? 'LIVE' : silentMs <= offlineMs ? 'DELAYED' : 'OFFLINE';
    let sosSince: number | undefined;
    let sosKey: string | undefined;
    if (status === 'SOS') {
      let i = track.length - 1;
      while (i > 0 && track[i - 1].status === 'SOS') i--;
      sosSince = track[i].ts;
      sosKey = `${id}@${sosSince}`;
    }
    out.push({ id, latest, track, status, link, silentMs, sosKey, sosSince });
  }
  out.sort((a, b) => {
    const sa = a.status === 'SOS' ? 0 : 1;
    const sb = b.status === 'SOS' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    if (sa === 0) return (a.sosSince ?? 0) - (b.sosSince ?? 0);
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
  return out;
}

/** Signal quality 0–4 from RSSI (dBm), tuned for 433 MHz LoRa SX1278. */
export function signalLevel(rssi?: number): number {
  if (rssi === undefined) return 0;
  if (rssi >= -85) return 4;
  if (rssi >= -100) return 3;
  if (rssi >= -110) return 2;
  if (rssi >= -120) return 1;
  return 0;
}

export const WEAK_RSSI = -105;
export const HYPOTHERMIA_C = 15;

export function nearestNode<T extends { lat: number; lon: number }>(nodes: T[], p: { lat: number; lon: number }): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = distanceM(n, p);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
