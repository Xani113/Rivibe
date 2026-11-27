import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, GitBranch, Globe, Smartphone, X } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface GetAppModalProps {
  isOpen: boolean;
  githubRepoUrl: string;
  onClose: () => void;
}

export function GetAppModal({ isOpen, githubRepoUrl, onClose }: GetAppModalProps) {
  const { canInstallNatively, isInstalled, promptInstall } = useInstallPrompt();
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const releasesUrl = `${githubRepoUrl.replace(/\/$/, '')}/releases`;

  const handleChromeInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setInstallFeedback('RiVibe installed! Check your home screen or Chrome Apps.');
    } else if (outcome === 'dismissed') {
      setInstallFeedback('Install dismissed — you can install anytime from Chrome menu.');
    } else {
      setInstallFeedback('In Chrome, open the menu (⋮) → "Install RiVibe" or "Add to Home Screen".');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Get RiVibe on Mobile"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-[rgba(12,9,7,0.78)] backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="rv-window-glass rounded-[28px] w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,244,230,0.12)]">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#f0c46c]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#fbf7f2]">Get RiVibe on Mobile</h2>
              <p className="text-xs text-[rgba(247,239,230,0.64)]">
                Portrait & side-wise spatial mode · Install via Chrome or GitHub APK
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close get app modal"
            onClick={onClose}
            className="rv-interactive-btn w-10 h-10 rounded-full bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[#fbf7f2]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto rv-scroll">
          {/* Option 1: Chrome PWA */}
          <div className="p-4 rounded-2xl bg-[rgba(255,248,240,0.08)] border border-[rgba(255,244,230,0.16)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#f0c46c]" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#fbf7f2]">
                  Install Directly from Chrome (PWA)
                </h3>
              </div>
              {isInstalled ? (
                <span className="inline-flex items-center gap-1 text-xs text-[#7cc49f] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Installed
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[rgba(247,239,230,0.72)] text-pretty">
              Installs instantly as a standalone mobile or desktop app with offline library caching
              and lock-screen Media Session controls. Rotate your phone sideways for the spatial
              side-wise rail layout.
            </p>
            <button
              type="button"
              onClick={() => void handleChromeInstall()}
              className="rv-interactive-btn px-4 py-2.5 rounded-full bg-[#f0c46c] text-[#1a140f] text-xs font-semibold inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {canInstallNatively ? 'Install RiVibe via Chrome' : 'How to Install in Chrome'}
            </button>
            {installFeedback ? (
              <p className="text-xs text-[#f0c46c]">{installFeedback}</p>
            ) : null}
          </div>

          {/* Option 2: GitHub Android APK */}
          <div className="p-4 rounded-2xl bg-[rgba(255,248,240,0.08)] border border-[rgba(255,244,230,0.16)] space-y-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#fbf7f2]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#fbf7f2]">
                Download APK from GitHub (Android Sideload)
              </h3>
            </div>
            <p className="text-xs text-[rgba(247,239,230,0.72)] text-pretty">
              Capacitor Android packaging + GitHub Actions workflow (`ci-and-release.yml`)
              builds <code>rivibe-android.apk</code> automatically for Android phones.
            </p>
            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="rv-interactive-btn px-4 py-2.5 rounded-full bg-[rgba(255,248,240,0.16)] hover:bg-[rgba(255,248,240,0.24)] border border-[rgba(255,244,230,0.22)] text-[#fbf7f2] text-xs font-semibold inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Open GitHub Releases (rivibe-android.apk)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
