import { Heart, ListPlus, Play } from 'lucide-react';
import type { Playlist, Track } from '../types/music';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';
import { TrackActionMenu } from './TrackActionMenu';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface TrackRowProps {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  isLiked: boolean;
  playlists: Playlist[];
  compact?: boolean;
  onPlay: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export function TrackRow({
  track,
  index,
  isActive,
  isPlaying,
  isLiked,
  playlists,
  compact = false,
  onPlay,
  onAddToQueue,
  onPlayNext,
  onToggleLike,
  onStartRadio,
  onAddToPlaylist,
  onRemoveFromPlaylist,
}: TrackRowProps) {
  return (
    <li
      data-active={isActive}
      className={`group flex items-center gap-2.5 sm:gap-3 px-2.5 py-2 rounded-xl border transition-colors ${
        isActive
          ? 'bg-[rgba(124,92,255,0.12)] border-[rgba(167,139,250,0.34)]'
          : 'border-transparent hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.07)]'
      }`}
    >
      <button
        type="button"
        aria-label={`Play ${track.title} by ${track.artist}`}
        onClick={() => onPlay(track)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#a78bfa] rounded-lg"
      >
        {!compact ? (
          <span className="hidden sm:inline-flex w-6 justify-center text-xs text-[rgba(244,245,247,0.45)] tabular-nums shrink-0">
            {isActive && isPlaying ? (
              <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                <span className="w-0.5 h-full bg-[#a78bfa] rounded-full rv-eq-bar" />
                <span className="w-0.5 h-full bg-[#a78bfa] rounded-full rv-eq-bar" />
                <span className="w-0.5 h-full bg-[#a78bfa] rounded-full rv-eq-bar" />
              </span>
            ) : (
              index + 1
            )}
          </span>
        ) : null}

        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#161b26]">
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
          <span
            className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
              isActive && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isActive && isPlaying && compact ? (
              <span className="inline-flex items-end gap-0.5 h-3.5" aria-hidden="true">
                <span className="w-0.5 h-full bg-[#a78bfa] rounded-full rv-eq-bar" />
                <span className="w-0.5 h-full bg-[#a78bfa] rounded-full rv-eq-bar" />
                <span className="w-0.5 h-full bg-[#a78bfa] rounded-full rv-eq-bar" />
              </span>
            ) : (
              <Play className="w-4 h-4 text-white fill-current" aria-hidden="true" />
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-[13.5px] font-semibold truncate ${
                isActive ? 'text-[#a78bfa]' : 'text-[#f4f5f7]'
              }`}
            >
              {track.title}
            </span>
          </div>
          <div className="text-xs text-[rgba(244,245,247,0.58)] truncate mt-0.5">
            {track.artist}
            {!compact && track.album ? ` · ${track.album}` : ''}
          </div>
        </div>
      </button>

      {/* Row Actions: Add to Queue · Like · Overflow Menu */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          type="button"
          aria-label={`Add ${track.title} to queue`}
          title="Add to queue"
          onClick={() => onAddToQueue(track)}
          className="rv-interactive-btn w-8 h-8 rounded-lg hover:bg-[rgba(124,92,255,0.16)] flex items-center justify-center text-[rgba(244,245,247,0.68)] hover:text-[#a78bfa]"
        >
          <ListPlus className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
          onClick={() => onToggleLike(track)}
          className="rv-interactive-btn w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.68)]"
        >
          <Heart
            className={`w-4 h-4 ${isLiked ? 'fill-[#a78bfa] text-[#a78bfa]' : ''}`}
            aria-hidden="true"
          />
        </button>

        <TrackActionMenu
          track={track}
          playlists={playlists}
          onPlay={onPlay}
          onPlayNext={onPlayNext}
          onAddToQueue={onAddToQueue}
          onStartRadio={onStartRadio}
          onAddToPlaylist={onAddToPlaylist}
          onRemoveFromPlaylist={onRemoveFromPlaylist}
        />

        {!compact ? (
          <span className="hidden md:inline-block w-11 text-right text-xs text-[rgba(244,245,247,0.45)] tabular-nums">
            {formatDuration(track.durationSec)}
          </span>
        ) : null}
      </div>
    </li>
  );
}
