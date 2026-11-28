import type { Hiker, SidebarFilter } from '../types';

export function matchesFilter(h: Hiker, filter: SidebarFilter): boolean {
  switch (filter) {
    case 'live':
      return h.link === 'LIVE';
    case 'delayed':
      return h.link === 'DELAYED';
    case 'offline':
      return h.link === 'OFFLINE';
    case 'sos':
      return h.status === 'SOS';
    default:
      return true;
  }
}

/** Shared by the sidebar, the map markers and the monitoring table. */
export function filterHikers(hikers: Hiker[], filter: SidebarFilter, search: string, extra?: (h: Hiker) => string): Hiker[] {
  const q = search.trim().toLowerCase();
  return hikers.filter((h) => {
    if (!matchesFilter(h, filter)) return false;
    if (!q) return true;
    return h.id.toLowerCase().includes(q) || (extra?.(h) ?? '').toLowerCase().includes(q);
  });
}

export function filterCounts(hikers: Hiker[]): Record<SidebarFilter, number> {
  return {
    all: hikers.length,
    live: hikers.filter((h) => h.link === 'LIVE').length,
    delayed: hikers.filter((h) => h.link === 'DELAYED').length,
    offline: hikers.filter((h) => h.link === 'OFFLINE').length,
    sos: hikers.filter((h) => h.status === 'SOS').length,
  };
}

export const FILTER_LABELS: Record<SidebarFilter, string> = {
  all: 'All',
  live: 'Active',
  delayed: 'Delayed',
  offline: 'Offline',
  sos: 'SOS',
};

export const FILTER_ORDER: SidebarFilter[] = ['all', 'live', 'delayed', 'offline', 'sos'];
