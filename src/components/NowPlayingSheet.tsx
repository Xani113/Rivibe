import { useEffect, useRef, useState } from 'react';
import {
  Heart,
  Infinity as InfinityIcon,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatDuration } from '../utils/formatTime';

interface NowPlayingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NowPlayingSheet({ isOpen, onClose }: NowPlayingSheetProps) {
  const {
    currentTrack,
    currentRadioStation,
    queue,
    queueIndex,
    isPlaying,
    currentTime,
    duration,
    infiniteRadio,
    setInfiniteRadio,
    lyrics,
    isLoadingLyrics,
    artistSpotlight,
    playTrack,
    startTrackRadio,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
  } = usePlayer();
  const { tasteProfile, toggleLike } = useLibrary();
  const [tab, setTab] = useState<'queue' | 'lyrics' | 'artist'>('queue');
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeBtnRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !currentTrack) return null;

  const liked = tasteProfile.likedTrackIds.includes(currentTrack.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing studio"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-[rgba(12,9,7,0.76)] backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6"
    >
      <div className="rv-window-glass rounded-[28px] w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,244,230,0.12)]">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#f0c46c] font-semibold">
              {currentRadioStation ? 'Live Radio' : 'Now Playing'}
            </span>
            <h2 className="text-base font-semibold text-[#fbf7f2] truncate">
              {currentRadioStation ? currentRadioStation.name : currentTrack.album}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close now playing"
            onClick={onClose}
            className="rv-interactive-btn w-10 h-10 rounded-full bg-[rgba(255,248,240,0.12)] hover:bg-[rgba(255,248,240,0.2)] flex items-center justify-center text-[#fbf7f2]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rv-scroll p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Artwork & Controls */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <img
              src={currentTrack.artworkUrl}
              alt={`${currentTrack.album} artwork`}
              className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl object-cover shadow-2xl"
            />

            <div className="text-center w-full">
              <h3 className="text-xl font-bold text-[#fbf7f2] truncate">{currentTrack.title}</h3>
              <p className="text-sm text-[rgba(247,239,230,0.72)] truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>

            {!currentRadioStation ? (
              <div className="w-full space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, duration)}
                  value={currentTime}
                  aria-label="Seek track"
                  onChange={(e) => seekTo(Number(e.target.value))}
                  className="w-full accent-[#f0c46c]"
                />
                <div className="flex justify-between text-xs text-[rgba(247,239,230,0.58)] tabular-nums">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label={liked ? 'Unlike track' : 'Like track'}
                onClick={() => toggleLike(currentTrack)}
                className="rv-interactive-btn w-11 h-11 rounded-full bg-[rgba(255,248,240,0.1)] flex items-center justify-center"
              >
                <Heart
                  className={`w-5 h-5 ${liked ? 'fill-[#e87a64] text-[#e87a64]' : 'text-[#fbf7f2]'}`}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                aria-label="Previous"
                onClick={() => void prevTrack()}
                className="rv-interactive-btn w-11 h-11 rounded-full bg-[rgba(255,248,240,0.1)] flex items-center justify-center text-[#fbf7f2]"
              >
                <SkipBack className="w-5 h-5 fill-current" aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={() => void togglePlay()}
                className="rv-interactive-btn w-14 h-14 rounded-full bg-[#f0c46c] text-[#1a140f] flex items-center justify-center shadow-lg"
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
                className="rv-interactive-btn w-11 h-11 rounded-full bg-[rgba(255,248,240,0.1)] flex items-center justify-center text-[#fbf7f2]"
              >
                <SkipForward className="w-5 h-5 fill-current" aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label="Start track radio"
                title="Start Track Radio"
                onClick={() => void startTrackRadio(currentTrack)}
                className="rv-interactive-btn w-11 h-11 rounded-full bg-[rgba(240,196,108,0.18)] text-[#f0c46c] flex items-center justify-center"
              >
                <Radio className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Right: Up Next / Lyrics / Artist Spotlight */}
          <div className="flex flex-col min-h-[280px] rounded-2xl bg-[rgba(18,14,11,0.34)] border border-[rgba(255,244,230,0.12)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,244,230,0.1)]">
              <div className="flex gap-1" role="tablist">
                {(['queue', 'lyrics', 'artist'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
                      tab === t
                        ? 'bg-[rgba(255,248,240,0.18)] text-[#fbf7f2]'
                        : 'text-[rgba(247,239,230,0.62)] hover:text-[#fbf7f2]'
                    }`}
                  >
                    {t === 'queue' ? 'Up Next' : t === 'lyrics' ? 'Lyrics' : 'Artist'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setInfiniteRadio(!infiniteRadio)}
                aria-pressed={infiniteRadio}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 ${
                  infiniteRadio
                    ? 'bg-[rgba(240,196,108,0.22)] text-[#f0c46c]'
                    : 'bg-[rgba(255,248,240,0.08)] text-[rgba(247,239,230,0.6)]'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Auto-Radio
              </button>
            </div>

            <div className="flex-1 overflow-y-auto rv-scroll p-3">
              {tab === 'queue' ? (
                <ul className="space-y-1.5">
                  {queue.map((item, idx) => (
                    <li key={`${item.id}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => void playTrack(item, queue)}
                        className={`w-full p-2 rounded-xl flex items-center gap-3 text-left ${
                          idx === queueIndex
                            ? 'bg-[rgba(240,196,108,0.18)] text-[#fbf7f2]'
                            : 'hover:bg-[rgba(255,248,240,0.08)] text-[rgba(247,239,230,0.8)]'
                        }`}
                      >
                        <img
                          src={item.artworkUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate">{item.title}</div>
                          <div className="text-[11px] text-[rgba(247,239,230,0.58)] truncate">
                            {item.artist}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {tab === 'lyrics' ? (
                <div className="text-xs leading-relaxed text-[rgba(247,239,230,0.84)] whitespace-pre-line">
                  {isLoadingLyrics ? 'Fetching lyrics via Lyrics.ovh...' : lyrics?.lyrics}
                </div>
              ) : null}

              {tab === 'artist' ? (
                <div className="space-y-2.5 text-xs text-[rgba(247,239,230,0.82)]">
                  {artistSpotlight ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-[rgba(240,196,108,0.2)] text-[#f0c46c]">
                          {artistSpotlight.genre}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[rgba(255,248,240,0.12)]">
                          Mood: {artistSpotlight.mood}
                        </span>
                        {artistSpotlight.country ? (
                          <span className="px-2 py-0.5 rounded-full bg-[rgba(255,248,240,0.12)]">
                            {artistSpotlight.country}
                          </span>
                        ) : null}
                      </div>
                      <p className="leading-relaxed text-pretty">
                        {artistSpotlight.biography || 'No artist biography available.'}
                      </p>
                    </>
                  ) : (
                    <p className="text-[rgba(247,239,230,0.6)]">
                      Artist bio powered by TheAudioDB will appear here when available.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
