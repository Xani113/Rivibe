import { useState, type RefObject } from 'react';
import {
  Check,
  Cloud,
  Download,
  KeyRound,
  Menu,
  Mic,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { ApiVault, CloudUser, MoodId } from '../types/music';
import { getTimeGreeting } from '../utils/formatTime';

interface TopHeaderProps {
  displayName: string;
  mixCount: number;
  trackCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeMood: MoodId;
  onMoodChange: (mood: MoodId) => void;
  fullOnly: boolean;
  onToggleFullOnly: () => void;
  cloudUser: CloudUser | null;
  backendOnline: boolean;
  onOpenAuth: () => void;
  onUpdateDisplayName: (name: string) => void;
  onOpenApiVault: () => void;
  onOpenGetApp: () => void;
  onOpenMobileMenu: () => void;
  onSurpriseVibe: () => void;
  apiVault: ApiVault;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

const MOOD_CHIPS: Array<{ id: MoodId; label: string }> = [
  { id: 'all', label: 'All Vibes' },
  { id: 'for-you', label: 'For You' },
  { id: 'chill', label: 'Chill' },
  { id: 'focus', label: 'Focus' },
  { id: 'late-night', label: 'Late Night' },
  { id: 'workout', label: 'Workout' },
  { id: 'indie', label: 'Indie' },
  { id: 'jazz', label: 'Jazz' },
];

export function TopHeader({
  displayName,
  mixCount,
  trackCount,
  searchQuery,
  onSearchChange,
  activeMood,
  onMoodChange,
  fullOnly,
  onToggleFullOnly,
  cloudUser,
  backendOnline,
  onOpenAuth,
  onUpdateDisplayName,
  onOpenApiVault,
  onOpenGetApp,
  onOpenMobileMenu,
  onSurpriseVibe,
  apiVault,
  searchInputRef,
}: TopHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const greeting = getTimeGreeting();

  const customKeysCount = [
    apiVault.youtubeApiKey,
    apiVault.lastfmApiKey,
    apiVault.tastediveApiKey,
    apiVault.jamendoClientId,
    apiVault.geniusAccessToken,
    apiVault.spotifyClientId,
  ].filter((v) => v.trim().length > 0).length;

  const commitName = () => {
    onUpdateDisplayName(draftName);
    setEditingName(false);
  };

  return (
    <header className="space-y-3.5 min-w-0">
      {/* Greeting + Action Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            aria-label="Open library menu"
            onClick={onOpenMobileMenu}
            className="rv-interactive-btn rv-mobile-menu-btn md:hidden w-10 h-10 rounded-full bg-[rgba(255,248,240,0.12)] border border-[rgba(255,244,230,0.18)] flex items-center justify-center text-[#fbf7f2] shrink-0"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitName()}
                  aria-label="Your display name"
                  className="px-3 py-1 rounded-xl bg-[rgba(255,248,240,0.14)] border border-[#f0c46c] text-lg font-semibold text-[#fbf7f2] w-36 sm:w-44 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onClick={commitName}
                  className="w-9 h-9 rounded-full bg-[#f0c46c] text-[#1a140f] flex items-center justify-center"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <h1 className="text-[19px] sm:text-[28px] font-semibold tracking-tight text-[#fbf7f2] text-balance leading-tight">
                {greeting},{' '}
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(displayName);
                    setEditingName(true);
                  }}
                  title="Click to customize name"
                  className="rounded-lg px-1 -mx-1 hover:bg-[rgba(255,248,240,0.12)] hover:text-[#f0c46c] transition-colors"
                >
                  {displayName}
                </button>
              </h1>
            )}
            <p className="text-[12px] sm:text-[13px] text-[rgba(247,239,230,0.68)] tabular-nums mt-0.5 truncate">
              {mixCount} Personalized Mixes · {trackCount} Tracks Ready
            </p>
          </div>
        </div>

        {/* Right Actions: Cloud Account + API Keys Vault + Get Mobile App */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            aria-label="Cloud Account"
            onClick={onOpenAuth}
            className="rv-interactive-btn min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-full bg-[rgba(255,248,240,0.11)] hover:bg-[rgba(255,248,240,0.18)] border border-[rgba(255,244,230,0.16)] flex items-center gap-1.5 text-xs font-medium text-[#fbf7f2]"
          >
            <Cloud
              className={`w-3.5 h-3.5 ${
                cloudUser ? 'text-[#7cc49f]' : backendOnline ? 'text-[#f0c46c]' : 'text-[rgba(247,239,230,0.62)]'
              }`}
              aria-hidden="true"
            />
            <span className="hidden md:inline max-w-[90px] truncate">
              {cloudUser ? cloudUser.displayName : 'Sign In'}
            </span>
          </button>

          <button
            type="button"
            aria-label="API Keys"
            onClick={onOpenApiVault}
            className="rv-interactive-btn min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-full bg-[rgba(255,248,240,0.11)] hover:bg-[rgba(255,248,240,0.18)] border border-[rgba(255,244,230,0.16)] flex items-center gap-1.5 text-xs font-medium text-[#fbf7f2]"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#f0c46c]" aria-hidden="true" />
            <span className="hidden sm:inline">API Keys</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[rgba(240,196,108,0.18)] text-[#f0c46c] tabular-nums text-[10px] font-semibold">
              {7 + customKeysCount}
            </span>
          </button>

          <button
            type="button"
            aria-label="Get App"
            onClick={onOpenGetApp}
            className="rv-interactive-btn min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[rgba(240,196,108,0.20)] hover:bg-[rgba(240,196,108,0.30)] border border-[rgba(240,196,108,0.36)] flex items-center gap-1.5 text-xs font-semibold text-[#fbf7f2]"
          >
            <Download className="w-3.5 h-3.5 text-[#f0c46c]" aria-hidden="true" />
            <span className="sm:hidden">App</span>
            <span className="hidden sm:inline">Get App</span>
          </button>
        </div>
      </div>

      {/* Prominent Frosted Search Capsule */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-[rgba(247,239,230,0.62)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search in Albums, Tracks, Artists..."
            aria-label="Search in Albums, Tracks, Artists"
            className="w-full min-h-[44px] pl-10 pr-20 rounded-2xl bg-[rgba(20,16,12,0.34)] border border-[rgba(255,244,230,0.16)] text-sm text-[#fbf7f2] placeholder:text-[rgba(247,239,230,0.52)] focus:outline-none focus:border-[#f0c46c] focus:bg-[rgba(20,16,12,0.5)] transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange('')}
                className="w-8 h-8 rounded-full hover:bg-[rgba(255,248,240,0.14)] flex items-center justify-center text-[rgba(247,239,230,0.72)]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              title="Discover a serendipitous genre"
              aria-label="Surprise vibe search"
              onClick={onSurpriseVibe}
              className="w-8 h-8 rounded-full bg-[rgba(255,248,240,0.10)] hover:bg-[rgba(240,196,108,0.22)] flex items-center justify-center text-[#f0c46c]"
            >
              <Mic className="w-3.5 h-3.5 hidden" aria-hidden="true" />
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Mood Filter Chips + Full Songs Toggle */}
      <div
        role="group"
        aria-label="Mood filters"
        className="flex items-center gap-2 overflow-x-auto pb-1 rv-scroll"
      >
        <button
          type="button"
          onClick={onToggleFullOnly}
          aria-pressed={fullOnly}
          className={`rv-interactive-btn shrink-0 px-3.5 py-1.5 min-h-[34px] rounded-full text-xs font-semibold border ${
            fullOnly
              ? 'bg-[#7cc49f] text-[#111914] border-[#7cc49f]'
              : 'bg-[rgba(124,196,159,0.12)] text-[#7cc49f] border-[rgba(124,196,159,0.32)] hover:bg-[rgba(124,196,159,0.22)]'
          }`}
        >
          {fullOnly ? 'Full Songs Only ✓' : 'Full Songs'}
        </button>

        {MOOD_CHIPS.map((chip) => {
          const active = activeMood === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onMoodChange(chip.id)}
              aria-pressed={active}
              className={`rv-interactive-btn shrink-0 px-3.5 py-1.5 min-h-[34px] rounded-full text-xs font-medium border ${
                active
                  ? 'bg-[#f0c46c] text-[#1a140f] border-[#f0c46c] font-semibold'
                  : 'bg-[rgba(255,248,240,0.08)] text-[rgba(247,239,230,0.82)] border-[rgba(255,244,230,0.14)] hover:bg-[rgba(255,248,240,0.16)]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
