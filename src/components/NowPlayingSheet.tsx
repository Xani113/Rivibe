import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  ListMusic,
  Mic2,
  Moon,
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
import { usePlayer, type SleepTimerMode } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { useOptionalOverlay } from '../context/overlayStore';
import { useAnimatedOverlay } from '../hooks/useAnimatedOverlay';
import { formatDuration } from '../utils/formatTime';
import { useTrackTint } from '../utils/dominantColor';
import { SEED_TRACKS } from '../services/seedCatalog';
import { ArtworkImage } from './ArtworkImage';
import { QueueList } from './QueueList';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';
const SLEEP_OPTIONS: Array<{ mode: SleepTimerMode; label: string }> = [
  { mode: 'off', label: 'Off' },
  { mode: '15m', label: '15m' },
  { mode: '30m', label: '30m' },
  { mode: '60m', label: '60m' },
];

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
    sleepTimerMode,
    lyrics,
    isLoadingLyrics,
    setInfiniteRadio,
    setSleepTimer,
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
  const overlay = useOptionalOverlay();

  const { shouldRender, isVisible } = useAnimatedOverlay(isOpen, 360);

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
  const sheetDragRef = useRef<{
    startY: number;
    startX: number;
    lastDy: number;
    lastTime: number;
    active: boolean;
  } | null>(null);

  const [drawerDragY, setDrawerDragY] = useState(0);
  const [isDraggingDrawer, setIsDraggingDrawer] = useState(false);
  const drawerDragRef = useRef<{
    startY: number;
    startX: number;
    lastDy: number;
    lastTime: number;
    wasExpanded: boolean;
    active: boolean;
  } | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const activeLyricRef = useRef<HTMLButtonElement>(null);
  const lastTrackRef = useRef(currentTrack);
  if (currentTrack) lastTrackRef.current = currentTrack;

  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current && typeof document !== 'undefined') {
        const active = document.activeElement;
        previousFocusRef.current = active instanceof HTMLElement ? active : null;
      }
      wasOpenRef.current = true;
      setTab(initialTab);
      const startExpanded = initialTab === 'lyrics';
      setInternalExpanded(startExpanded);
      onExpandedChange?.(startExpanded);
      setSheetDragY(0);
      setDrawerDragY(0);
    } else {
      // Reset drawer & menu cleanly so rapid reopen never reveals a half-open stuck state
      setInternalExpanded(false);
      setInternalPlaylistMenu(false);
      setSheetDragY(0);
      setDrawerDragY(0);
      setIsDraggingSheet(false);
      setIsDraggingDrawer(false);
      sheetDragRef.current = null;
      drawerDragRef.current = null;
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, isOpen]);

  // Focus Close button once the dialog DOM is actually mounted
  useEffect(() => {
    if (isOpen && shouldRender) {
      closeBtnRef.current?.focus();
    }
  }, [isOpen, shouldRender]);

  const resetSheetDrag = () => {
    sheetDragRef.current = null;
    setIsDraggingSheet(false);
    setSheetDragY(0);
  };

  const resetDrawerDrag = () => {
    drawerDragRef.current = null;
    setIsDraggingDrawer(false);
    setDrawerDragY(0);
  };

  // Global window pointer safety so releasing/canceling outside the sheet never leaves drag state stuck
  useEffect(() => {
    if (!isDraggingSheet && !isDraggingDrawer) return;

    const finalizeSheetDrag = () => {
      const drag = sheetDragRef.current;
      sheetDragRef.current = null;
      setIsDraggingSheet(false);
      if (drag?.active) {
        const elapsed = Math.max(1, Date.now() - drag.lastTime);
        const downwardVelocity = drag.lastDy / elapsed;
        if (drag.lastDy >= 32 && (drag.lastDy > 110 || downwardVelocity > 0.55)) {
          onClose();
        }
      }
      setSheetDragY(0);
    };

    const finalizeDrawerDrag = () => {
      const drag = drawerDragRef.current;
      drawerDragRef.current = null;
      setIsDraggingDrawer(false);
      if (drag?.active) {
        const elapsed = Math.max(1, Date.now() - drag.lastTime);
        if (drag.wasExpanded) {
          const downwardVelocity = drag.lastDy / elapsed;
          if (drag.lastDy >= 28 && (drag.lastDy > 75 || downwardVelocity > 0.5)) {
            setMobileExpanded(false);
          }
        } else {
          const upwardVelocity = -drag.lastDy / elapsed;
          if (drag.lastDy <= -28 && (drag.lastDy < -55 || upwardVelocity > 0.45)) {
            setMobileExpanded(true);
          }
        }
      }
      setDrawerDragY(0);
    };

    const onWindowPointerUp = () => {
      if (sheetDragRef.current) finalizeSheetDrag();
      if (drawerDragRef.current) finalizeDrawerDrag();
    };

    const onWindowPointerCancel = () => {
      if (sheetDragRef.current) resetSheetDrag();
      if (drawerDragRef.current) resetDrawerDrag();
    };

    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraggingDrawer, isDraggingSheet, onClose]);

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
  const activeTint = useTrackTint(activeTrack);
  if (!shouldRender || !activeTrack) return null;

  const liked = tasteProfile.likedTrackIds.includes(activeTrack.id);
  const canSeek = Number.isFinite(duration) && duration > 0;
  const clampedTime = canSeek ? Math.min(Math.max(0, currentTime), duration) : 0;
  const progress = canSeek ? Math.min(100, Math.max(0, (clampedTime / duration) * 100)) : 0;
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
      lastDy: 0,
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
      } else if (dx > 18 || dy < -12) {
        sheetDragRef.current = null;
        return;
      }
    }
    if (drag.active) {
      const clampedDy = Math.max(0, dy);
      drag.lastDy = clampedDy;
      setSheetDragY(clampedDy);
    }
  };

  const handleHeroPointerEnd = () => {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    setIsDraggingSheet(false);
    if (drag?.active) {
      const elapsed = Math.max(1, Date.now() - drag.lastTime);
      const downwardVelocity = drag.lastDy / elapsed;
      if (drag.lastDy >= 32 && (drag.lastDy > 110 || downwardVelocity > 0.55)) {
        setSheetDragY(0);
        onClose();
        return;
      }
    }
    setSheetDragY(0);
  };

  // Interactive drag handle gestures on Up Next / Lyrics bottom sheet (direction + meaningful distance guarded)
  const handleDrawerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('button')) return;
    drawerDragRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      lastDy: 0,
      lastTime: Date.now(),
      wasExpanded: mobileExpanded,
      active: false,
    };
  };

  const handleDrawerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = drawerDragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const dx = Math.abs(e.clientX - drag.startX);

    if (!drag.active) {
      const correctDirection = drag.wasExpanded ? dy > 10 : dy < -10;
      if (correctDirection && Math.abs(dy) > dx * 1.15) {
        drag.active = true;
        setIsDraggingDrawer(true);
      } else if (dx > 18 || (drag.wasExpanded && dy < -12) || (!drag.wasExpanded && dy > 12)) {
        resetDrawerDrag();
        return;
      } else {
        return;
      }
    }

    const clampedDy = drag.wasExpanded
      ? Math.max(0, Math.min(360, dy))
      : Math.min(0, Math.max(-240, dy));
    drag.lastDy = clampedDy;
    setDrawerDragY(clampedDy);
  };

  const handleDrawerPointerEnd = () => {
    const drag = drawerDragRef.current;
    drawerDragRef.current = null;
    setIsDraggingDrawer(false);
    if (drag?.active) {
      const elapsed = Math.max(1, Date.now() - drag.lastTime);
      if (drag.wasExpanded) {
        const downwardVelocity = drag.lastDy / elapsed;
        if (drag.lastDy >= 28 && (drag.lastDy > 75 || downwardVelocity > 0.5)) {
          setMobileExpanded(false);
        }
      } else {
        const upwardVelocity = -drag.lastDy / elapsed;
        if (drag.lastDy <= -28 && (drag.lastDy < -55 || upwardVelocity > 0.45)) {
          setMobileExpanded(true);
        }
      }
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
      onPointerCancel={resetSheetDrag}
      style={{
        transform: sheetTransform,
        opacity: sheetOpacity,
      }}
      className={`fixed inset-0 z-50 bg-[#090b10] flex flex-col overflow-hidden will-change-transform ${
        isDraggingSheet
          ? ''
          : 'transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)]'
      } ${!isVisible ? 'pointer-events-none' : ''}`}
    >
      {/* Mobile Full-Bleed Edge-to-Edge Artwork Hero + Album-Synced Lower Atmosphere */}
      {artSrc ? (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden md:hidden">
          <ArtworkImage
            src={artSrc}
            youtubeVideoId={activeTrack.youtubeVideoId}
            priority="high"
            alt=""
            className="w-full h-[58dvh] object-cover object-center transition-opacity duration-300"
          />
          <ArtworkImage
            src={artSrc}
            youtubeVideoId={activeTrack.youtubeVideoId}
            priority="low"
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-[76px] saturate-150 opacity-50 -z-10"
          />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#090b10]/70 to-transparent" />
          <div
            style={{
              background: `linear-gradient(to bottom, transparent 18dvh, ${activeTint.deepSurface} 54dvh, ${activeTint.deepSurface} 100%)`,
            }}
            className="absolute inset-0 transition-[background] duration-300"
          />
          <div
            style={{
              background: `radial-gradient(ellipse at 50% 92%, ${activeTint.glowRgba} 0%, transparent 68%)`,
            }}
            className="absolute inset-x-0 bottom-0 h-[48dvh] opacity-40 transition-[background] duration-300"
          />
        </div>
      ) : null}

      {/* Desktop Ambient Cover Glow */}
      {artSrc ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden hidden md:block opacity-30"
        >
          <ArtworkImage
            src={artSrc}
            youtubeVideoId={activeTrack.youtubeVideoId}
            priority="high"
            alt=""
            className="w-full h-full object-cover scale-125 blur-[90px] saturate-150"
          />
          <div
            style={{
              background: `linear-gradient(to bottom, rgba(9,11,16,0.55), ${activeTint.deepSurface})`,
            }}
            className="absolute inset-0"
          />
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
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a78bfa]">
              Now Playing
            </span>
            <h2 className="text-sm font-semibold text-[#f4f5f7] truncate">{activeTrack.album}</h2>
          </div>
        </div>

        {/* Playlist, Autoplay & Sleep Timer Menu Trigger */}
        <div className="order-3 md:order-2 relative shrink-0 md:ml-auto">
          <button
            type="button"
            aria-label="Playlist options"
            aria-expanded={showPlaylistMenu}
            onClick={() => setShowPlaylistMenu((v) => !v)}
            className="rv-interactive-btn relative w-11 h-11 md:w-10 md:h-10 rounded-2xl md:rounded-xl bg-[rgba(14,18,27,0.58)] md:bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.16)] backdrop-blur-xl border border-[rgba(255,255,255,0.14)] md:border-transparent flex items-center justify-center text-[#f4f5f7]"
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            {sleepTimerMode !== 'off' ? (
              <span
                aria-hidden="true"
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#a78bfa]"
              />
            ) : null}
          </button>

          {showPlaylistMenu ? (
            <>
              <div
                aria-hidden="true"
                onClick={() => setShowPlaylistMenu(false)}
                className="fixed inset-0 z-40"
              />
              <div className="rv-tab-enter absolute right-0 top-12 z-50 w-56 p-1.5 rounded-2xl rv-glass-overlay border shadow-2xl space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[rgba(244,245,247,0.52)]">
                  Add to Playlist
                </div>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      addTrackToPlaylist(pl.id, activeTrack);
                      setShowPlaylistMenu(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(124,92,255,0.18)] hover:text-[#c4b5fd] text-left truncate"
                  >
                    {pl.name}
                  </button>
                ))}

                <div className="my-1 border-t border-[rgba(255,255,255,0.08)]" />
                <button
                  type="button"
                  aria-pressed={infiniteRadio}
                  onClick={() => {
                    setInfiniteRadio(!infiniteRadio);
                    setShowPlaylistMenu(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(124,92,255,0.18)] flex items-center justify-between gap-2 text-left"
                >
                  <span>Autoplay similar</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      infiniteRadio
                        ? 'bg-[#7c5cff] text-white'
                        : 'bg-[rgba(255,255,255,0.08)] text-[rgba(244,245,247,0.65)]'
                    }`}
                  >
                    {infiniteRadio ? 'On' : 'Off'}
                  </span>
                </button>

                <div className="my-1 border-t border-[rgba(255,255,255,0.08)]" />
                <div className="px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[rgba(244,245,247,0.52)]">
                  <Moon className="w-3 h-3 text-[#a78bfa]" aria-hidden="true" />
                  <span>Sleep Timer</span>
                </div>
                <div className="grid grid-cols-4 gap-1 px-1 pb-1">
                  {SLEEP_OPTIONS.map(({ mode, label }) => {
                    const selected = sleepTimerMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSleepTimer(mode);
                          setShowPlaylistMenu(false);
                        }}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                          selected
                            ? 'bg-[#7c5cff] text-white'
                            : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.72)] hover:text-[#f4f5f7]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Responsive Stage: Full-Bleed Mobile Flow -> Split Desktop Studio */}
      <div
        style={{
          paddingLeft: 'var(--rv-safe-left)',
          paddingRight: 'var(--rv-safe-right)',
        }}
        className="relative z-10 flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col justify-end md:grid md:grid-cols-2 md:gap-8 md:items-center md:p-8 overflow-hidden"
      >
        {/* Column 1: Hero Artwork Zone + Title, Artist, Stacked Radio & Like, Album-Synced Scrubber & Transport */}
        <div className="w-full max-w-md mx-auto px-5 pb-2.5 md:p-0 flex flex-col justify-end md:justify-center space-y-2.5 sm:space-y-3 md:space-y-5 flex-1 md:flex-initial min-h-0 max-h-full overflow-y-auto no-scrollbar">
          {/* Desktop Square Cover Art (adapts cleanly to short landscape viewports) */}
          <div
            style={{
              borderColor: activeTint.cardBorder,
              boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 42px ${activeTint.cardBg}`,
            }}
            className="hidden md:block [@media(max-height:480px)]:hidden w-[clamp(140px,30dvh,300px)] aspect-square mx-auto rounded-2xl overflow-hidden bg-[#161b26] border shrink-0"
          >
            <ArtworkImage
              src={artSrc}
              youtubeVideoId={activeTrack.youtubeVideoId}
              priority="high"
              alt={`${activeTrack.album} artwork`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Mobile Vertical Spacer so full-bleed hero artwork remains visible above title */}
          <div className="md:hidden [@media(max-height:560px)]:hidden flex-1 min-h-[16px]" aria-hidden="true" />

          {/* Title, Tappable Artist Credit + Vertical Stack (Radio directly above Like) */}
          <div className="w-full flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="md:hidden text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[rgba(244,245,247,0.68)] truncate mb-0.5">
                Playing From · {activeTrack.album || 'Single'}
              </div>
              <h3 className="text-[22px] sm:text-2xl font-bold text-[#f4f5f7] leading-tight line-clamp-2 text-balance drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                {activeTrack.title}
              </h3>
              <button
                type="button"
                aria-label={`Know about ${activeTrack.artist}`}
                onClick={() => overlay?.openArtistInfo(activeTrack.artist, activeTrack)}
                className="text-sm text-[rgba(244,245,247,0.82)] hover:text-white hover:underline underline-offset-2 truncate mt-0.5 max-w-full text-left block"
              >
                {activeTrack.artist}
              </button>
              {sleepTimerMode !== 'off' ? (
                <button
                  type="button"
                  onClick={() => setSleepTimer('off')}
                  className="mt-1.5 h-6 px-2.5 rounded-full bg-[rgba(124,92,255,0.24)] border border-[rgba(167,139,250,0.45)] text-[11px] font-semibold text-[#c4b5fd] inline-flex items-center gap-1"
                >
                  <Moon className="w-3 h-3" aria-hidden="true" />
                  <span>{sleepTimerMode}</span>
                </button>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                type="button"
                aria-label="Build radio queue from track"
                title="Build Radio Queue"
                onClick={() => void startTrackRadio(activeTrack)}
                className="rv-interactive-btn w-11 h-11 rounded-2xl flex items-center justify-center bg-[rgba(14,18,27,0.6)] hover:bg-[rgba(255,255,255,0.16)] border border-[rgba(255,255,255,0.16)] backdrop-blur-xl text-[#f4f5f7] shadow-lg"
              >
                <Radio
                  className="w-5 h-5"
                  style={{ color: activeTint.accentHex || '#a78bfa' }}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                aria-label={liked ? 'Unlike track' : 'Like track'}
                onClick={() => toggleLike(activeTrack)}
                style={
                  liked
                    ? {
                        backgroundColor: activeTint.cardBg,
                        borderColor: activeTint.cardBorder,
                        color: activeTint.subtextColor,
                      }
                    : undefined
                }
                className={`rv-interactive-btn w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 backdrop-blur-xl ${
                  liked
                    ? 'shadow-lg'
                    : 'bg-[rgba(14,18,27,0.6)] hover:bg-[rgba(255,255,255,0.16)] border-[rgba(255,255,255,0.16)] text-[#f4f5f7]'
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${liked ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {/* High-Contrast Album-Tinted Seek Bar */}
          <div className="w-full space-y-1.5 pt-0.5">
            <div className="relative h-6 flex items-center">
              <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.18)] overflow-hidden pointer-events-none">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${activeTint.accentHex || '#7c5cff'}, #f4f5f7)`,
                  }}
                />
              </div>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-[#f4f5f7]"
                style={{
                  left: `calc(${progress}% - 7px)`,
                  backgroundColor: activeTint.accentHex || '#a78bfa',
                  boxShadow: `0 0 12px ${activeTint.accentHex || 'rgba(124,92,255,0.85)'}`,
                }}
              />
              <input
                type="range"
                min={0}
                max={canSeek ? duration : 0}
                value={clampedTime}
                disabled={!canSeek}
                aria-label="Seek track"
                aria-valuetext={
                  canSeek
                    ? `${formatDuration(clampedTime)} of ${formatDuration(duration)}`
                    : 'Duration unavailable'
                }
                onChange={(e) => seekTo(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
              />
            </div>

            <div className="flex justify-between text-xs text-[rgba(244,245,247,0.68)] tabular-nums">
              <span>{formatDuration(clampedTime)}</span>
              <span>{canSeek ? formatDuration(duration) : '0:00'}</span>
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
                  ? 'bg-[rgba(124,92,255,0.22)] text-[#c4b5fd]'
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
                  ? 'bg-[rgba(124,92,255,0.22)] text-[#c4b5fd]'
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

        {/* Mobile Collapsed Bottom Peek Bar (album-cover synced surface & Up Next / Lyrics preview) */}
        <div
          data-no-sheet-drag
          data-testid="mobile-peek-bar"
          onPointerDown={handleDrawerPointerDown}
          onPointerMove={handleDrawerPointerMove}
          onPointerUp={handleDrawerPointerEnd}
          onPointerCancel={resetDrawerDrag}
          style={{
            paddingBottom: 'max(8px, var(--rv-safe-bottom))',
            backgroundColor: activeTint.drawerSurface,
            borderColor: activeTint.cardBorder,
            transform: !mobileExpanded && isDraggingDrawer && drawerDragY < 0
              ? `translate3d(0, ${drawerDragY * 0.35}px, 0)`
              : undefined,
          }}
          className={`md:hidden touch-none shrink-0 rounded-t-[24px] border-t backdrop-blur-2xl shadow-[0_-12px_36px_rgba(0,0,0,0.48)] transition-[background-color,border-color,opacity] duration-300 ${
            mobileExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="pt-2.5 pb-1 flex justify-center">
            <button
              type="button"
              aria-label="Expand queue and lyrics panel"
              onClick={() => setMobileExpanded(true)}
              className="px-8 py-1.5 rounded-full flex items-center justify-center group"
            >
              <span className="w-9 h-1 rounded-full bg-[rgba(255,255,255,0.3)] group-hover:bg-[rgba(255,255,255,0.5)]" />
            </button>
          </div>

          <div className="px-4 pb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTab('queue');
                  setMobileExpanded(true);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 ${
                  tab === 'queue'
                    ? 'bg-[#7c5cff] text-white'
                    : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.75)]'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Up Next ({queue.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('lyrics');
                  setMobileExpanded(true);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 ${
                  tab === 'lyrics'
                    ? 'bg-[#7c5cff] text-white'
                    : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.75)]'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lyrics</span>
              </button>
            </div>

            <button
              type="button"
              aria-label="Expand panel"
              onClick={() => setMobileExpanded(true)}
              className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-[rgba(244,245,247,0.75)]"
            >
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {!mobileExpanded ? (
            <button
              type="button"
              onClick={() => setMobileExpanded(true)}
              className="w-full px-4 py-2 text-left space-y-0.5 hover:bg-[rgba(255,255,255,0.03)]"
            >
              {tab === 'lyrics' && lyricPreview ? (
                <>
                  <div
                    style={{ color: activeTint.subtextColor || '#a78bfa' }}
                    className="text-[13px] font-semibold truncate"
                  >
                    {lyricPreview.primary}
                  </div>
                  {lyricPreview.secondary ? (
                    <div className="text-xs text-[rgba(244,245,247,0.62)] truncate">
                      {lyricPreview.secondary}
                    </div>
                  ) : null}
                </>
              ) : tab === 'queue' && upcomingTrack ? (
                <>
                  <div
                    style={{ color: activeTint.subtextColor || '#a78bfa' }}
                    className="text-[10px] font-bold uppercase tracking-wider"
                  >
                    Next Up · {queue.length} queued
                  </div>
                  <div className="text-xs font-medium text-[#f4f5f7] truncate">
                    {upcomingTrack.title} ·{' '}
                    <span className="text-[rgba(244,245,247,0.62)]">{upcomingTrack.artist}</span>
                  </div>
                </>
              ) : lyricPreview ? (
                <>
                  <div
                    style={{ color: activeTint.subtextColor || '#a78bfa' }}
                    className="text-[13px] font-semibold truncate"
                  >
                    {lyricPreview.primary}
                  </div>
                  {lyricPreview.secondary ? (
                    <div className="text-xs text-[rgba(244,245,247,0.62)] truncate">
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
          ) : (
            <div className="h-12" aria-hidden="true" />
          )}
        </div>

        {/* Column 2: Permanently-fixed Fast GPU Bottom Sheet (< md) / Studio Panel (>= md) */}
        <section
          data-no-sheet-drag
          aria-label="Up Next and Lyrics panel"
          style={{
            paddingBottom: 'var(--rv-safe-bottom)',
            backgroundColor: activeTint.drawerSurface,
            borderColor: activeTint.cardBorder,
            transform:
              mobileExpanded && isDraggingDrawer && drawerDragY > 0
                ? `translate3d(0, ${drawerDragY}px, 0)`
                : undefined,
          }}
          className={`flex flex-col border overflow-hidden will-change-transform transition-[transform,background-color,border-color] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[max(56px,var(--rv-safe-top))] max-md:z-40 max-md:rounded-t-[28px] max-md:border-t max-md:backdrop-blur-2xl max-md:shadow-[0_-16px_44px_rgba(0,0,0,0.65)] md:static md:h-[min(520px,calc(100dvh-104px))] md:rounded-2xl md:backdrop-blur-2xl ${
            isDraggingDrawer
              ? 'duration-300'
              : 'duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
          } ${
            mobileExpanded
              ? 'max-md:translate-y-0'
              : 'max-md:translate-y-full max-md:pointer-events-none'
          }`}
        >
          {/* Draggable Mobile Grab Handle */}
          <div
            onPointerDown={handleDrawerPointerDown}
            onPointerMove={handleDrawerPointerMove}
            onPointerUp={handleDrawerPointerEnd}
            onPointerCancel={resetDrawerDrag}
            className="md:hidden touch-none pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing"
          >
            {mobileExpanded ? (
              <button
                type="button"
                aria-label="Collapse queue and lyrics panel"
                onClick={() => setMobileExpanded(false)}
                className="px-8 py-1 rounded-full flex items-center justify-center group"
              >
                <span className="w-9 h-1 rounded-full bg-[rgba(255,255,255,0.3)] group-hover:bg-[rgba(255,255,255,0.5)]" />
              </button>
            ) : (
              <span className="w-9 h-1 my-1 rounded-full bg-[rgba(255,255,255,0.28)]" />
            )}
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
                      ? 'bg-[#7c5cff] text-white'
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
                aria-label="Minimize panel"
                onClick={() => setMobileExpanded(false)}
                className="md:hidden w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-[rgba(244,245,247,0.75)]"
              >
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Persistent Queue Container + Studio Fade Lyrics Body */}
          <div data-queue-scroll-container className="flex-1 overflow-y-auto rv-scroll p-3">
            <div className={tab === 'queue' ? 'block' : 'hidden'}>
              <QueueList isActive={isVisible && tab === 'queue' && mobileExpanded} />
            </div>

            {tab === 'lyrics' ? (
              <div className="rv-tab-enter [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_94%,transparent)]">
                {isLoadingLyrics ? (
                  <div className="py-12 text-center text-xs text-[rgba(244,245,247,0.58)]">
                    Loading lyrics...
                  </div>
                ) : lyrics?.syncedLines && lyrics.syncedLines.length > 0 ? (
                  <div className="space-y-1.5 py-3">
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
                              ? 'text-base font-bold text-[#c4b5fd] bg-[rgba(124,92,255,0.14)]'
                              : 'text-sm font-medium text-[rgba(244,245,247,0.52)] hover:text-[#f4f5f7]'
                          }`}
                        >
                          {line.text}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-[rgba(244,245,247,0.84)] whitespace-pre-line px-1 py-2">
                    {lyrics?.lyrics}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
