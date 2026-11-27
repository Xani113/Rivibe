import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, LogOut, UserCheck, X } from 'lucide-react';
import type { CloudUser } from '../types/music';

interface AuthModalProps {
  isOpen: boolean;
  cloudUser: CloudUser | null;
  backendOnline: boolean;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

export function AuthModal({
  isOpen,
  cloudUser,
  backendOnline,
  onSignIn,
  onSignUp,
  onSignOut,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      closeRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const err =
        mode === 'login'
          ? await onSignIn(email, password)
          : await onSignUp(email, password, displayName);
      if (err) {
        setError(err);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="RiVibe Cloud Account"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-[rgba(12,9,7,0.78)] backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="rv-window-glass rounded-[28px] w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,244,230,0.12)]">
          <div className="flex items-center gap-2.5">
            {backendOnline ? (
              <Cloud className="w-5 h-5 text-[#7cc49f]" aria-hidden="true" />
            ) : (
              <CloudOff className="w-5 h-5 text-[#f0c46c]" aria-hidden="true" />
            )}
            <div>
              <h2 className="text-base font-semibold text-[#fbf7f2]">RiVibe Cloud Sync</h2>
              <p className="text-xs text-[rgba(247,239,230,0.64)]">
                {backendOnline
                  ? 'Next.js + SQLite Cloud Backend Connected'
                  : 'Offline mode · Start Next.js backend (:3001) to sync'}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close cloud account modal"
            onClick={onClose}
            className="rv-interactive-btn w-10 h-10 rounded-full bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[#fbf7f2]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          {cloudUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[rgba(255,248,240,0.08)] border border-[rgba(124,196,159,0.35)] flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-[rgba(124,196,159,0.2)] text-[#7cc49f] flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#fbf7f2] truncate">
                    {cloudUser.displayName}
                  </div>
                  <div className="text-xs text-[rgba(247,239,230,0.66)] truncate">
                    {cloudUser.email}
                  </div>
                  <div className="text-[11px] text-[#7cc49f] mt-0.5">
                    Playlists, likes & taste vector synced
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onSignOut().then(onClose)}
                className="rv-interactive-btn w-full py-2.5 rounded-full bg-[rgba(232,122,100,0.2)] hover:bg-[rgba(232,122,100,0.3)] border border-[rgba(232,122,100,0.35)] text-[#fbf7f2] text-xs font-semibold flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
              <div className="flex rounded-full p-1 bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.12)]">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold ${
                    mode === 'login' ? 'bg-[#f0c46c] text-[#1a140f]' : 'text-[rgba(247,239,230,0.72)]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold ${
                    mode === 'register'
                      ? 'bg-[#f0c46c] text-[#1a140f]'
                      : 'text-[rgba(247,239,230,0.72)]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {mode === 'register' ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#fbf7f2]">Display Name</span>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Manoj"
                    className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
                  />
                </label>
              ) : null}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#fbf7f2]">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#fbf7f2]">
                  Password {mode === 'register' ? '(8+ characters)' : ''}
                </span>
                <input
                  type="password"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
                />
              </label>

              {error ? (
                <p role="alert" className="text-xs text-[#e87a64]">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="rv-interactive-btn w-full py-2.5 rounded-full bg-[#f0c46c] text-[#1a140f] text-xs font-semibold disabled:opacity-60"
              >
                {submitting
                  ? 'Connecting...'
                  : mode === 'login'
                    ? 'Sign In & Sync Playlists'
                    : 'Create Cloud Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
