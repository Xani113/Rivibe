import { useState } from 'react';
import {
  Home,
  Library,
  ListMusic,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import type { AppTab, Playlist } from '../types/music';
import { isNativeAndroidPlaybackAvailable } from '../services/nativeMusicBridge';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen';
import rivibeLogo from '../assets/rivibe-logo.png';

interface NavShellProps {
  activeTab: AppTab;
  playlists: Playlist[];
  activePlaylistId: string | null;
  queueCount: number;
  queueOpen: boolean;
  onSelectTab: (tab: AppTab) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  onToggleQueue: () => void;
  onOpenSettings: () => void;
}

const NAV_TABS: Array<{ id: AppTab; label: string; Icon: typeof Home }> = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'library', label: 'Library', Icon: Library },
];

export function NavShell({
  activeTab,
  playlists,
  activePlaylistId,
  queueCount,
  queueOpen,
  onSelectTab,
  onSelectPlaylist,
  onCreatePlaylist,
  onToggleQueue,
  onOpenSettings,
}: NavShellProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nativeAndroid = isNativeAndroidPlaybackAvailable();
  const keyboardOpen = useKeyboardOpen();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    onCreatePlaylist(draftName.trim());
    setDraftName('');
    setCreating(false);
  };

  return (
    <>
      {/* Desktop & Side-Wise Landscape Sidebar Rail */}
      <aside
        aria-label="Primary navigation"
        className="rv-sidebar-rail hidden md:flex flex-col w-[228px] shrink-0 bg-[#0d1017] border-r border-[rgba(255,255,255,0.08)] select-none"
      >
        {/* Brand Header */}
        <div className="px-4 pt-5 pb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={rivibeLogo}
              alt=""
              className="w-8 h-8 rounded-lg object-cover bg-[#0C101B] shrink-0"
            />
            <div className="rv-sidebar-label min-w-0">
              <div className="text-[15px] font-bold tracking-tight text-[#f4f5f7] leading-none">
                RiVibe
              </div>
              <div className="text-[10px] font-medium text-[rgba(244,245,247,0.48)] mt-1">
                {nativeAndroid ? 'Native Audio' : 'Music Studio'}
              </div>
            </div>
          </div>
        </div>

        {/* Core Tabs */}
        <nav aria-label="Main sections" className="px-2.5 space-y-1">
          {NAV_TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id && !activePlaylistId;
            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectTab(id)}
                className={`rv-interactive-btn relative w-full h-10 px-3 rounded-lg flex items-center gap-3 text-[13.5px] font-medium ${
                  active
                    ? 'bg-[rgba(255,255,255,0.09)] text-[#f4f5f7]'
                    : 'text-[rgba(244,245,247,0.62)] hover:text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.05)]'
                }`}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#22d3a6]"
                  />
                ) : null}
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#22d3a6]' : ''}`}
                  aria-hidden="true"
                />
                <span className="rv-sidebar-label truncate">{label}</span>
              </button>
            );
          })}

          {/* Queue Shortcut */}
          <button
            type="button"
            aria-label="Open playback queue"
            aria-pressed={queueOpen}
            onClick={onToggleQueue}
            className={`rv-interactive-btn w-full h-10 px-3 rounded-lg flex items-center justify-between gap-2 text-[13.5px] font-medium ${
              queueOpen
                ? 'bg-[rgba(34,211,166,0.14)] text-[#22d3a6]'
                : 'text-[rgba(244,245,247,0.62)] hover:text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <ListMusic className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="rv-sidebar-label truncate">Queue</span>
            </span>
            <span className="rv-sidebar-label px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[10px] tabular-nums font-semibold text-[#f4f5f7]">
              {queueCount}
            </span>
          </button>
        </nav>

        {/* Quick Playlists List */}
        <div className="rv-sidebar-label mt-6 px-3 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(244,245,247,0.45)]">
              Playlists
            </span>
            <button
              type="button"
              aria-label="Create playlist"
              title="New playlist"
              onClick={() => setCreating((v) => !v)}
              className="w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.65)] hover:text-[#f4f5f7]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {creating ? (
            <form onSubmit={handleCreate} className="mb-2 flex gap-1.5">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Playlist name..."
                aria-label="Playlist name"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#161b26] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7] placeholder:text-[rgba(244,245,247,0.4)] focus:outline-none focus:border-[#22d3a6]"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-[#22d3a6] text-[#042019] text-xs font-semibold"
              >
                Create
              </button>
            </form>
          ) : null}

          <div className="space-y-0.5 overflow-y-auto rv-scroll pr-1">
            {playlists.map((pl) => {
              const selected = activeTab === 'library' && activePlaylistId === pl.id;
              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => onSelectPlaylist(pl.id)}
                  className={`rv-interactive-btn w-full px-2 py-1.5 rounded-lg flex items-center gap-2.5 text-left text-xs ${
                    selected
                      ? 'bg-[rgba(255,255,255,0.1)] text-[#f4f5f7] font-semibold'
                      : 'text-[rgba(244,245,247,0.66)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f4f5f7]'
                  }`}
                >
                  <img
                    src={pl.coverUrl}
                    alt=""
                    className="w-6 h-6 rounded object-cover shrink-0 bg-[#161b26]"
                  />
                  <span className="truncate flex-1">{pl.name}</span>
                  <span className="text-[10px] text-[rgba(244,245,247,0.42)] tabular-nums">
                    {pl.trackIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Settings Button */}
        <div className="p-2.5 border-t border-[rgba(255,255,255,0.08)]">
          <button
            type="button"
            aria-label="Settings"
            onClick={onOpenSettings}
            className="rv-interactive-btn w-full h-10 px-3 rounded-lg flex items-center gap-3 text-[13px] font-medium text-[rgba(244,245,247,0.68)] hover:text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.05)]"
          >
            <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="rv-sidebar-label truncate">Settings</span>
          </button>
        </div>
      </aside>

      {/* Mobile Portrait Top Compact Bar */}
      <header
        className="rv-mobile-top-bar md:hidden sticky top-0 z-20 w-full shrink-0 px-4 pb-3 flex items-center justify-between bg-[rgba(9,11,16,0.94)] backdrop-blur-lg border-b border-[rgba(255,255,255,0.07)]"
        style={{ paddingTop: 'max(12px, var(--rv-safe-top))' }}
      >
        <div className="flex items-center gap-2">
          <img
            src={rivibeLogo}
            alt=""
            className="w-7 h-7 rounded-lg object-cover bg-[#0C101B] shrink-0"
          />
          <span className="text-[15px] font-bold tracking-tight text-[#f4f5f7]">RiVibe</span>
        </div>
      </header>

      {/* Mobile Portrait Bottom 4-Tab Bar (Home · Search · Library · Settings) */}
      <nav
        aria-label="Mobile bottom navigation"
        className={`rv-mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#0b0e14]/95 backdrop-blur-xl border-t border-[rgba(255,255,255,0.08)] flex items-center px-2 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          keyboardOpen
            ? 'translate-y-full opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
        style={{ paddingBottom: 'var(--rv-safe-bottom)' }}
      >
        {NAV_TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelectTab(id)}
              className={`rv-interactive-btn flex-1 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-[#22d3a6]' : 'text-[rgba(244,245,247,0.58)]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Settings"
          onClick={onOpenSettings}
          className="rv-interactive-btn flex-1 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[rgba(244,245,247,0.58)] hover:text-[#f4f5f7]"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>
    </>
  );
}
