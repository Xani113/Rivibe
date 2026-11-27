import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  LogOut,
  RotateCcw,
  Settings,
  Smartphone,
  UserCheck,
  X,
} from 'lucide-react';
import type { ApiVault, CloudUser } from '../types/music';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { isNativeAndroidPlaybackAvailable } from '../services/nativeMusicBridge';

interface SettingsModalProps {
  isOpen: boolean;
  vault: ApiVault;
  cloudUser: CloudUser | null;
  backendOnline: boolean;
  onSaveVault: (next: ApiVault) => void;
  onResetVault: () => void;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  vault,
  cloudUser,
  backendOnline,
  onSaveVault,
  onResetVault,
  onSignIn,
  onSignUp,
  onSignOut,
  onClose,
}: SettingsModalProps) {
  const { canInstallNatively, isInstalled, promptInstall } = useInstallPrompt();
  const [draft, setDraft] = useState<ApiVault>(vault);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const nativeAndroid = isNativeAndroidPlaybackAvailable();

  useEffect(() => {
    setDraft(vault);
    setSavedToast(false);
    setAuthError(null);
    if (isOpen) closeRef.current?.focus();
  }, [vault, isOpen]);

  if (!isOpen) return null;

  const releasesUrl = `${vault.githubRepoUrl.replace(/\/$/, '')}/releases`;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveVault(draft);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2000);
  };

  const handleChromeInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setInstallFeedback('RiVibe installed! Check Chrome Apps or your home screen.');
    } else if (outcome === 'dismissed') {
      setInstallFeedback('Install dismissed — install anytime from your browser menu.');
    } else {
      setInstallFeedback('Open Chrome menu (⋮) → "Install RiVibe" or "Add to Home Screen".');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const err =
        authMode === 'login'
          ? await onSignIn(email, password)
          : await onSignUp(email, password, displayName);
      if (err) setAuthError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="RiVibe Settings"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-[rgba(4,6,10,0.76)] backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl max-h-[88dvh] rounded-2xl bg-[#0d1017] border border-[rgba(255,255,255,0.12)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#22d3a6]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-[#f4f5f7]">Settings</h2>
              <p className="text-xs text-[rgba(244,245,247,0.55)]">
                Playback engine, mobile app & optional sync
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="rv-interactive-btn w-9 h-9 rounded-lg bg-[#161b26] hover:bg-[#1f2636] flex items-center justify-center text-[#f4f5f7]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto rv-scroll p-5 space-y-6">
          {/* Audio Engine Status + YouTube Web Key */}
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#121620] border border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#f4f5f7]">
                  {nativeAndroid
                    ? 'Android Native Media3 + Keyless Innertube'
                    : 'Browser Audio + YouTube / Audius'}
                </div>
                <div className="text-[11px] text-[rgba(244,245,247,0.58)] mt-0.5">
                  {nativeAndroid
                    ? 'Full-length YouTube Music streams work natively with zero keys.'
                    : 'Audius full tracks play instantly; optional YouTube key unlocks YT catalog in browser.'}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-[#22d3a6] shrink-0" aria-hidden="true" />
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#f4f5f7]">
                YouTube Data API v3 Key (Optional for Web)
              </span>
              <input
                type="password"
                value={draft.youtubeApiKey}
                onChange={(e) => setDraft({ ...draft, youtubeApiKey: e.target.value })}
                placeholder="AIza... (optional for web YouTube search)"
                className="w-full px-3.5 py-2 rounded-lg bg-[#121620] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7] focus:outline-none focus:border-[#22d3a6]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#f4f5f7]">
                Self-Hosted Cloud Server URL (Optional)
              </span>
              <input
                type="text"
                value={draft.backendUrl}
                onChange={(e) => setDraft({ ...draft, backendUrl: e.target.value })}
                placeholder="http://localhost:3001"
                className="w-full px-3.5 py-2 rounded-lg bg-[#121620] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7] focus:outline-none focus:border-[#22d3a6]"
              />
            </label>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onResetVault}
                className="rv-interactive-btn px-3 py-1.5 rounded-lg bg-[#161b26] text-xs text-[rgba(244,245,247,0.75)] hover:text-[#f4f5f7] inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
              <button
                type="submit"
                className="rv-interactive-btn px-4 py-1.5 rounded-lg bg-[#22d3a6] text-[#042019] text-xs font-bold"
              >
                {savedToast ? 'Saved ✓' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Mobile App / APK Download */}
          <section className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[rgba(244,245,247,0.55)] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
                Get RiVibe on Mobile
              </h3>
              {isInstalled ? (
                <span className="text-[11px] font-semibold text-[#22d3a6]">PWA Installed</span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleChromeInstall()}
                className="rv-interactive-btn px-3.5 py-2 rounded-lg bg-[#161b26] hover:bg-[#1e2433] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
                {canInstallNatively ? 'Install App' : 'Install via Chrome'}
              </button>

              <a
                href={releasesUrl}
                target="_blank"
                rel="noreferrer"
                className="rv-interactive-btn px-3.5 py-2 rounded-lg bg-[#161b26] hover:bg-[#1e2433] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Android APK Releases
              </a>
            </div>
            {installFeedback ? (
              <p className="text-xs text-[#22d3a6]">{installFeedback}</p>
            ) : null}
          </section>

          {/* Optional Cloud Library Sync */}
          <section className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[rgba(244,245,247,0.55)] flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
                Cloud Library Sync
              </h3>
              <span className="text-[11px] text-[rgba(244,245,247,0.5)]">
                {backendOnline ? 'Server Online' : 'Local Storage Active'}
              </span>
            </div>

            {cloudUser ? (
              <div className="p-3 rounded-xl bg-[#121620] border border-[rgba(34,211,166,0.3)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserCheck className="w-4 h-4 text-[#22d3a6] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#f4f5f7] truncate">
                      {cloudUser.displayName}
                    </div>
                    <div className="text-[11px] text-[rgba(244,245,247,0.55)] truncate">
                      {cloudUser.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="px-3 py-1.5 rounded-lg bg-[rgba(248,113,113,0.14)] text-[#f87171] text-xs font-semibold inline-flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-2.5">
                <div className="flex rounded-lg p-1 bg-[#121620] border border-[rgba(255,255,255,0.08)]">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 py-1 rounded-md text-xs font-semibold ${
                      authMode === 'login' ? 'bg-[#22d3a6] text-[#042019]' : 'text-[rgba(244,245,247,0.65)]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 py-1 rounded-md text-xs font-semibold ${
                      authMode === 'register'
                        ? 'bg-[#22d3a6] text-[#042019]'
                        : 'text-[rgba(244,245,247,0.65)]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {authMode === 'register' ? (
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    aria-label="Display name"
                    className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7]"
                  />
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    aria-label="Email"
                    className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7]"
                  />
                  <input
                    type="password"
                    required
                    minLength={authMode === 'register' ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7]"
                  />
                </div>

                {authError ? (
                  <p role="alert" className="text-xs text-[#f87171]">
                    {authError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rv-interactive-btn px-4 py-2 rounded-lg bg-[#161b26] hover:bg-[#1e2433] border border-[rgba(255,255,255,0.12)] text-xs font-semibold text-[#f4f5f7] disabled:opacity-60"
                >
                  {submitting
                    ? 'Connecting...'
                    : authMode === 'login'
                      ? 'Sign In & Sync'
                      : 'Create Sync Account'}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
