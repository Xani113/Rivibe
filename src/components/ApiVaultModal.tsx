import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, RotateCcw, X } from 'lucide-react';
import type { ApiVault } from '../types/music';
import { PUBLIC_MUSIC_API_DIRECTORY } from '../services/musicApis';

interface ApiVaultModalProps {
  isOpen: boolean;
  vault: ApiVault;
  onSave: (next: ApiVault) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ApiVaultModal({
  isOpen,
  vault,
  onSave,
  onReset,
  onClose,
}: ApiVaultModalProps) {
  const [draft, setDraft] = useState<ApiVault>(vault);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(vault);
    if (isOpen) closeRef.current?.focus();
  }, [vault, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Public Music APIs & Key Vault"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-[rgba(12,9,7,0.78)] backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="rv-window-glass rounded-[28px] w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,244,230,0.12)]">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-[#f0c46c]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#fbf7f2]">
                Public Music APIs & Key Vault
              </h2>
              <p className="text-xs text-[rgba(247,239,230,0.64)]">
                Sourced from public-apis/public-apis#music · Keys stay local in your browser
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close API vault"
            onClick={onClose}
            className="rv-interactive-btn w-10 h-10 rounded-full bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[#fbf7f2]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto rv-scroll p-6 space-y-5">
          {/* Active Zero-Key Connectors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f0c46c]">
                Active Keyless Providers (Ready Out of the Box)
              </h3>
              <a
                href="https://github.com/public-apis/public-apis#music"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#f0c46c] hover:underline flex items-center gap-1"
              >
                public-apis#music
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PUBLIC_MUSIC_API_DIRECTORY.filter((p) => p.auth === 'No').map((api) => (
                <div
                  key={api.name}
                  className="p-2.5 rounded-xl bg-[rgba(255,248,240,0.06)] border border-[rgba(255,244,230,0.1)] flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#7cc49f] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#fbf7f2]">{api.name}</div>
                    <div className="text-[11px] text-[rgba(247,239,230,0.62)]">{api.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional API Keys */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f0c46c]">
              Full-Song YouTube Catalog & Optional API Keys
            </h3>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                YouTube Data API v3 Key (Google Cloud Console — Full-Length Songs & YT Music Search)
              </span>
              <input
                type="password"
                value={draft.youtubeApiKey}
                onChange={(e) => setDraft({ ...draft, youtubeApiKey: e.target.value })}
                placeholder="AIza... (enables full-length YouTube IFrame playback)"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
              <span className="block text-[11px] text-[rgba(247,239,230,0.56)]">
                Google has no standalone YouTube Music REST key — enabling YouTube Data API v3 in Google Cloud Console unlocks music search and full-length songs.
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                Next.js Cloud Backend URL (leave blank in dev to use /api proxy)
              </span>
              <input
                type="text"
                value={draft.backendUrl}
                onChange={(e) => setDraft({ ...draft, backendUrl: e.target.value })}
                placeholder="http://localhost:3001"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                Last.fm API Key (track.getSimilar & artist.getSimilar)
              </span>
              <input
                type="password"
                value={draft.lastfmApiKey}
                onChange={(e) => setDraft({ ...draft, lastfmApiKey: e.target.value })}
                placeholder="Optional Last.fm API key"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                TasteDive API Key (similar artist graph)
              </span>
              <input
                type="password"
                value={draft.tastediveApiKey}
                onChange={(e) => setDraft({ ...draft, tastediveApiKey: e.target.value })}
                placeholder="Optional TasteDive API key"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                Jamendo Client ID (full-length Creative Commons streams)
              </span>
              <input
                type="password"
                value={draft.jamendoClientId}
                onChange={(e) => setDraft({ ...draft, jamendoClientId: e.target.value })}
                placeholder="Optional Jamendo Client ID"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                TheAudioDB API Key (defaults to public key 123)
              </span>
              <input
                type="text"
                value={draft.theAudioDbApiKey}
                onChange={(e) => setDraft({ ...draft, theAudioDbApiKey: e.target.value })}
                placeholder="123"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#fbf7f2]">
                GitHub Repository URL (for Android APK Releases link)
              </span>
              <input
                type="url"
                value={draft.githubRepoUrl}
                onChange={(e) => setDraft({ ...draft, githubRepoUrl: e.target.value })}
                placeholder="https://github.com/yourname/rivibe"
                className="w-full px-3.5 py-2 rounded-xl bg-[rgba(18,14,11,0.45)] border border-[rgba(255,244,230,0.16)] text-xs text-[#fbf7f2]"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,244,230,0.12)]">
            <button
              type="button"
              onClick={onReset}
              className="rv-interactive-btn px-3.5 py-2 rounded-full bg-[rgba(255,248,240,0.08)] hover:bg-[rgba(255,248,240,0.14)] text-xs text-[rgba(247,239,230,0.82)] flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset Keys
            </button>

            <button
              type="submit"
              className="rv-interactive-btn px-5 py-2 rounded-full bg-[#f0c46c] text-[#1a140f] text-xs font-semibold"
            >
              Save API Vault
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
