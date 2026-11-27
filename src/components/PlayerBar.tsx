import {
  Heart,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface PlayerBarProps {
  queueOpen?: boolean;
  onOpenSheet: (initialTab?: 'queue' | 'lyrics') => void;
  onToggleQueue?: () => void;
}

export function PlayerBar({ onOpenSheet }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    playbackNotice,
    queueToast,
    toggleShuffle,
    cycleRepeatMode,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
    clearNotice,
    clearQueueToast,
  } = usePlayer();
  const { tasteProfile, toggleLike } = useLibrary();

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const liked = currentTrack ? tasteProfile.likedTrackIds.includes(currentTrack.id) : false;
  const keyboardOpen = useKeyboardOpen();

  return (
    <div
      className={`rv-player-dock fixed bottom-14 md:bottom-0 left-0 md:left-[228px] right-0 z-40 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        keyboardOpen
          ? 'max-md:translate-y-[125%] max-md:opacity-0 max-md:pointer-events-none'
          : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Transient Queue Feedback / Stream Error Toast */}
      {queueToast || playbackNotice ? (
        <div
          role="status"
          className="mb-2 mx-auto w-fit max-w-[92vw] px-3.5 py-1.5 rounded-xl rv-glass-overlay border text-xs text-[#f4f5f7] flex items-center gap-2.5 shadow-xl"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              queueToast ? 'bg-[#22d3a6]' : 'bg-[#f87171]'
            }`}
          />
          <span className="truncate">{queueToast ?? playbackNotice}</span>
          <button
            type="button"
            onClick={queueToast ? clearQueueToast : clearNotice}
            className="text-[11px] font-semibold text-[rgba(244,245,247,0.6)] hover:text-[#f4f5f7] shrink-0"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="rv-glass-bar border-t relative">
        {/* Top Edge Seek Scrubber */}
        <div className="relative h-1 w-full bg-[rgba(255,255,255,0.08)] group hover:h-1.5 transition-all">
          <div className="h-full bg-[#22d3a6]" style={{ width: `${progress}%` }} />
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            value={currentTime}
            aria-label="Seek playback position"
            onChange={(e) => seekTo(Number(e.target.value))}
            className="absolute inset-0 -top-2 h-5 w-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="px-2.5 sm:px-5 h-[66px] md:h-[78px] flex items-center justify-between gap-2 sm:gap-3">
          {/* Track Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 md:flex-initial md:w-[30%]">
            <button
              type="button"
              aria-label="Open now playing artwork view"
              onClick={() => onOpenSheet('queue')}
              className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg overflow-hidden bg-[#161b26] shrink-0 focus-visible:outline-2 focus-visible:outline-[#22d3a6]"
            >
              <img
                src={currentTrack?.artworkUrl || FALLBACK_ART}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                aria-label="Open now playing details"
                onClick={() => onOpenSheet('queue')}
                data-testid="floating-player-title"
                className="block w-full text-left text-[13px] sm:text-[13.5px] font-semibold text-[#f4f5f7] truncate hover:text-[#22d3a6] transition-colors"
              >
                {currentTrack?.title ?? 'Nothing queued'}
              </button>
              <div className="flex items-center gap-1.5 text-[11.5px] sm:text-xs text-[rgba(244,245,247,0.62)] truncate">
                <span className="truncate">{currentTrack?.artist ?? 'Pick a song to play'}</span>
                <span className="hidden sm:inline text-[11px] text-[rgba(244,245,247,0.42)] tabular-nums shrink-0">
                  · {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
            </div>

            {currentTrack ? (
              <button
                type="button"
                aria-label={liked ? 'Unlike current track' : 'Like current track'}
                onClick={() => toggleLike(currentTrack)}
                className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.08)] items-center justify-center shrink-0 text-[rgba(244,245,247,0.72)]"
              >
                <Heart
                  className={`w-4 h-4 ${liked ? 'fill-[#22d3a6] text-[#22d3a6]' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>

          {/* Center Transport Controls */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <button
              type="button"
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              onClick={toggleShuffle}
              className={`hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors ${
                shuffle
                  ? 'text-[#22d3a6] bg-[rgba(34,211,166,0.12)]'
                  : 'text-[rgba(244,245,247,0.58)] hover:text-[#f4f5f7]'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Previous track"
              onClick={() => void prevTrack()}
              className="rv-interactive-btn w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f4f5f7]"
            >
              <SkipBack className="w-4 h-4 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => void togglePlay()}
              className="rv-interactive-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#22d3a6] hover:bg-[#34e5b8] text-[#042019] flex items-center justify-center shadow-lg"
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
              className="rv-interactive-btn w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f4f5f7]"
            >
              <SkipForward className="w-4 h-4 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={`Repeat mode: ${repeatMode}`}
              onClick={cycleRepeatMode}
              className={`hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[#22d3a6] bg-[rgba(34,211,166,0.12)]'
                  : 'text-[rgba(244,245,247,0.58)] hover:text-[#f4f5f7]'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Right Utilities: Lyrics · Volume */}
          <div className="flex items-center justify-end gap-1.5 md:w-[30%] shrink-0">
            <button
              type="button"
              aria-label="Open synced lyrics"
              title="Lyrics"
              onClick={() => onOpenSheet('lyrics')}
              className="hidden sm:flex w-9 h-9 rounded-lg hover:bg-[rgba(255,255,255,0.08)] items-center justify-center text-[rgba(244,245,247,0.72)] hover:text-[#f4f5f7]"
            >
              <Mic2 className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="hidden lg:flex items-center gap-1.5 pl-1">
              <button
                type="button"
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                onClick={toggleMute}
                className="w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.72)]"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label="Volume level"
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 accent-[#22d3a6]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
