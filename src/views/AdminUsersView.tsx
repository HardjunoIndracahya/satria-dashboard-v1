import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { Check, Copy, Cpu, Lock, Search, ShieldCheck, Terminal, UserCog, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveDatabase } from '../lib/firebase';
import { normalizeRole, ROLE_META } from '../lib/rbac';
import type { BasecampDeviceRecord, DirectoryUserRecord, UserRole } from '../types';

/**
 * Admin-only Access Control & Personnel Directory view.
 * Reads `/users` and `/basecamp_devices` (enforced ADMIN-only in Firebase RTDB Rules).
 * Account provisioning & role mutations are strictly executed via the trusted Firebase Admin SDK
 * script (`scripts/admin-provision.mjs`) — NEVER exposing service-account keys in browser code.
 */
export function AdminUsersView() {
  const [users, setUsers] = useState<DirectoryUserRecord[]>([]);
  const [devices, setDevices] = useState<BasecampDeviceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Interactive provisioning command builder
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('OPERATOR');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    const db = getActiveDatabase();
    if (!db) return;

    const unsubUsers = onValue(
      ref(db, 'users'),
      (snap) => {
        const raw = snap.val() as Record<string, Record<string, unknown>> | null;
        if (!raw || typeof raw !== 'object') {
          setUsers([]);
          return;
        }
        const list: DirectoryUserRecord[] = [];
        for (const [uid, val] of Object.entries(raw)) {
          if (!val || typeof val !== 'object') continue;
          const role = normalizeRole(val.role);
          if (!role) continue;
          list.push({
            uid,
            email: typeof val.email === 'string' ? val.email : uid,
            displayName: typeof val.displayName === 'string' && val.displayName.trim() ? val.displayName.trim() : 'Unnamed User',
            role,
            active: val.active !== false,
            createdAt: typeof val.createdAt === 'number' ? val.createdAt : undefined,
            updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : undefined,
          });
        }
        list.sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));
        setUsers(list);
        setError(null);
      },
      (err) => setError(err.message),
    );

    const unsubDevices = onValue(
      ref(db, 'basecamp_devices'),
      (snap) => {
        const raw = snap.val() as Record<string, unknown> | null;
        if (!raw || typeof raw !== 'object') {
          setDevices([]);
          return;
        }
        const list: BasecampDeviceRecord[] = [];
        for (const [uid, val] of Object.entries(raw)) {
          if (val === true) {
            list.push({ uid, label: 'Basecamp Receiver', active: true });
          } else if (val && typeof val === 'object') {
            const r = val as Record<string, unknown>;
            list.push({
              uid,
              label: typeof r.label === 'string' ? r.label : 'Basecamp Receiver',
              email: typeof r.email === 'string' ? r.email : undefined,
              active: r.active !== false,
            });
          }
        }
        setDevices(list);
      },
      () => {
        /* non-fatal */
      },
    );

    return () => {
      unsubUsers();
      unsubDevices();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const provisionCmd = `node scripts/admin-provision.mjs create-user --email "${newEmail.trim() || 'operator@basecamp.org'}" --name "${newName.trim() || 'Basecamp Operator'}" --role ${newRole}`;

  const copyCommand = (id: string, cmd: string) => {
    void navigator.clipboard?.writeText(cmd).then(() => {
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 1600);
      toast.success('Admin CLI command copied');
    });
  };

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div>
            <h1 className="flex items-center gap-2 text-[15px] font-extrabold">
              <UserCog size={17} className="text-forest" />
              Access Control &amp; Personnel Directory
            </h1>
            <p className="mt-0.5 text-[12px] text-ink-2">
              Administrator-only overview of authorized RAKSA personnel roles and least-privilege ESP32 Basecamp receivers.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-ctl border border-forest/30 bg-forest-tint px-3 py-1.5 text-[11.5px] font-semibold text-forest">
            <Lock size={13} />
            Public sign-up disabled · Server-enforced RBAC
          </span>
        </div>

        {error && (
          <div className="rounded-panel border border-crimson/35 bg-crimson-tint px-4 py-3 text-[12.5px] text-crimson">
            Unable to read directory: {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          {/* Authorized Personnel Directory */}
          <section className="panel overflow-hidden" aria-label="Authorized Personnel">
            <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Users size={15} />
                <h2 className="text-[14px] font-bold">Authorized Personnel</h2>
                <span className="num rounded-chip bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-2">{users.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    className="field !h-8 !w-[190px] !pl-8 text-[12px]"
                    placeholder="Search email or UID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="field !h-8 !w-[120px] !py-0 text-[12px]"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
                  aria-label="Filter by role"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
            </header>

            <div className="scroll-thin overflow-x-auto">
              {filteredUsers.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12.5px] text-ink-2">
                  {users.length === 0
                    ? 'No entries under /users yet. Provision personnel with scripts/admin-provision.mjs.'
                    : 'No personnel match the current filter.'}
                </p>
              ) : (
                <table className="w-full min-w-[680px] border-collapse text-[12.5px]">
                  <thead className="bg-canvas">
                    <tr className="border-b border-line text-left">
                      <th className="label px-4 py-2">Personnel</th>
                      <th className="label px-3 py-2">Role</th>
                      <th className="label px-3 py-2">Status</th>
                      <th className="label px-3 py-2">Firebase UID</th>
                      <th className="label px-3 py-2 text-right">Revoke Command</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const revokeCmd = `node scripts/admin-provision.mjs revoke-user --uid "${u.uid}"`;
                      return (
                        <tr key={u.uid} className="border-b border-line last:border-0 hover:bg-canvas/60">
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-ink">{u.displayName}</div>
                            <div className="num text-[11.5px] text-ink-2">{u.email}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex rounded-chip border px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${ROLE_META[u.role].badgeClass}`}>
                              {ROLE_META[u.role].label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {u.active ? (
                              <span className="inline-flex items-center gap-1 rounded-chip border border-forest/30 bg-forest-tint px-1.5 py-0.5 text-[10.5px] font-bold text-forest">
                                <ShieldCheck size={11} /> ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex rounded-chip border border-crimson/35 bg-crimson-tint px-1.5 py-0.5 text-[10.5px] font-bold text-crimson">
                                DISABLED
                              </span>
                            )}
                          </td>
                          <td className="num px-3 py-2.5 text-[11px] text-ink-2">{u.uid}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              className="btn h-7 px-2 text-[11px]"
                              onClick={() => copyCommand(`revoke-${u.uid}`, revokeCmd)}
                              title="Copy Admin SDK revoke command"
                            >
                              {copiedCmd === `revoke-${u.uid}` ? <Check size={12} className="text-forest" /> : <Copy size={12} />}
                              Revoke CLI
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Secure Admin SDK Provisioning Helper + Basecamp Devices */}
          <div className="flex flex-col gap-4">
            <section className="panel p-4" aria-label="Provisioning helper">
              <h2 className="flex items-center gap-2 text-[14px] font-bold">
                <Terminal size={15} className="text-forest" />
                Provision User (Firebase Admin SDK)
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                To keep Admin SDK private keys out of the browser, run the generated command on an administrator workstation. It sets verified custom claims AND syncs <code className="num">/users/&lt;uid&gt;</code>.
              </p>

              <div className="mt-3 space-y-2.5">
                <input
                  className="field !h-8 text-[12px]"
                  placeholder="operator@basecamp.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field !h-8 text-[12px]"
                    placeholder="Display name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <select
                    className="field !h-8 !py-0 text-[12px]"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>

                <div className="rounded-ctl border border-line bg-canvas p-2.5">
                  <code className="num block break-all text-[11px] leading-relaxed text-ink">{provisionCmd}</code>
                </div>
                <button className="btn btn-primary w-full" onClick={() => copyCommand('provision', provisionCmd)}>
                  {copiedCmd === 'provision' ? <Check size={14} /> : <Copy size={14} />}
                  Copy Provisioning Command
                </button>
              </div>
            </section>

            <section className="panel p-4" aria-label="Basecamp receiver devices">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[14px] font-bold">
                  <Cpu size={15} className="text-forest" />
                  Authorized ESP32 Basecamp Devices
                </h2>
                <span className="num rounded-chip bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-2">{devices.length}</span>
              </div>
              {devices.length === 0 ? (
                <p className="text-[12px] text-ink-2">
                  No Basecamp device identities registered under <code className="num">/basecamp_devices</code> yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {devices.map((d) => (
                    <li key={d.uid} className="flex items-center justify-between gap-2 rounded-ctl border border-line bg-canvas/60 px-3 py-2 text-[12px]">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{d.label}</div>
                        <div className="num truncate text-[10.5px] text-ink-2">{d.email ?? d.uid}</div>
                      </div>
                      <span className={`rounded-chip border px-1.5 py-0.5 text-[10px] font-bold ${d.active ? 'border-forest/30 bg-forest-tint text-forest' : 'border-crimson/35 bg-crimson-tint text-crimson'}`}>
                        {d.active ? 'ACTIVE' : 'REVOKED'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
