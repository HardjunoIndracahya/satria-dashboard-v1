import { useState } from 'react';
import { Check, Copy, LogOut, RefreshCw, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '../components/ui';
import { useAuth } from '../store/auth';
import { refreshAuthorization, signOutUser } from '../lib/firebaseAuth';

/**
 * Shown when a Firebase account is signed in, but does NOT have an authorized
 * active role (`ADMIN`, `OPERATOR`, or `VIEWER`). Zero protected telemetry is loaded.
 */
export function AccessDeniedView() {
  const identity = useAuth((s) => s.unauthorizedUser);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRecheck = async () => {
    setChecking(true);
    try {
      const ok = await refreshAuthorization();
      if (ok) toast.success('Authorization verified — opening dashboard');
      else toast.error('Account is still not authorized');
    } finally {
      setChecking(false);
    }
  };

  const handleCopyUid = () => {
    if (!identity?.uid) return;
    void navigator.clipboard?.writeText(identity.uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('User UID copied');
    });
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-[460px]">
        <div className="mb-4 flex items-center justify-center gap-2.5">
          <Logo size={30} />
          <span className="text-[18px] font-extrabold tracking-[0.14em] text-ink">RAKSA</span>
        </div>

        <main className="panel overflow-hidden border-crimson/35 shadow-float">
          <header className="flex items-center gap-3 border-b border-crimson/25 bg-crimson-tint px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-crimson text-white">
              <ShieldOff size={20} />
            </span>
            <div>
              <h1 className="text-[16px] font-extrabold text-crimson">Access Denied</h1>
              <p className="text-[12px] text-ink-2">Authenticated account lacks Basecamp authorization</p>
            </div>
          </header>

          <div className="space-y-4 p-5">
            <p className="text-[13px] leading-relaxed text-ink">
              {identity?.reason ?? 'Your account does not hold an active RAKSA role (ADMIN, OPERATOR, or VIEWER).'}
            </p>

            {identity && (
              <dl className="space-y-1.5 rounded-ctl border border-line bg-canvas/70 p-3 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Signed-in email</dt>
                  <dd className="num font-semibold text-ink">{identity.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Firebase UID</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="num max-w-[210px] truncate text-[11px] text-ink-2">{identity.uid}</span>
                    <button
                      type="button"
                      onClick={handleCopyUid}
                      className="btn h-6 px-1.5 text-[11px]"
                      title="Copy UID for administrator authorization"
                    >
                      {copied ? <Check size={11} className="text-forest" /> : <Copy size={11} />}
                      Copy
                    </button>
                  </dd>
                </div>
              </dl>
            )}

            <p className="text-[12px] leading-relaxed text-ink-2">
              To obtain access, send your Firebase UID to a RAKSA Basecamp Administrator so they can assign an authorized role via Firebase Admin provisioning. Protected hiker locations and SOS alerts remain blocked by Firebase Security Rules.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button className="btn" disabled={checking} onClick={handleRecheck}>
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                {checking ? 'Checking…' : 'Re-check Authorization'}
              </button>
              <button className="btn btn-danger" onClick={() => void signOutUser()}>
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
