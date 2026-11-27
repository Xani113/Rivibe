import { useState } from 'react';
import { Heart, Play, Plus, Radio, ThumbsDown } from 'lucide-react';
import type { Playlist, ScoredTrack, Track } from '../types/music';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface TrackListProps {
  items: Array<Track | ScoredTrack>;
  currentTrackId?: string | null;
  isPlaying: boolean;
  likedIds: string[];
  playlists: Playlist[];
  onPlayTrack: (track: Track, list: Track[]) => void;
  onToggleLike: (track: Track) => void;
  onSkipTrack?: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
}

function isScored(item: Track | ScoredTrack): item is ScoredTrack {
  return 'track' in item && 'matchPercent' in item;
}

export function TrackList({
  items,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  onPlayTrack,
  onToggleLike,
  onSkipTrack,
  onStartRadio,
  onAddToPlaylist,
}: TrackListProps) {
  const [pickerTrackId, setPickerTrackId] = useState<string | null>(null);
  const rawTracks = items.map((i) => (isScored(i) ? i.track : i));

  if (items.length === 0) {
    return (
      <div
        role="status"
        className="py-10 px-4 rounded-2xl border border-[rgba(255,244,230,0.12)] text-center text-sm text-[rgba(247,239,230,0.66)]"
      >
        No tracks in this list yet.
      </div>
    );
  }

  return (
    <ul role="list" className="divide-y divide-[rgba(255,244,230,0.08)]">
      {items.map((item, idx) => {
        const scored = isScored(item) ? item : null;
        const track: Track = isScored(item) ? item.track : item;
        const active = currentTrackId === track.id;
        const liked = likedIds.includes(track.id);

        return (
          <li
            key={track.id}
            className={`relative flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors ${
              active ? 'bg-[rgba(255,248,240,0.14)]' : 'hover:bg-[rgba(255,248,240,0.07)]'
            }`}
          >
            <button
              type="button"
              aria-label={`Play ${track.title}`}
              onClick={() => onPlayTrack(track, rawTracks)}
              className="rv-interactive-btn flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <span className="w-6 text-center text-xs text-[rgba(247,239,230,0.52)] tabular-nums shrink-0">
                {active && isPlaying ? (
                  <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                    <span className="w-0.5 h-full bg-[#f0c46c] rounded-full rv-eq-bar" />
                    <span className="w-0.5 h-full bg-[#f0c46c] rounded-full rv-eq-bar" />
                    <span className="w-0.5 h-full bg-[#f0c46c] rounded-full rv-eq-bar" />
                  </span>
                ) : (
                  idx + 1
                )}
              </span>

              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#241d17]">
                <img
                  src={track.artworkUrl || FALLBACK_ART}
                  alt=""
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_ART) {
                      e.currentTarget.src = FALLBACK_ART;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play className="w-4 h-4 text-white fill-current" aria-hidden="true" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium truncate ${
                      active ? 'text-[#f0c46c]' : 'text-[#fbf7f2]'
                    }`}
                  >
                    {track.title}
                  </span>
                  {scored ? (
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(240,196,108,0.18)] text-[#f0c46c] tabular-nums shrink-0">
                      {scored.matchPercent}% Match
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[rgba(247,239,230,0.62)] truncate">
                  {track.artist} · {track.album}
                  {scored?.reasons[0] ? ` · ${scored.reasons[0]}` : ''}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
                onClick={() => onToggleLike(track)}
                className="rv-interactive-btn w-10 h-10 rounded-full hover:bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[rgba(247,239,230,0.75)]"
              >
                <Heart
                  className={`w-4 h-4 ${liked ? 'fill-[#e87a64] text-[#e87a64]' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {onSkipTrack ? (
                <button
                  type="button"
                  aria-label={`Not interested in ${track.title}`}
                  title="Less like this"
                  onClick={() => onSkipTrack(track)}
                  className="rv-interactive-btn hidden sm:flex w-10 h-10 rounded-full hover:bg-[rgba(255,248,240,0.12)] items-center justify-center text-[rgba(247,239,230,0.6)] hover:text-[#fbf7f2]"
                >
                  <ThumbsDown className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : null}

              <button
                type="button"
                aria-label={`Start radio from ${track.title}`}
                title="Start Track Radio"
                onClick={() => onStartRadio(track)}
                className="rv-interactive-btn w-10 h-10 rounded-full hover:bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[#f0c46c]"
              >
                <Radio className="w-4 h-4" aria-hidden="true" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  aria-label={`Add ${track.title} to playlist`}
                  onClick={() =>
                    setPickerTrackId((prev) => (prev === track.id ? null : track.id))
                  }
                  className="rv-interactive-btn w-10 h-10 rounded-full hover:bg-[rgba(255,248,240,0.12)] flex items-center justify-center text-[rgba(247,239,230,0.75)]"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>

                {pickerTrackId === track.id ? (
                  <div className="absolute right-0 top-11 z-30 w-48 p-1.5 rounded-xl rv-pill-glass border border-[rgba(255,244,230,0.22)] shadow-xl">
                    <div className="px-2 py-1 text-[11px] font-semibold text-[rgba(247,239,230,0.6)]">
                      Add to Playlist
                    </div>
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          onAddToPlaylist(pl.id, track);
                          setPickerTrackId(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#fbf7f2] hover:bg-[rgba(255,248,240,0.16)] truncate"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <span className="hidden md:inline-block w-11 text-right text-xs text-[rgba(247,239,230,0.52)] tabular-nums">
                {formatDuration(track.durationSec)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
