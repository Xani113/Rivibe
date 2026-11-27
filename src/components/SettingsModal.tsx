import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  RotateCcw,
  Settings,
  Smartphone,
  X,
} from 'lucide-react';
import type { ApiVault } from '../types/music';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useAnimatedOverlay } from '../hooks/useAnimatedOverlay';
import { isNativeAndroidPlaybackAvailable } from '../services/nativeMusicBridge';

interface SettingsModalProps {
  isOpen: boolean;
  vault: ApiVault;
  onSaveVault: (next: ApiVault) => void;
  onResetVault: () => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  vault,
  onSaveVault,
  onResetVault,
  onClose,
}: SettingsModalProps) {
  const { canInstallNatively, isInstalled, promptInstall } = useInstallPrompt();
  const { shouldRender, isVisible } = useAnimatedOverlay(isOpen, 220);
  const [draft, setDraft] = useState<ApiVault>(vault);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const nativeAndroid = isNativeAndroidPlaybackAvailable();

  useEffect(() => {
    setDraft(vault);
    setSavedToast(false);
    if (isOpen) closeRef.current?.focus();
  }, [vault, isOpen]);

  if (!shouldRender) return null;

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

  return (
    <div
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      aria-label="RiVibe Settings"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 bg-[rgba(4,6,10,0.76)] backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-220 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`w-full max-w-lg max-h-[85dvh] rounded-2xl bg-[#0d1017] border border-[rgba(255,255,255,0.12)] flex flex-col overflow-hidden shadow-2xl transition-transform duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-3 scale-95'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#22d3a6]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-[#f4f5f7]">Settings</h2>
              <p className="text-xs text-[rgba(244,245,247,0.55)]">Audio engine & app downloads</p>
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

        <div className="flex-1 overflow-y-auto rv-scroll p-5 space-y-5">
          {/* Audio Engine Status */}
          <div className="p-3.5 rounded-xl bg-[#121620] border border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-[#f4f5f7]">
                {nativeAndroid
                  ? 'Android Native Media3 + Keyless Innertube'
                  : 'Browser Audio + YouTube / Audius'}
              </div>
              <div className="text-[11px] text-[rgba(244,245,247,0.58)] mt-0.5">
                {nativeAndroid
                  ? 'Full-length YouTube Music streaming & recommendations work natively with zero API keys.'
                  : 'Audius full tracks play instantly; optional YouTube key unlocks full songs in browser.'}
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-[#22d3a6] shrink-0" aria-hidden="true" />
          </div>

          {/* Web-Only Optional YouTube API Key */}
          {!nativeAndroid ? (
            <form onSubmit={handleSave} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#f4f5f7]">
                  YouTube Data API v3 Key (Optional for Web Browser)
                </span>
                <input
                  type="password"
                  value={draft.youtubeApiKey}
                  onChange={(e) => setDraft({ ...draft, youtubeApiKey: e.target.value })}
                  placeholder="AIza..."
                  className="w-full px-3.5 py-2 rounded-lg bg-[#121620] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7] focus:outline-none focus:border-[#22d3a6]"
                />
              </label>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onResetVault}
                  className="rv-interactive-btn px-3 py-1.5 rounded-lg bg-[#161b26] text-xs text-[rgba(244,245,247,0.75)] hover:text-[#f4f5f7] inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Clear
                </button>
                <button
                  type="submit"
                  className="rv-interactive-btn px-4 py-1.5 rounded-lg bg-[#22d3a6] text-[#042019] text-xs font-bold"
                >
                  {savedToast ? 'Saved ✓' : 'Save Key'}
                </button>
              </div>
            </form>
          ) : null}

          {/* Mobile App / APK Download */}
          <section className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[rgba(244,245,247,0.55)] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
                Get RiVibe App
              </h3>
              {isInstalled ? (
                <span className="text-[11px] font-semibold text-[#22d3a6]">PWA Installed</span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {!nativeAndroid ? (
                <button
                  type="button"
                  onClick={() => void handleChromeInstall()}
                  className="rv-interactive-btn px-3.5 py-2 rounded-lg bg-[#161b26] hover:bg-[#1e2433] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
                  {canInstallNatively ? 'Install App' : 'Install via Chrome'}
                </button>
              ) : null}

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
        </div>
      </div>
    </div>
  );
}
