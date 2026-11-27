import { useMemo, useState } from 'react';
import { ArrowLeft, Heart, History, ListMusic, ListPlus, Play, Plus, Trash2 } from 'lucide-react';
import type { Playlist, Track } from '../types/music';
import { TrackRow } from './TrackRow';

type LibraryTab = 'liked' | 'playlists' | 'history';

interface LibraryViewProps {
  playlists: Playlist[];
  catalog: Track[];
  likedTracks: Track[];
  recentTracks: Track[];
  activePlaylistId: string | null;
  currentTrackId?: string | null;
  isPlaying: boolean;
  likedIds: string[];
  onSelectPlaylist: (id: string | null) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onAddToQueue: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void;
}

export function LibraryView({
  playlists,
  catalog,
  likedTracks,
  recentTracks,
  activePlaylistId,
  currentTrackId,
  isPlaying,
  likedIds,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onPlayTrack,
  onAddToQueue,
  onPlayNext,
  onToggleLike,
  onStartRadio,
  onAddToPlaylist,
  onRemoveFromPlaylist,
}: LibraryViewProps) {
  const [subTab, setSubTab] = useState<LibraryTab>('playlists');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const trackById = useMemo(() => new Map(catalog.map((t) => [t.id, t])), [catalog]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId],
  );

  const activePlaylistTracks = useMemo(() => {
    if (!activePlaylist) return [];
    return activePlaylist.trackIds
      .map((id) => trackById.get(id))
      .filter((t): t is Track => Boolean(t));
  }, [activePlaylist, trackById]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName('');
    setCreating(false);
  };

  if (activePlaylist) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onSelectPlaylist(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgba(244,245,247,0.68)] hover:text-[#f4f5f7]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Library
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-4 rounded-2xl bg-[#10131b] border border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={activePlaylist.coverUrl}
              alt=""
              className="w-20 h-20 rounded-xl object-cover shrink-0 bg-[#181d29]"
            />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#22d3a6]">
                Playlist
              </span>
              <h1 className="text-xl font-bold text-[#f4f5f7] truncate">{activePlaylist.name}</h1>
              <p className="text-xs text-[rgba(244,245,247,0.58)] mt-0.5 tabular-nums">
                {activePlaylistTracks.length} track{activePlaylistTracks.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activePlaylistTracks.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => onPlayTrack(activePlaylistTracks[0]!, activePlaylistTracks)}
                  className="rv-interactive-btn px-4 py-2 rounded-lg bg-[#22d3a6] text-[#042019] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  Play All
                </button>
                <button
                  type="button"
                  onClick={() => activePlaylistTracks.forEach((t) => onAddToQueue(t))}
                  className="rv-interactive-btn px-3.5 py-2 rounded-lg bg-[#161b26] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5"
                >
                  <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Queue All
                </button>
              </>
            ) : null}

            {!activePlaylist.isSystem ? (
              <button
                type="button"
                aria-label={`Delete playlist ${activePlaylist.name}`}
                onClick={() => {
                  onDeletePlaylist(activePlaylist.id);
                  onSelectPlaylist(null);
                }}
                className="rv-interactive-btn w-9 h-9 rounded-lg bg-[#161b26] hover:bg-[rgba(248,113,113,0.14)] text-[rgba(244,245,247,0.68)] hover:text-[#f87171] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {activePlaylistTracks.length === 0 ? (
          <div className="py-12 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f131b] text-center text-xs text-[rgba(244,245,247,0.58)]">
            No songs in this playlist yet. Use the ⋯ menu on any track to add songs here.
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {activePlaylistTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                isActive={currentTrackId === track.id}
                isPlaying={isPlaying}
                isLiked={likedIds.includes(track.id)}
                playlists={playlists}
                onPlay={(t) => onPlayTrack(t, activePlaylistTracks)}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onToggleLike={onToggleLike}
                onStartRadio={onStartRadio}
                onAddToPlaylist={onAddToPlaylist}
                onRemoveFromPlaylist={(tid) => onRemoveFromPlaylist(activePlaylist.id, tid)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#f4f5f7] tracking-tight">Library</h1>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Library sections">
          {(
            [
              { id: 'playlists', label: 'Playlists', Icon: ListMusic },
              { id: 'liked', label: `Liked (${likedTracks.length})`, Icon: Heart },
              { id: 'history', label: 'History', Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(id)}
                className={`rv-interactive-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border ${
                  active
                    ? 'bg-[#22d3a6] text-[#042019] border-[#22d3a6]'
                    : 'bg-[#121620] text-[rgba(244,245,247,0.75)] border-[rgba(255,255,255,0.08)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {subTab === 'playlists' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[rgba(244,245,247,0.58)] tabular-nums">
              {playlists.length} playlists
            </span>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="rv-interactive-btn px-3 py-1.5 rounded-lg bg-[#121620] hover:bg-[#19202e] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
              New Playlist
            </button>
          </div>

          {creating ? (
            <form
              onSubmit={handleCreate}
              className="p-3 rounded-xl bg-[#10131b] border border-[rgba(255,255,255,0.1)] flex gap-2"
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter playlist name..."
                aria-label="New playlist name"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#161b26] border border-[rgba(255,255,255,0.12)] text-xs text-[#f4f5f7] focus:outline-none focus:border-[#22d3a6]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#22d3a6] text-[#042019] text-xs font-bold"
              >
                Create
              </button>
            </form>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className="rv-interactive-btn group text-left p-2.5 rounded-xl bg-[#10131b] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(34,211,166,0.4)]"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-[#181d29]">
                  <img
                    src={pl.coverUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-2">
                  <div className="text-sm font-semibold text-[#f4f5f7] truncate">{pl.name}</div>
                  <div className="text-[11px] text-[rgba(244,245,247,0.55)] tabular-nums">
                    {pl.trackIds.length} track{pl.trackIds.length === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {subTab === 'liked' ? (
        <div className="space-y-3">
          {likedTracks.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPlayTrack(likedTracks[0]!, likedTracks)}
                className="rv-interactive-btn px-3.5 py-1.5 rounded-lg bg-[#22d3a6] text-[#042019] text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                Play Liked Songs
              </button>
            </div>
          ) : null}

          {likedTracks.length === 0 ? (
            <div className="py-12 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f131b] text-center text-xs text-[rgba(244,245,247,0.58)]">
              Songs you heart will appear here.
            </div>
          ) : (
            <ul role="list" className="space-y-1">
              {likedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  isActive={currentTrackId === track.id}
                  isPlaying={isPlaying}
                  isLiked
                  playlists={playlists}
                  onPlay={(t) => onPlayTrack(t, likedTracks)}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                  onToggleLike={onToggleLike}
                  onStartRadio={onStartRadio}
                  onAddToPlaylist={onAddToPlaylist}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {subTab === 'history' ? (
        recentTracks.length === 0 ? (
          <div className="py-12 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f131b] text-center text-xs text-[rgba(244,245,247,0.58)]">
            Your listening history will appear here.
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {recentTracks.map((track, idx) => (
              <TrackRow
                key={`hist-${track.id}-${idx}`}
                track={track}
                index={idx}
                isActive={currentTrackId === track.id}
                isPlaying={isPlaying}
                isLiked={likedIds.includes(track.id)}
                playlists={playlists}
                onPlay={(t) => onPlayTrack(t, recentTracks)}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onToggleLike={onToggleLike}
                onStartRadio={onStartRadio}
                onAddToPlaylist={onAddToPlaylist}
              />
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
