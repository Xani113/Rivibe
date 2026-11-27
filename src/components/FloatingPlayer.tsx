import { useState } from 'react';
import {
  Heart,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatDuration } from '../utils/formatTime';

interface FloatingPlayerProps {
  onOpenSheet: () => void;
}

export function FloatingPlayer({ onOpenSheet }: FloatingPlayerProps) {
  const {
    currentTrack,
    currentRadioStation,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackNotice,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
    clearNotice,
  } = usePlayer();
  const { tasteProfile, toggleLike } = useLibrary();
  const [showVolume, setShowVolume] = useState(false);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const liked = currentTrack ? tasteProfile.likedTrackIds.includes(currentTrack.id) : false;
  const displayTitle = currentRadioStation?.name ?? currentTrack?.title ?? 'Select a Track';
  const displaySubtitle = currentRadioStation
    ? `Live Radio · ${currentRadioStation.country}`
    : currentTrack?.artist ?? 'RiVibe Discovery';

  return (
    <div className="rv-floating-player fixed bottom-[76px] md:bottom-4 left-2.5 right-2.5 mx-auto z-40 max-w-[calc(100vw-20px)] md:w-[min(720px,calc(100%-3rem))]">
      {playbackNotice ? (
        <div
          role="status"
          className="mb-2 mx-auto w-fit max-w-full px-3.5 py-1.5 rounded-full bg-[rgba(28,22,18,0.92)] border border-[rgba(240,196,108,0.35)] text-xs text-[#fbf7f2] flex items-center gap-2 shadow-lg"
        >
          <span className="truncate">{playbackNotice}</span>
          <button
            type="button"
            onClick={clearNotice}
            className="text-[#f0c46c] font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="rv-pill-glass rounded-full px-2 sm:px-3.5 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3">
        {/* Transport Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            aria-label="Previous track"
            onClick={() => void prevTrack()}
            className="rv-interactive-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-[rgba(255,248,240,0.14)] flex items-center justify-center text-[#fbf7f2]"
          >
            <SkipBack className="w-4 h-4 fill-current" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() => void togglePlay()}
            className="rv-interactive-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[rgba(255,248,240,0.18)] hover:bg-[rgba(255,248,240,0.28)] border border-[rgba(255,244,230,0.26)] flex items-center justify-center text-[#fbf7f2]"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            aria-label="Next track"
            onClick={() => void nextTrack(true)}
            className="rv-interactive-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-[rgba(255,248,240,0.14)] flex items-center justify-center text-[#fbf7f2]"
          >
            <SkipForward className="w-4 h-4 fill-current" aria-hidden="true" />
          </button>
        </div>

        {/* Center Inset Now Playing Pill (matches reference image) */}
        <div className="flex-1 min-w-0 rounded-full bg-[rgba(20,16,12,0.38)] border border-[rgba(255,244,230,0.12)] px-2.5 py-1.5 flex items-center gap-2.5">
          {currentTrack?.artworkUrl ? (
            <button
              type="button"
              aria-label="Open now playing artwork view"
              onClick={onOpenSheet}
              className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-[#f0c46c]"
            >
              <img
                src={currentTrack.artworkUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover bg-[#2a221c]"
              />
            </button>
          ) : (
            <span className="w-8 h-8 rounded-full bg-[#362c24] shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Open now playing details"
                onClick={onOpenSheet}
                data-testid="floating-player-title"
                className="text-xs sm:text-[13px] font-medium text-[#fbf7f2] truncate text-left hover:text-[#f0c46c] transition-colors"
              >
                {displayTitle}
              </button>
              {!currentRadioStation ? (
                <span className="hidden sm:inline text-[10px] text-[rgba(247,239,230,0.58)] tabular-nums shrink-0">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-[#f0c46c] shrink-0">LIVE</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <div className="relative flex-1 h-1.5 rounded-full bg-[rgba(255,248,240,0.16)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#f0c46c]"
                  style={{ width: `${currentRadioStation ? 100 : progress}%` }}
                />
                {!currentRadioStation ? (
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, duration)}
                    value={currentTime}
                    aria-label="Seek playback position"
                    onChange={(e) => seekTo(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                ) : null}
              </div>
              <span className="hidden md:inline text-[10px] text-[rgba(247,239,230,0.56)] truncate max-w-[110px]">
                {displaySubtitle}
              </span>
            </div>
          </div>

          {currentTrack && !currentRadioStation ? (
            <button
              type="button"
              aria-label={liked ? 'Unlike current track' : 'Like current track'}
              onClick={() => toggleLike(currentTrack)}
              className="rv-interactive-btn hidden sm:flex w-8 h-8 rounded-full hover:bg-[rgba(255,248,240,0.14)] items-center justify-center shrink-0"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  liked ? 'fill-[#e87a64] text-[#e87a64]' : 'text-[rgba(247,239,230,0.75)]'
                }`}
                aria-hidden="true"
              />
            </button>
          ) : null}

          <button
            type="button"
            aria-label="More playback options and lyrics"
            onClick={onOpenSheet}
            className="rv-interactive-btn w-8 h-8 rounded-full hover:bg-[rgba(255,248,240,0.14)] flex items-center justify-center text-[rgba(247,239,230,0.8)] shrink-0"
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Right Queue & Volume */}
        <div className="relative flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            aria-label="Open queue and lyrics"
            onClick={onOpenSheet}
            className="rv-interactive-btn w-10 h-10 rounded-full hover:bg-[rgba(255,248,240,0.14)] flex items-center justify-center text-[#fbf7f2]"
          >
            <ListMusic className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={isMuted ? 'Unmute audio' : 'Volume controls'}
            onClick={() => setShowVolume((v) => !v)}
            className="rv-interactive-btn hidden sm:flex w-10 h-10 rounded-full hover:bg-[rgba(255,248,240,0.14)] items-center justify-center text-[#fbf7f2]"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {showVolume ? (
            <div className="absolute right-0 bottom-12 p-3 rounded-2xl rv-pill-glass border border-[rgba(255,244,230,0.24)] flex items-center gap-2.5 shadow-xl">
              <button
                type="button"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                onClick={toggleMute}
                className="text-xs text-[#f0c46c] font-semibold"
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label="Volume level"
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-[#f0c46c]"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
