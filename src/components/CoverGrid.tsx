import { useState } from 'react';
import { Heart, Play, Radio } from 'lucide-react';
import type { Track } from '../types/music';
import { SEED_TRACKS } from '../services/seedCatalog';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface CoverGridProps {
  tracks: Track[];
  currentTrackId?: string | null;
  isPlaying: boolean;
  likedIds: string[];
  onPlayTrack: (track: Track, list: Track[]) => void;
  onToggleLike: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function CoverGrid({
  tracks,
  currentTrackId,
  isPlaying,
  likedIds,
  onPlayTrack,
  onToggleLike,
  onStartRadio,
  isLoading = false,
  emptyMessage = 'No tracks found for this view yet.',
}: CoverGridProps) {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  if (isLoading && tracks.length === 0) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5"
        aria-busy="true"
        aria-label="Loading albums and tracks"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-1.5 rounded-2xl bg-[rgba(255,248,240,0.05)] animate-pulse">
            <div className="aspect-square rounded-[11px] bg-[rgba(255,248,240,0.10)]" />
            <div className="h-3.5 w-3/4 rounded bg-[rgba(255,248,240,0.12)] mt-2.5" />
            <div className="h-3 w-1/2 rounded bg-[rgba(255,248,240,0.08)] mt-1.5" />
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div
        role="status"
        className="py-14 px-6 rounded-2xl border border-[rgba(255,244,230,0.12)] bg-[rgba(20,16,12,0.22)] text-center"
      >
        <p className="text-sm font-medium text-[#fbf7f2]">{emptyMessage}</p>
        <p className="text-xs text-[rgba(247,239,230,0.62)] mt-1">
          Try another search query, mood chip, or tap Surprise Vibe.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
      {tracks.map((track) => {
        const active = currentTrackId === track.id;
        const liked = likedIds.includes(track.id);

        return (
          <article
            key={track.id}
            data-active={active}
            className="rv-cover-card group relative flex flex-col min-w-0"
          >
            <div className="relative aspect-square w-full overflow-hidden rv-cover-card-art bg-[#241d17]">
              <img
                src={brokenImages[track.id] || !track.artworkUrl ? FALLBACK_ART : track.artworkUrl}
                alt={`${track.album} cover`}
                loading="lazy"
                onError={() => setBrokenImages((prev) => ({ ...prev, [track.id]: true }))}
                className="w-full h-full object-cover rv-cover-card-art transition-transform duration-300 group-hover:scale-[1.03]"
              />

              {/* Stream type subtle badge */}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[rgba(18,14,11,0.72)] text-[#fbf7f2] backdrop-blur-md border border-[rgba(255,244,230,0.16)]">
                {track.streamType === 'full'
                  ? 'FULL'
                  : track.streamType === 'youtube'
                    ? 'YT FULL'
                    : track.streamType === 'preview'
                      ? '30s'
                      : 'MIX'}
              </span>

              {/* Quick action pill overlay */}
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-end sm:justify-between gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-150">
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
                    onClick={() => onToggleLike(track)}
                    className="rv-interactive-btn w-9 h-9 rounded-full bg-[rgba(18,14,11,0.78)] backdrop-blur-md border border-[rgba(255,244,230,0.2)] flex items-center justify-center text-[#fbf7f2]"
                  >
                    <Heart
                      className={`w-4 h-4 ${liked ? 'fill-[#e87a64] text-[#e87a64]' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Start radio from ${track.title}`}
                    title="Start Track Radio"
                    onClick={() => onStartRadio(track)}
                    className="rv-interactive-btn w-9 h-9 rounded-full bg-[rgba(18,14,11,0.78)] backdrop-blur-md border border-[rgba(255,244,230,0.2)] flex items-center justify-center text-[#f0c46c]"
                  >
                    <Radio className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  aria-label={`Play ${track.title}`}
                  onClick={() => onPlayTrack(track, tracks)}
                  className="rv-interactive-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#f0c46c] text-[#1a140f] shadow-lg flex items-center justify-center"
                >
                  {active && isPlaying ? (
                    <span className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                      <span className="w-0.5 h-full bg-[#1a140f] rounded-full rv-eq-bar" />
                      <span className="w-0.5 h-full bg-[#1a140f] rounded-full rv-eq-bar" />
                      <span className="w-0.5 h-full bg-[#1a140f] rounded-full rv-eq-bar" />
                    </span>
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks)}
              className="mt-2 px-1 w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#f0c46c] rounded-lg"
            >
              <div className="text-[13.5px] font-semibold text-[#fbf7f2] truncate">
                {track.title}
              </div>
              <div className="text-[12px] text-[rgba(247,239,230,0.66)] truncate">
                {track.artist}
              </div>
            </button>
          </article>
        );
      })}
    </div>
  );
}
