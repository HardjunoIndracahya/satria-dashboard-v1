import type { AppView, UserRole } from '../types';

export const VALID_ROLES = new Set<UserRole>(['ADMIN', 'OPERATOR', 'VIEWER']);

export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase() as UserRole;
  return VALID_ROLES.has(upper) ? upper : null;
}

export function canManageEmergencies(role?: UserRole | null): boolean {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function canManageUsers(role?: UserRole | null): boolean {
  return role === 'ADMIN';
}

export function isReadOnlyRole(role?: UserRole | null): boolean {
  return role === 'VIEWER';
}

export function canAccessView(view: AppView, role?: UserRole | null): boolean {
  if (!role) return false;
  if (view === 'users') return role === 'ADMIN';
  return true;
}

export const ROLE_META: Record<UserRole, { label: string; description: string; badgeClass: string }> = {
  ADMIN: {
    label: 'Admin',
    description: 'Full access to monitoring, emergency response, system logs, and user administration.',
    badgeClass: 'bg-ink text-white border-ink',
  },
  OPERATOR: {
    label: 'Operator',
    description: 'Live expedition monitoring, SOS acknowledgment, and rescue confirmation.',
    badgeClass: 'bg-forest-tint text-forest border-forest/30',
  },
  VIEWER: {
    label: 'Viewer',
    description: 'Read-only access to live tracking, telemetry, and emergency status.',
    badgeClass: 'bg-slate2-tint text-ink-2 border-line-strong',
  },
};

export const VIEW_PATHS: Record<AppView, string> = {
  overview: '/overview',
  dashboard: '/live-tracking',
  emergencies: '/emergencies',
  hikers: '/hikers',
  analytics: '/analytics',
  nodes: '/relay-nodes',
  log: '/system-log',
  users: '/admin/users',
};

export function viewFromPathname(pathname: string): AppView | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const [view, path] of Object.entries(VIEW_PATHS)) {
    if (clean === path) return view as AppView;
  }
  if (clean === '/' || clean === '/dashboard') return 'overview';
  return null;
}
