import { Loader2, Lock } from 'lucide-react';
import { Logo } from '../components/ui';

/** Shown while Firebase Auth & role authorization are being verified on initial load. */
export function AuthLoadingView() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4">
      <div className="panel flex w-full max-w-[360px] flex-col items-center p-6 text-center shadow-float">
        <Logo size={34} />
        <div className="mt-3 text-[15px] font-extrabold tracking-[0.12em] text-ink">RAKSA</div>
        <div className="mt-2 flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
          <Loader2 size={15} className="animate-spin text-forest" />
          Verifying personnel authorization…
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Lock size={11} />
          Protected data stays locked until verified
        </div>
      </div>
    </div>
  );
}
