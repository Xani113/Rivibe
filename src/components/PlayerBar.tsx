import { useRef } from 'react';
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
import { useTrackTint } from '../utils/dominantColor';
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

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressOpenClickRef = useRef(false);
  const activeTint = useTrackTint(currentTrack);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const liked = currentTrack ? tasteProfile.likedTrackIds.includes(currentTrack.id) : false;
  const keyboardOpen = useKeyboardOpen();

  const handleTrackSwipeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    suppressOpenClickRef.current = false;
  };

  const handleTrackSwipeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = Math.abs(e.clientY - start.y);
    if (Math.abs(dx) > 48 && Math.abs(dx) > dy * 1.3) {
      suppressOpenClickRef.current = true;
      if (dx < 0) {
        void nextTrack(true);
      } else {
        void prevTrack();
      }
    }
  };

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
              queueToast ? 'bg-[#a78bfa]' : 'bg-[#f87171]'
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

      <div
        style={{
          borderColor: activeTint.cardBorder,
        }}
        className="rv-glass-bar border-t relative max-md:mx-2 max-md:mb-1.5 max-md:rounded-2xl max-md:border max-md:overflow-hidden max-md:shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      >
        {/* Subtle Album-Tinted Ambient Wash */}
        <div
          aria-hidden="true"
          style={{ backgroundColor: activeTint.cardBg }}
          className="pointer-events-none absolute inset-0 opacity-45"
        />

        {/* Top Edge Seek Scrubber */}
        <div className="relative z-10 h-1 w-full bg-[rgba(255,255,255,0.1)] group hover:h-1.5 transition-all">
          <div
            className="h-full transition-[width] duration-150"
            style={{ width: `${progress}%`, backgroundColor: activeTint.accentHex || '#a78bfa' }}
          />
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

        <div className="relative z-10 px-2.5 sm:px-5 h-[64px] md:h-[78px] flex items-center justify-between gap-2 sm:gap-3">
          {/* Track Info (Swipe Horizontal on Mobile to Skip Prev/Next) */}
          <div
            onPointerDown={handleTrackSwipeDown}
            onPointerUp={handleTrackSwipeUp}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 md:flex-initial md:w-[30%] touch-pan-y"
          >
            <button
              type="button"
              aria-label="Open now playing artwork view"
              onClick={() => {
                if (suppressOpenClickRef.current) {
                  suppressOpenClickRef.current = false;
                  return;
                }
                onOpenSheet('queue');
              }}
              className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg overflow-hidden bg-[#161b26] shrink-0 focus-visible:outline-2 focus-visible:outline-[#a78bfa]"
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
                onClick={() => {
                  if (suppressOpenClickRef.current) {
                    suppressOpenClickRef.current = false;
                    return;
                  }
                  onOpenSheet('queue');
                }}
                data-testid="floating-player-title"
                className="block w-full text-left text-[13px] sm:text-[13.5px] font-semibold text-[#f4f5f7] truncate hover:text-[#a78bfa] transition-colors"
              >
                {currentTrack?.title ?? 'Nothing queued'}
              </button>
              <div className="flex items-center gap-1.5 text-[11.5px] sm:text-xs text-[rgba(244,245,247,0.68)] truncate">
                <span className="truncate">{currentTrack?.artist ?? 'Pick a song to play'}</span>
                <span className="hidden sm:inline text-[11px] text-[rgba(244,245,247,0.45)] tabular-nums shrink-0">
                  · {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
            </div>

            {currentTrack ? (
              <button
                type="button"
                aria-label={liked ? 'Unlike current track' : 'Like current track'}
                onClick={() => toggleLike(currentTrack)}
                className="rv-interactive-btn flex w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.08)] items-center justify-center shrink-0 text-[rgba(244,245,247,0.75)]"
              >
                <Heart
                  className={`w-4 h-4 ${liked ? 'fill-[#a78bfa] text-[#a78bfa]' : ''}`}
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
                  ? 'text-[#a78bfa] bg-[rgba(124,92,255,0.16)]'
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
              className="rv-interactive-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#7c5cff] hover:bg-[#8d70ff] text-white flex items-center justify-center shadow-lg"
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
                  ? 'text-[#a78bfa] bg-[rgba(124,92,255,0.16)]'
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
                  <VolumeX className="w-4 h-4 text-[#f87171]" aria-hidden="true" />
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
                className="w-20 accent-[#7c5cff]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
