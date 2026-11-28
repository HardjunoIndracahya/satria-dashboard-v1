import { useState } from 'react';
import { LogIn, LogOut, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Modal } from './ui';
import { useAuth } from '../store/auth';
import { useUi } from '../store/ui';
import { signInOperator, signOutOperator } from '../lib/firebaseAuth';

export function OperatorAuthModal() {
  const open = useUi((s) => s.authModalOpen);
  const close = useUi((s) => s.closeAuthModal);
  const user = useAuth((s) => s.user);
  const authAvailable = useAuth((s) => s.authAvailable);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const op = await signInOperator(email, password);
      setPassword('');
      toast.success(`Signed in as ${op.displayName}`);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    setLoading(true);
    try {
      await signOutOperator();
      toast('Operator signed out');
      close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !loading && close()}
      width={440}
      title="Basecamp Operator Authentication"
      subtitle="Authorized sign-in is required to acknowledge SOS alerts and confirm hiker rescues."
    >
      {user ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-ctl border border-forest/30 bg-forest-tint p-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" />
            <div className="min-w-0 text-[12.5px]">
              <div className="font-bold text-ink">{user.displayName}</div>
              <div className="num truncate text-ink-2">{user.email}</div>
              <div className="num mt-1 text-[11px] text-ink-muted">UID: {user.uid}</div>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-2">
            Your operator identity and server timestamps are recorded in Firebase whenever you acknowledge or resolve an SOS incident. Ensure your UID is registered under <code className="num">/operators/{user.uid}</code> in Firebase Realtime Database.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={close}>Close</button>
            <button className="btn btn-danger" disabled={loading} onClick={onSignOut}>
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      ) : !authAvailable ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-ctl border border-amber/40 bg-amber-tint p-3 text-[12.5px] leading-relaxed text-amber-ink">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Firebase Authentication is not configured yet</div>
              <p className="mt-1">
                To authorize Basecamp operators, fill in <code className="num">apiKey</code> and <code className="num">authDomain</code> in <code className="num">firebase-config.js</code>, enable <strong>Email/Password</strong> in Firebase Console → Authentication, create an operator account, and add its UID under <code className="num">/operators/&lt;uid&gt;: true</code>.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn" onClick={close}>Close</button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSignIn} className="space-y-3.5">
          <Field label="Operator Email">
            <input
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@basecamp.org"
              autoComplete="username"
              required
              autoFocus
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>
          {error && (
            <p className="rounded-ctl border border-crimson/30 bg-crimson-tint p-2.5 text-[12px] font-medium text-crimson">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="btn" disabled={loading} onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !email.trim() || !password}>
              <LogIn size={14} />
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
