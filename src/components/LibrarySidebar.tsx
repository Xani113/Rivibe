import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Disc3,
  LayoutGrid,
  Mic2,
  MoreHorizontal,
  Music2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import type { LibrarySection, Playlist } from '../types/music';

interface LibrarySidebarProps {
  activeSection: LibrarySection;
  activePlaylistId: string | null;
  playlists: Playlist[];
  onSelectSection: (section: LibrarySection) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  onOpenApiVault: () => void;
  onCloseMobileDrawer?: () => void;
}

const LIBRARY_ITEMS: Array<{
  id: LibrarySection;
  label: string;
  Icon: typeof Clock3;
  badge?: string;
}> = [
  { id: 'recently-added', label: 'Recently Added', Icon: Clock3 },
  { id: 'artists', label: 'Artists', Icon: Mic2 },
  { id: 'albums', label: 'Albums', Icon: Disc3 },
  { id: 'songs', label: 'Songs', Icon: Music2 },
  { id: 'made-for-you', label: 'Made For You', Icon: Sparkles, badge: 'AI' },
];

export function LibrarySidebar({
  activeSection,
  activePlaylistId,
  playlists,
  onSelectSection,
  onSelectPlaylist,
  onCreatePlaylist,
  onOpenApiVault,
  onCloseMobileDrawer,
}: LibrarySidebarProps) {
  const [playlistsExpanded, setPlaylistsExpanded] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="flex flex-col h-full p-5 select-none">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#fbf7f2] leading-tight">
            Library
          </h2>
          <p className="text-xs text-[rgba(247,239,230,0.62)] mt-0.5">All Music · RiVibe</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Open API keys and settings"
            title="API Vault & Settings"
            onClick={onOpenApiVault}
            className="rv-interactive-btn w-10 h-10 rounded-full bg-[rgba(255,248,240,0.10)] hover:bg-[rgba(255,248,240,0.18)] border border-[rgba(255,244,230,0.14)] flex items-center justify-center text-[#fbf7f2]"
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
          {onCloseMobileDrawer ? (
            <button
              type="button"
              aria-label="Close library menu"
              onClick={onCloseMobileDrawer}
              className="rv-interactive-btn w-10 h-10 rounded-full bg-[rgba(255,248,240,0.10)] hover:bg-[rgba(255,248,240,0.18)] flex items-center justify-center text-[#fbf7f2] md:hidden"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Primary Library Nav */}
      <nav aria-label="Library navigation" className="space-y-1">
        {LIBRARY_ITEMS.map(({ id, label, Icon, badge }) => {
          const isActive = activeSection === id && !activePlaylistId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelectSection(id);
                onCloseMobileDrawer?.();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`rv-interactive-btn w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-[14px] font-medium focus-visible:outline-2 focus-visible:outline-[#f0c46c] ${
                isActive
                  ? 'bg-[rgba(255,248,240,0.18)] text-[#fbf7f2] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                  : 'text-[rgba(247,239,230,0.78)] hover:bg-[rgba(255,248,240,0.09)] hover:text-[#fbf7f2]'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-[rgba(255,248,240,0.09)] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="flex-1 truncate">{label}</span>
              {badge ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(240,196,108,0.22)] text-[#f0c46c]">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Playlists Section */}
      <div className="mt-6 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-1 mb-2">
          <button
            type="button"
            onClick={() => setPlaylistsExpanded((v) => !v)}
            aria-expanded={playlistsExpanded}
            className="flex items-center gap-1.5 text-[15px] font-semibold text-[#fbf7f2] hover:opacity-90 min-h-[36px]"
          >
            <span>Playlists</span>
            {playlistsExpanded ? (
              <ChevronDown className="w-4 h-4 opacity-70" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4 opacity-70" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Create new playlist"
            onClick={() => setCreating((v) => !v)}
            className="rv-interactive-btn w-8 h-8 rounded-full hover:bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[rgba(247,239,230,0.76)]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {creating ? (
          <form onSubmit={handleCreate} className="mb-2.5 flex gap-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name..."
              aria-label="New playlist name"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[rgba(255,248,240,0.1)] border border-[rgba(255,244,230,0.18)] text-xs text-[#fbf7f2] placeholder:text-[rgba(247,239,230,0.45)] focus:outline-none focus:border-[#f0c46c]"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg bg-[#f0c46c] text-[#1a140f] text-xs font-semibold hover:brightness-105"
            >
              Add
            </button>
          </form>
        ) : null}

        {playlistsExpanded ? (
          <div className="space-y-1 overflow-y-auto rv-scroll pr-1">
            <button
              type="button"
              onClick={() => {
                onSelectSection('all-playlists');
                onCloseMobileDrawer?.();
              }}
              className={`rv-interactive-btn w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-[13.5px] font-medium ${
                activeSection === 'all-playlists' && !activePlaylistId
                  ? 'bg-[rgba(255,248,240,0.20)] text-[#fbf7f2] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-[rgba(247,239,230,0.75)] hover:bg-[rgba(255,248,240,0.09)]'
              }`}
            >
              <span className="w-7 h-7 rounded-lg bg-[rgba(255,248,240,0.12)] flex items-center justify-center shrink-0">
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="truncate">All Playlists</span>
            </button>

            {playlists.map((pl) => {
              const selected = activePlaylistId === pl.id;
              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    onSelectPlaylist(pl.id);
                    onCloseMobileDrawer?.();
                  }}
                  className={`rv-interactive-btn w-full min-h-[42px] px-3 py-1.5 rounded-xl flex items-center gap-3 text-left text-[13px] ${
                    selected
                      ? 'bg-[rgba(255,248,240,0.18)] text-[#fbf7f2]'
                      : 'text-[rgba(247,239,230,0.75)] hover:bg-[rgba(255,248,240,0.09)]'
                  }`}
                >
                  <img
                    src={pl.coverUrl}
                    alt=""
                    className="w-7 h-7 rounded-md object-cover shrink-0 bg-[#2a221c]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{pl.name}</div>
                    <div className="text-[11px] text-[rgba(247,239,230,0.5)] tabular-nums">
                      {pl.trackIds.length} tracks
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
