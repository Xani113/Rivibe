import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Heart,
  Infinity as InfinityIcon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface NowPlayingSheetProps {
  isOpen: boolean;
  initialTab?: 'queue' | 'lyrics';
  onClose: () => void;
}

export function NowPlayingSheet({
  isOpen,
  initialTab = 'queue',
  onClose,
}: NowPlayingSheetProps) {
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    repeatMode,
    infiniteRadio,
    lyrics,
    isLoadingLyrics,
    setInfiniteRadio,
    toggleShuffle,
    cycleRepeatMode,
    playQueueIndex,
    removeFromQueue,
    moveQueueItem,
    clearUpcomingQueue,
    startTrackRadio,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
  } = usePlayer();
  const { tasteProfile, playlists, toggleLike, addTrackToPlaylist } = useLibrary();

  const [tab, setTab] = useState<'queue' | 'lyrics'>(initialTab);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const activeLyricRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (isOpen) {
      closeBtnRef.current?.focus();
    } else {
      setShowPlaylistMenu(false);
    }
  }, [isOpen]);

  const activeLyricIndex = useMemo(() => {
    const synced = lyrics?.syncedLines;
    if (!synced || synced.length === 0) return -1;
    let matchIdx = -1;
    for (let i = 0; i < synced.length; i++) {
      if (currentTime + 0.2 >= synced[i]!.timeSec) {
        matchIdx = i;
      } else {
        break;
      }
    }
    return matchIdx;
  }, [lyrics, currentTime]);

  useEffect(() => {
    if (isOpen && tab === 'lyrics' && activeLyricIndex >= 0) {
      activeLyricRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIndex, isOpen, tab]);

  if (!isOpen || !currentTrack) return null;

  const liked = tasteProfile.likedTrackIds.includes(currentTrack.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing studio"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-[#090b10] flex flex-col overflow-hidden"
    >
      {/* Dynamic Subtle Cover Ambient Backdrop */}
      {currentTrack.artworkUrl ? (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden opacity-25">
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className="w-full h-full object-cover scale-125 blur-[90px] saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090b10]/55 via-[#090b10]/75 to-[#090b10]" />
        </div>
      ) : null}

      {/* Top Bar */}
      <div className="relative z-10 px-4 sm:px-8 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.08)]">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#22d3a6]">
            Now Playing
          </span>
          <h2 className="text-sm font-semibold text-[#f4f5f7] truncate">{currentTrack.album}</h2>
        </div>

        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close now playing"
          onClick={onClose}
          className="rv-interactive-btn w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] flex items-center justify-center text-[#f4f5f7]"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Main Split Stage */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto rv-scroll p-4 sm:p-8 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Artwork & Player Controls */}
        <div className="flex flex-col items-center space-y-5 max-w-md mx-auto w-full">
          <div className="w-60 h-60 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-[#161b26] shadow-2xl border border-[rgba(255,255,255,0.12)]">
            <img
              src={currentTrack.artworkUrl || FALLBACK_ART}
              alt={`${currentTrack.album} artwork`}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="w-full flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-[#f4f5f7] truncate">{currentTrack.title}</h3>
              <p className="text-sm text-[rgba(244,245,247,0.68)] truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label={liked ? 'Unlike track' : 'Like track'}
                onClick={() => toggleLike(currentTrack)}
                className="rv-interactive-btn w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.14)] flex items-center justify-center"
              >
                <Heart
                  className={`w-5 h-5 ${liked ? 'fill-[#22d3a6] text-[#22d3a6]' : 'text-[#f4f5f7]'}`}
                  aria-hidden="true"
                />
              </button>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Add current track to playlist"
                  onClick={() => setShowPlaylistMenu((v) => !v)}
                  className="rv-interactive-btn w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.14)] flex items-center justify-center text-[#f4f5f7]"
                >
                  <FolderPlus className="w-4 h-4" aria-hidden="true" />
                </button>
                {showPlaylistMenu ? (
                  <div className="absolute right-0 bottom-11 z-30 w-48 p-1.5 rounded-xl rv-glass-overlay border shadow-2xl space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[rgba(244,245,247,0.5)]">
                      Add to Playlist
                    </div>
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          addTrackToPlaylist(pl.id, currentTrack);
                          setShowPlaylistMenu(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs text-[#f4f5f7] hover:bg-[rgba(34,211,166,0.16)] hover:text-[#22d3a6] text-left truncate"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Scrubber */}
          <div className="w-full space-y-1.5">
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              value={currentTime}
              aria-label="Seek track"
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full accent-[#22d3a6]"
            />
            <div className="flex justify-between text-xs text-[rgba(244,245,247,0.55)] tabular-nums">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Transport Bar */}
          <div className="w-full flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              onClick={toggleShuffle}
              className={`rv-interactive-btn w-10 h-10 rounded-xl flex items-center justify-center ${
                shuffle
                  ? 'bg-[rgba(34,211,166,0.16)] text-[#22d3a6]'
                  : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.72)]'
              }`}
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Previous"
              onClick={() => void prevTrack()}
              className="rv-interactive-btn w-11 h-11 rounded-xl bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f4f5f7]"
            >
              <SkipBack className="w-5 h-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => void togglePlay()}
              className="rv-interactive-btn w-14 h-14 rounded-full bg-[#22d3a6] text-[#042019] flex items-center justify-center shadow-xl"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              aria-label="Next"
              onClick={() => void nextTrack(true)}
              className="rv-interactive-btn w-11 h-11 rounded-xl bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#f4f5f7]"
            >
              <SkipForward className="w-5 h-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={`Repeat mode: ${repeatMode}`}
              onClick={cycleRepeatMode}
              className={`rv-interactive-btn w-10 h-10 rounded-xl flex items-center justify-center ${
                repeatMode !== 'off'
                  ? 'bg-[rgba(34,211,166,0.16)] text-[#22d3a6]'
                  : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.72)]'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Repeat className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void startTrackRadio(currentTrack)}
            className="rv-interactive-btn px-4 py-2 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
            Build Radio Queue From Track
          </button>
        </div>

        {/* Right: Up Next Queue & Synced Lyrics */}
        <div className="flex flex-col h-[420px] sm:h-[480px] rounded-2xl bg-[rgba(15,19,28,0.85)] border border-[rgba(255,255,255,0.1)] overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
            <div className="flex gap-1" role="tablist">
              {(
                [
                  { id: 'queue', label: `Up Next (${queue.length})` },
                  { id: 'lyrics', label: 'Lyrics' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-[#22d3a6] text-[#042019]'
                      : 'text-[rgba(244,245,247,0.65)] hover:text-[#f4f5f7]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {tab === 'queue' && queue.length > 1 ? (
                <button
                  type="button"
                  onClick={clearUpcomingQueue}
                  className="px-2 py-1 rounded-lg bg-[rgba(255,255,255,0.06)] hover:text-[#f87171] text-[11px] font-medium text-[rgba(244,245,247,0.68)] inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  Clear
                </button>
              ) : null}

              <button
                type="button"
                aria-pressed={infiniteRadio}
                onClick={() => setInfiniteRadio(!infiniteRadio)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 ${
                  infiniteRadio
                    ? 'bg-[rgba(34,211,166,0.16)] text-[#22d3a6]'
                    : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.58)]'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Autoplay
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rv-scroll p-3">
            {tab === 'queue' ? (
              <ul role="list" className="space-y-1">
                {queue.map((item, idx) => {
                  const isCurrent = idx === queueIndex;
                  return (
                    <li
                      key={`${item.id}-${idx}`}
                      className={`flex items-center gap-2 p-2 rounded-xl border ${
                        isCurrent
                          ? 'bg-[rgba(34,211,166,0.12)] border-[rgba(34,211,166,0.3)]'
                          : 'border-transparent hover:bg-[rgba(255,255,255,0.05)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void playQueueIndex(idx)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <img
                          src={item.artworkUrl || FALLBACK_ART}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0 bg-[#181d29]"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xs font-semibold truncate ${
                              isCurrent ? 'text-[#22d3a6]' : 'text-[#f4f5f7]'
                            }`}
                          >
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[rgba(244,245,247,0.55)] truncate">
                            {item.artist} · {formatDuration(item.durationSec)}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Move ${item.title} up in queue`}
                          disabled={idx === 0}
                          onClick={() => moveQueueItem(idx, idx - 1)}
                          className="w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.55)] disabled:opacity-25"
                        >
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${item.title} down in queue`}
                          disabled={idx === queue.length - 1}
                          onClick={() => moveQueueItem(idx, idx + 1)}
                          className="w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.55)] disabled:opacity-25"
                        >
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${item.title} from queue`}
                          title="Remove from queue"
                          onClick={() => removeFromQueue(idx)}
                          className="w-7 h-7 rounded-md hover:bg-[rgba(248,113,113,0.16)] flex items-center justify-center text-[rgba(244,245,247,0.55)] hover:text-[#f87171]"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : isLoadingLyrics ? (
              <div className="py-12 text-center text-xs text-[rgba(244,245,247,0.58)]">
                Loading lyrics...
              </div>
            ) : lyrics?.syncedLines && lyrics.syncedLines.length > 0 ? (
              <div className="space-y-1.5 py-2">
                {lyrics.syncedLines.map((line, i) => {
                  const active = i === activeLyricIndex;
                  return (
                    <button
                      key={`${line.timeSec}-${i}`}
                      ref={active ? activeLyricRef : undefined}
                      type="button"
                      onClick={() => seekTo(line.timeSec)}
                      className={`block w-full text-left px-3 py-1.5 rounded-lg transition-all ${
                        active
                          ? 'text-base font-bold text-[#22d3a6] bg-[rgba(34,211,166,0.08)]'
                          : 'text-sm font-medium text-[rgba(244,245,247,0.52)] hover:text-[#f4f5f7]'
                      }`}
                    >
                      {line.text}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-[rgba(244,245,247,0.84)] whitespace-pre-line px-1">
                {lyrics?.lyrics}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
