const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing a → b in degrees [0, 360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const Δλ = rad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Geodesic midpoint. */
export function midpoint(a: LatLon, b: LatLon): LatLon {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const λ1 = rad(a.lon);
  const Δλ = rad(b.lon - a.lon);
  const Bx = Math.cos(φ2) * Math.cos(Δλ);
  const By = Math.cos(φ2) * Math.sin(Δλ);
  const φ3 = Math.atan2(Math.sin(φ1) + Math.sin(φ2), Math.hypot(Math.cos(φ1) + Bx, By));
  const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);
  return { lat: deg(φ3), lon: ((deg(λ3) + 540) % 360) - 180 };
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const cardinal = (b: number) => POINTS[Math.round(b / 22.5) % 16];

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatDelta(d: number): string {
  const r = Math.round(d);
  return `${r >= 0 ? '+' : '-'}${Math.abs(r)} m`;
}

export const formatBearing = (b: number) => `${String(Math.round(b) % 360).padStart(3, '0')}° ${cardinal(b)}`;

export const formatCoord = (p: LatLon) => `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;

export const googleMapsUrl = (p: LatLon) => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

export function boundsOf(points: LatLon[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}
