import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '../components/ui';
import { useAuth } from '../store/auth';
import { requestPasswordReset, signInWithEmail } from '../lib/firebaseAuth';

/** Subtle decorative Swiss-GIS topographic contour backdrop — contains zero real GPS data. */
function TopoBackdrop() {
  return (
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.38]"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
      aria-hidden
    >
      <defs>
        <pattern id="grid-lines" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#DCE2DE" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="1200" height="800" fill="url(#grid-lines)" />
      <g fill="none" stroke="#B7C4BC" strokeWidth="1.1">
        <path d="M-40 680 C 180 540, 320 440, 560 470 S 940 640, 1240 500" />
        <path d="M-40 610 C 200 470, 350 370, 580 400 S 960 570, 1240 420" />
        <path d="M-40 540 C 220 400, 380 310, 600 330 S 980 490, 1240 340" stroke="#166534" strokeOpacity="0.28" />
        <path d="M-40 470 C 240 340, 410 250, 630 270 S 1000 410, 1240 260" />
        <path d="M120 820 C 340 680, 500 620, 740 660 S 1040 760, 1240 660" />
      </g>
    </svg>
  );
}

export function LoginView() {
  const authAvailable = useAuth((s) => s.authAvailable);
  const storeError = useAuth((s) => s.error);

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const displayError = error ?? storeError ?? null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password, rememberSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setResetSent(false);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-canvas px-4 py-8">
      <TopoBackdrop />

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-panel border border-forest/20 bg-surface shadow-float">
            <Logo size={34} />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-forest/25 bg-forest-tint px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-forest">
            <Lock size={11} />
            Restricted Operational System
          </div>
          <h1 className="mt-2.5 text-[20px] font-extrabold tracking-[0.08em] text-ink sm:text-[22px]">
            RAKSA BASECAMP COMMAND CENTER
          </h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Authorized Personnel Only — Secure Expedition Monitoring Access
          </p>
        </div>

        {/* Auth Card */}
        <main className="panel overflow-hidden shadow-float">
          <div className="border-b border-line bg-canvas/70 px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
                {mode === 'login' ? (
                  <>
                    <ShieldCheck size={15} className="text-forest" />
                    Personnel Sign In
                  </>
                ) : (
                  <>
                    <KeyRound size={15} className="text-forest" />
                    Reset Operator Password
                  </>
                )}
              </span>
              <span className="num text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
                Firebase Auth
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {!authAvailable && (
              <div className="mb-4 flex items-start gap-2.5 rounded-ctl border border-amber/40 bg-amber-tint p-3 text-[12px] leading-relaxed text-amber-ink">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Firebase Authentication not configured</div>
                  <p className="mt-0.5">
                    Configure <code className="num">apiKey</code>, <code className="num">authDomain</code>, and{' '}
                    <code className="num">databaseURL</code> in <code className="num">firebase-config.js</code> before signing in.
                  </p>
                </div>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <label className="block">
                  <span className="label mb-1.5 block">Work Email</span>
                  <div className="relative">
                    <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="email"
                      className="field !h-10 !pl-9"
                      placeholder="operator@basecamp.org"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={loading || !authAvailable}
                      required
                      autoFocus
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="label mb-1.5 block">Password</span>
                  <div className="relative">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="field !h-10 !pl-9 !pr-10"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={loading || !authAvailable}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-chip text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between gap-2 pt-0.5 text-[12.5px]">
                  <label className="flex cursor-pointer items-center gap-2 text-ink-2 select-none">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      disabled={loading || !authAvailable}
                      className="h-3.5 w-3.5 accent-forest"
                    />
                    <span>Remember session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                      setResetSent(false);
                    }}
                    className="font-semibold text-forest hover:underline"
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>

                {displayError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-ctl border border-crimson/35 bg-crimson-tint p-3 text-[12px] font-medium leading-relaxed text-crimson"
                  >
                    <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                    <span>{displayError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary h-10 w-full text-[13px]"
                  disabled={loading || !authAvailable || !email.trim() || !password}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Verifying credentials…
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      Sign In to Command Center
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-[12.5px] leading-relaxed text-ink-2">
                  Enter your authorized personnel email address. If an account exists, Firebase Authentication will send a password reset link.
                </p>
                <label className="block">
                  <span className="label mb-1.5 block">Authorized Email</span>
                  <div className="relative">
                    <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="email"
                      className="field !h-10 !pl-9"
                      placeholder="operator@basecamp.org"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading || !authAvailable}
                      required
                      autoFocus
                    />
                  </div>
                </label>

                {resetSent && (
                  <div className="flex items-start gap-2 rounded-ctl border border-forest/30 bg-forest-tint p-3 text-[12px] leading-relaxed text-forest">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    <span>Password reset instructions have been sent to <strong>{email.trim()}</strong>. Check your inbox and spam folder.</span>
                  </div>
                )}

                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-ctl border border-crimson/35 bg-crimson-tint p-3 text-[12px] font-medium text-crimson">
                    <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn h-10"
                    disabled={loading}
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setResetSent(false);
                    }}
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-10 flex-1"
                    disabled={loading || !authAvailable || !email.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Sending reset link…
                      </>
                    ) : (
                      'Send Password Reset Email'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Security Notice Footer — explicitly no public registration */}
          <div className="border-t border-line bg-canvas/60 px-5 py-3.5 text-[11.5px] leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">Security Notice</p>
            <p className="mt-0.5">
              This system contains confidential hiker location and emergency monitoring data. Access is restricted to authorized personnel. Public registration is disabled — new accounts and role assignments are provisioned exclusively by Basecamp Administrators.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
