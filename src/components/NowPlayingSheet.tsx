import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Heart,
  Infinity as InfinityIcon,
  ListMusic,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { useAnimatedOverlay } from '../hooks/useAnimatedOverlay';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';
import { QueueList } from './QueueList';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface NowPlayingSheetProps {
  isOpen: boolean;
  initialTab?: 'queue' | 'lyrics';
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  playlistMenuOpen?: boolean;
  onPlaylistMenuOpenChange?: (open: boolean) => void;
  onClose: () => void;
}

export function NowPlayingSheet({
  isOpen,
  initialTab = 'queue',
  isExpanded,
  onExpandedChange,
  playlistMenuOpen,
  onPlaylistMenuOpenChange,
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
    clearUpcomingQueue,
    startTrackRadio,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
  } = usePlayer();
  const { tasteProfile, playlists, toggleLike, addTrackToPlaylist } = useLibrary();

  const { shouldRender, isVisible } = useAnimatedOverlay(isOpen, 300);

  const [tab, setTab] = useState<'queue' | 'lyrics'>(initialTab);
  const [internalExpanded, setInternalExpanded] = useState(initialTab === 'lyrics');
  const [internalPlaylistMenu, setInternalPlaylistMenu] = useState(false);

  const mobileExpanded = isExpanded ?? internalExpanded;
  const setMobileExpanded = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(mobileExpanded) : next;
    setInternalExpanded(resolved);
    onExpandedChange?.(resolved);
  };

  const showPlaylistMenu = playlistMenuOpen ?? internalPlaylistMenu;
  const setShowPlaylistMenu = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(showPlaylistMenu) : next;
    setInternalPlaylistMenu(resolved);
    onPlaylistMenuOpenChange?.(resolved);
  };

  // Interactive gesture offsets for swipe-down minimize & draggable bottom drawer
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetDragRef = useRef<{ startY: number; startX: number; lastTime: number; active: boolean } | null>(null);

  const [drawerDragY, setDrawerDragY] = useState(0);
  const [isDraggingDrawer, setIsDraggingDrawer] = useState(false);
  const drawerDragRef = useRef<{ startY: number; lastTime: number; wasExpanded: boolean } | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const activeLyricRef = useRef<HTMLButtonElement>(null);
  const lastTrackRef = useRef(currentTrack);
  if (currentTrack) lastTrackRef.current = currentTrack;

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      const startExpanded = initialTab === 'lyrics';
      setInternalExpanded(startExpanded);
      onExpandedChange?.(startExpanded);
      setSheetDragY(0);
      setDrawerDragY(0);
      closeBtnRef.current?.focus();
    } else {
      // Reset drawer & menu cleanly so rapid reopen never reveals a half-open stuck state
      setInternalExpanded(false);
      setInternalPlaylistMenu(false);
      setDrawerDragY(0);
      setIsDraggingSheet(false);
      setIsDraggingDrawer(false);
      sheetDragRef.current = null;
      drawerDragRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, isOpen]);

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
  }, [activeLyricIndex, isOpen, tab, mobileExpanded]);

  const lyricPreview = useMemo(() => {
    const synced = lyrics?.syncedLines;
    if (synced && synced.length > 0) {
      const idx = Math.max(0, activeLyricIndex);
      return {
        primary: synced[idx]?.text ?? '',
        secondary: synced[idx + 1]?.text ?? '',
      };
    }
    const plainLines = (lyrics?.lyrics ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (plainLines.length > 0 && !plainLines[0]!.startsWith('Lyrics not found')) {
      return {
        primary: plainLines[0] ?? '',
        secondary: plainLines[1] ?? '',
      };
    }
    return null;
  }, [lyrics, activeLyricIndex]);

  const activeTrack = currentTrack ?? lastTrackRef.current;
  if (!shouldRender || !activeTrack) return null;

  const liked = tasteProfile.likedTrackIds.includes(activeTrack.id);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const upcomingTrack =
    queueIndex >= 0 && queueIndex + 1 < queue.length ? queue[queueIndex + 1] : null;
  const artSrc = activeTrack.artworkUrl || FALLBACK_ART;

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (showPlaylistMenu) {
      setShowPlaylistMenu(false);
    } else if (mobileExpanded) {
      setMobileExpanded(false);
    } else {
      onClose();
    }
  };

  // Swipe down anywhere on upper hero player stage to dismiss Now Playing
  const handleHeroPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mobileExpanded) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('input, button, [data-no-sheet-drag]')) return;
    sheetDragRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      lastTime: Date.now(),
      active: false,
    };
  };

  const handleHeroPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const dx = Math.abs(e.clientX - drag.startX);
    if (!drag.active) {
      if (dy > 12 && dy > dx * 1.2) {
        drag.active = true;
        setIsDraggingSheet(true);
      } else if (dx > 18) {
        sheetDragRef.current = null;
        return;
      }
    }
    if (drag.active) {
      setSheetDragY(Math.max(0, dy));
    }
  };

  const handleHeroPointerEnd = () => {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    if (!drag?.active) return;
    const elapsed = Math.max(1, Date.now() - drag.lastTime);
    const velocity = sheetDragY / elapsed;
    setIsDraggingSheet(false);
    if (sheetDragY > 110 || velocity > 0.55) {
      onClose();
    } else {
      setSheetDragY(0);
    }
  };

  // Interactive drag handle gestures on Up Next / Lyrics bottom sheet
  const handleDrawerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    drawerDragRef.current = {
      startY: e.clientY,
      lastTime: Date.now(),
      wasExpanded: mobileExpanded,
    };
    setIsDraggingDrawer(true);
    setDrawerDragY(0);
  };

  const handleDrawerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = drawerDragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (drag.wasExpanded) {
      setDrawerDragY(Math.max(0, Math.min(360, dy)));
    } else {
      setDrawerDragY(Math.min(0, Math.max(-240, dy)));
    }
  };

  const handleDrawerPointerEnd = () => {
    const drag = drawerDragRef.current;
    drawerDragRef.current = null;
    if (!drag) return;
    const elapsed = Math.max(1, Date.now() - drag.lastTime);
    const velocity = Math.abs(drawerDragY) / elapsed;
    setIsDraggingDrawer(false);
    if (drag.wasExpanded && (drawerDragY > 75 || velocity > 0.5)) {
      setMobileExpanded(false);
    } else if (!drag.wasExpanded && (drawerDragY < -55 || velocity > 0.45)) {
      setMobileExpanded(true);
    }
    setDrawerDragY(0);
  };

  const sheetTransform = !isVisible
    ? 'translate3d(0, 100%, 0)'
    : isDraggingSheet && sheetDragY > 0
      ? `translate3d(0, ${sheetDragY}px, 0)`
      : 'translate3d(0, 0, 0)';

  const sheetOpacity = !isVisible
    ? 0
    : isDraggingSheet && sheetDragY > 0
      ? Math.max(0.45, 1 - sheetDragY / 620)
      : 1;

  return (
    <div
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      aria-label="Now playing studio"
      onKeyDown={handleDialogKeyDown}
      onPointerDown={handleHeroPointerDown}
      onPointerMove={handleHeroPointerMove}
      onPointerUp={handleHeroPointerEnd}
      onPointerCancel={handleHeroPointerEnd}
      style={{
        transform: sheetTransform,
        opacity: sheetOpacity,
      }}
      className={`fixed inset-0 z-50 bg-[#090b10] flex flex-col overflow-hidden ${
        isDraggingSheet
          ? ''
          : 'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
      } ${!isVisible ? 'pointer-events-none' : ''}`}
    >
      {/* Mobile Full-Bleed Immersive Artwork Hero Backdrop */}
      {artSrc ? (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden md:hidden">
          <img
            src={artSrc}
            alt=""
            className="w-full h-[64dvh] object-cover object-center transition-opacity duration-300"
          />
          <img
            src={artSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-[72px] saturate-150 opacity-45 -z-10"
          />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#090b10]/70 to-transparent" />
          <div className="absolute inset-x-0 top-[24dvh] bottom-0 bg-gradient-to-b from-transparent via-[#090b10]/85 via-45% to-[#090b10]" />
        </div>
      ) : null}

      {/* Desktop Ambient Cover Glow */}
      {artSrc ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden hidden md:block opacity-25"
        >
          <img
            src={artSrc}
            alt=""
            className="w-full h-full object-cover scale-125 blur-[90px] saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090b10]/55 via-[#090b10]/75 to-[#090b10]" />
        </div>
      ) : null}

      {/* Unified Top Floating Bar (Safe-Area Aware) */}
      <div
        className="relative z-50 px-4 md:px-8 pb-3 flex items-center justify-between gap-3 md:border-b md:border-[rgba(255,255,255,0.08)]"
        style={{ paddingTop: 'max(14px, var(--rv-safe-top))' }}
      >
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close now playing"
          onClick={onClose}
          className="rv-interactive-btn order-1 md:order-3 w-11 h-11 md:w-10 md:h-10 rounded-2xl md:rounded-xl bg-[rgba(14,18,27,0.58)] md:bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.16)] backdrop-blur-xl border border-[rgba(255,255,255,0.14)] md:border-transparent flex items-center justify-center text-[#f4f5f7] shrink-0"
        >
          <ChevronDown className="w-5 h-5 md:hidden" aria-hidden="true" />
          <X className="hidden md:block w-5 h-5" aria-hidden="true" />
        </button>

        {/* Center Pill on Mobile / Album Title on Desktop */}
        <div className="order-2 md:order-1 min-w-0 flex-1 md:flex-initial flex justify-center md:block">
          <div className="md:hidden max-w-[210px] px-3.5 py-1.5 rounded-full bg-[rgba(14,18,27,0.58)] backdrop-blur-xl border border-[rgba(255,255,255,0.14)] text-[11px] font-semibold text-[#f4f5f7] truncate text-center">
            {activeTrack.album || 'Now Playing'}
          </div>
          <div className="hidden md:block min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#22d3a6]">
              Now Playing
            </span>
            <h2 className="text-sm font-semibold text-[#f4f5f7] truncate">{activeTrack.album}</h2>
          </div>
        </div>

        {/* Playlist Menu Trigger */}
        <div className="order-3 md:order-2 relative shrink-0 md:ml-auto">
          <button
            type="button"
            aria-label="Playlist options"
            aria-expanded={showPlaylistMenu}
            onClick={() => setShowPlaylistMenu((v) => !v)}
            className="rv-interactive-btn w-11 h-11 md:w-10 md:h-10 rounded-2xl md:rounded-xl bg-[rgba(14,18,27,0.58)] md:bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.16)] backdrop-blur-xl border border-[rgba(255,255,255,0.14)] md:border-transparent flex items-center justify-center text-[#f4f5f7]"
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
          </button>

          {showPlaylistMenu ? (
            <div className="rv-tab-enter absolute right-0 top-12 z-50 w-52 p-1.5 rounded-2xl rv-glass-overlay border shadow-2xl space-y-0.5">
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[rgba(244,245,247,0.52)]">
                Save to Playlist
              </div>
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    addTrackToPlaylist(pl.id, activeTrack);
                    setShowPlaylistMenu(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(34,211,166,0.16)] hover:text-[#22d3a6] text-left truncate"
                >
                  {pl.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Responsive Stage: Full-Bleed Mobile Flow -> Split Desktop Studio */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col justify-end md:grid md:grid-cols-2 md:gap-8 md:items-center md:p-8 overflow-hidden">
        {/* Column 1: Cover (Desktop) + Title, Action Pills, Scrubber & Transport */}
        <div className="w-full max-w-md mx-auto px-5 pb-3 md:p-0 flex flex-col justify-end md:justify-center space-y-3.5 md:space-y-5 flex-1 md:flex-initial min-h-0">
          {/* Desktop Square Cover Art */}
          <div className="hidden md:block w-64 h-64 lg:w-80 lg:h-80 mx-auto rounded-2xl overflow-hidden bg-[#161b26] shadow-2xl border border-[rgba(255,255,255,0.12)]">
            <img
              src={artSrc}
              alt={`${activeTrack.album} artwork`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Mobile Spacer Above Scrim */}
          <div className="flex-1 min-h-[12dvh] md:hidden" aria-hidden="true" />

          {/* Title, Artist & Floating Frosted Heart */}
          <div className="w-full flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="md:hidden text-[11px] font-medium uppercase tracking-[0.12em] text-[rgba(244,245,247,0.62)] truncate mb-0.5">
                Playing From · {activeTrack.album || 'Single'}
              </div>
              <h3 className="text-[22px] sm:text-2xl font-bold text-[#f4f5f7] leading-tight line-clamp-2 text-balance">
                {activeTrack.title}
              </h3>
              <p className="text-sm text-[rgba(244,245,247,0.72)] truncate mt-0.5">
                {activeTrack.artist}
              </p>
            </div>

            <button
              type="button"
              aria-label={liked ? 'Unlike track' : 'Like track'}
              onClick={() => toggleLike(activeTrack)}
              className={`rv-interactive-btn w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 backdrop-blur-md ${
                liked
                  ? 'bg-[rgba(34,211,166,0.2)] border-[rgba(34,211,166,0.45)] text-[#22d3a6]'
                  : 'bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.16)] border-[rgba(255,255,255,0.16)] text-[#f4f5f7]'
              }`}
            >
              <Heart
                className={`w-5 h-5 ${liked ? 'fill-[#22d3a6] text-[#22d3a6]' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Quick Frosted Action Strip */}
          <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              aria-label="Build radio queue from track"
              onClick={() => void startTrackRadio(activeTrack)}
              className="rv-interactive-btn h-10 px-3.5 rounded-full bg-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.16)] backdrop-blur-md border border-[rgba(255,255,255,0.12)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5 shrink-0"
            >
              <Radio className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
              <span>Radio</span>
            </button>

            <button
              type="button"
              aria-label="Add current track to playlist"
              onClick={() => setShowPlaylistMenu((v) => !v)}
              className="rv-interactive-btn h-10 px-3.5 rounded-full bg-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.16)] backdrop-blur-md border border-[rgba(255,255,255,0.12)] text-xs font-semibold text-[#f4f5f7] inline-flex items-center gap-1.5 shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#f4f5f7]" aria-hidden="true" />
              <span>Save</span>
            </button>

            <button
              type="button"
              aria-pressed={infiniteRadio}
              onClick={() => setInfiniteRadio(!infiniteRadio)}
              className={`rv-interactive-btn h-10 px-3.5 rounded-full backdrop-blur-md border text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 ${
                infiniteRadio
                  ? 'bg-[rgba(34,211,166,0.18)] border-[rgba(34,211,166,0.42)] text-[#22d3a6]'
                  : 'bg-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.16)] border-[rgba(255,255,255,0.12)] text-[rgba(244,245,247,0.82)]'
              }`}
            >
              <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Autoplay</span>
            </button>
          </div>

          {/* High-Contrast Gradient Seek Bar */}
          <div className="w-full space-y-1.5 pt-0.5">
            <div className="relative h-6 flex items-center">
              <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.18)] overflow-hidden pointer-events-none">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22d3a6] to-[#6ee7b7]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#22d3a6] shadow-[0_0_12px_rgba(34,211,166,0.85)] ring-2 ring-[#f4f5f7]"
                style={{ left: `calc(${progress}% - 7px)` }}
              />
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                value={currentTime}
                aria-label="Seek track"
                onChange={(e) => seekTo(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            <div className="flex justify-between text-xs text-[rgba(244,245,247,0.68)] tabular-nums">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="w-full flex items-center justify-between gap-2 pb-1">
            <button
              type="button"
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              onClick={toggleShuffle}
              className={`rv-interactive-btn w-11 h-11 rounded-2xl flex items-center justify-center ${
                shuffle
                  ? 'bg-[rgba(34,211,166,0.18)] text-[#22d3a6]'
                  : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.75)] hover:text-[#f4f5f7]'
              }`}
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Previous"
              onClick={() => void prevTrack()}
              className="rv-interactive-btn w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] flex items-center justify-center text-[#f4f5f7]"
            >
              <SkipBack className="w-5 h-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => void togglePlay()}
              className="rv-interactive-btn w-16 h-16 md:w-14 md:h-14 rounded-full bg-[#f4f5f7] hover:bg-white text-[#090b10] flex items-center justify-center shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
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
              className="rv-interactive-btn w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] flex items-center justify-center text-[#f4f5f7]"
            >
              <SkipForward className="w-5 h-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={`Repeat mode: ${repeatMode}`}
              onClick={cycleRepeatMode}
              className={`rv-interactive-btn w-11 h-11 rounded-2xl flex items-center justify-center ${
                repeatMode !== 'off'
                  ? 'bg-[rgba(34,211,166,0.18)] text-[#22d3a6]'
                  : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.75)] hover:text-[#f4f5f7]'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Repeat className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Column 2: Draggable Up Next & Lyrics Bottom Sheet (< md) / Studio Panel (>= md) */}
        <section
          data-no-sheet-drag
          aria-label="Up Next and Lyrics panel"
          style={{
            paddingBottom: 'var(--rv-safe-bottom)',
            transform: isDraggingDrawer && drawerDragY !== 0 ? `translate3d(0, ${drawerDragY}px, 0)` : undefined,
          }}
          className={`flex flex-col border-[rgba(255,255,255,0.12)] overflow-hidden md:static md:h-[520px] md:rounded-2xl md:border md:bg-[rgba(15,19,28,0.86)] md:backdrop-blur-2xl ${
            isDraggingDrawer
              ? ''
              : 'transition-[transform,opacity,background-color] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]'
          } ${
            mobileExpanded
              ? 'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[max(58px,var(--rv-safe-top))] max-md:z-40 rounded-t-[28px] border-t bg-[rgba(11,14,22,0.98)] backdrop-blur-2xl'
              : 'rounded-t-[24px] border-t bg-[rgba(14,18,27,0.92)] backdrop-blur-2xl shadow-[0_-12px_36px_rgba(0,0,0,0.45)] md:shadow-none shrink-0'
          }`}
        >
          {/* Draggable Mobile Grab Handle */}
          <div
            onPointerDown={handleDrawerPointerDown}
            onPointerMove={handleDrawerPointerMove}
            onPointerUp={handleDrawerPointerEnd}
            onPointerCancel={handleDrawerPointerEnd}
            className="md:hidden touch-none pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing"
          >
            <button
              type="button"
              aria-label={
                mobileExpanded ? 'Collapse queue and lyrics panel' : 'Expand queue and lyrics panel'
              }
              onClick={() => setMobileExpanded((v) => !v)}
              className="px-8 py-1 rounded-full flex items-center justify-center group"
            >
              <span className="w-9 h-1 rounded-full bg-[rgba(255,255,255,0.3)] group-hover:bg-[rgba(255,255,255,0.5)]" />
            </button>
          </div>

          {/* Single Accessible Tab Header */}
          <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
            <div className="flex gap-1.5" role="tablist">
              {(
                [
                  { id: 'queue', label: `Up Next (${queue.length})`, Icon: ListMusic },
                  { id: 'lyrics', label: 'Lyrics', Icon: Mic2 },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => {
                    setTab(id);
                    setMobileExpanded(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 ${
                    tab === id
                      ? 'bg-[#22d3a6] text-[#042019]'
                      : 'text-[rgba(244,245,247,0.68)] hover:text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {tab === 'queue' && queue.length > 1 ? (
                <button
                  type="button"
                  onClick={clearUpcomingQueue}
                  className="px-2.5 py-1 rounded-xl bg-[rgba(255,255,255,0.06)] hover:text-[#f87171] text-[11px] font-medium text-[rgba(244,245,247,0.68)] inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  Clear
                </button>
              ) : null}

              <button
                type="button"
                aria-label={mobileExpanded ? 'Minimize panel' : 'Expand panel'}
                onClick={() => setMobileExpanded((v) => !v)}
                className="md:hidden w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-[rgba(244,245,247,0.75)]"
              >
                {mobileExpanded ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Collapsed 2-Line Lyrics / Queue Peek Strip */}
          {!mobileExpanded ? (
            <button
              type="button"
              onClick={() => setMobileExpanded(true)}
              className="md:hidden w-full px-4 py-2.5 text-left space-y-0.5 hover:bg-[rgba(255,255,255,0.03)]"
            >
              {tab === 'lyrics' && lyricPreview ? (
                <>
                  <div className="text-[13px] font-semibold text-[#22d3a6] truncate">
                    {lyricPreview.primary}
                  </div>
                  {lyricPreview.secondary ? (
                    <div className="text-xs text-[rgba(244,245,247,0.6)] truncate">
                      {lyricPreview.secondary}
                    </div>
                  ) : null}
                </>
              ) : tab === 'queue' && upcomingTrack ? (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#22d3a6]">
                    Next Up · {queue.length} queued
                  </div>
                  <div className="text-xs font-medium text-[#f4f5f7] truncate">
                    {upcomingTrack.title} ·{' '}
                    <span className="text-[rgba(244,245,247,0.6)]">{upcomingTrack.artist}</span>
                  </div>
                </>
              ) : lyricPreview ? (
                <>
                  <div className="text-[13px] font-semibold text-[#22d3a6] truncate">
                    {lyricPreview.primary}
                  </div>
                  {lyricPreview.secondary ? (
                    <div className="text-xs text-[rgba(244,245,247,0.6)] truncate">
                      {lyricPreview.secondary}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-[rgba(244,245,247,0.62)] truncate">
                  Tap or swipe up for queue ({queue.length}) & lyrics
                </div>
              )}
            </button>
          ) : null}

          {/* Full Scrollable Queue & Synced Lyrics Body with Smooth Tab Cross-Fade */}
          <div
            className={`flex-1 overflow-y-auto rv-scroll p-3 ${
              mobileExpanded ? 'block' : 'hidden md:block'
            }`}
          >
            <div key={tab} className="rv-tab-enter">
              {tab === 'queue' ? (
                <QueueList />
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
                        className={`block w-full text-left px-3 py-1.5 rounded-lg transition-colors duration-150 ${
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
        </section>
      </div>
    </div>
  );
}
