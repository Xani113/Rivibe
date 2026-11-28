import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
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
  const [showBottomSleepMenu, setShowBottomSleepMenu] = useState(false);

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
  const suppressDrawerClickRef = useRef(false);
  const drawerDragRef = useRef<{
    startY: number;
    startX: number;
    lastDy: number;
    lastTime: number;
    wasExpanded: boolean;
    fromScrollTop?: boolean;
    scrollEl?: HTMLElement | null;
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
      setShowBottomSleepMenu(false);
    } else {
      // Reset drawer & menu cleanly so rapid reopen never reveals a half-open stuck state
      setInternalExpanded(false);
      setInternalPlaylistMenu(false);
      setShowBottomSleepMenu(false);
      setSheetDragY(0);
      setDrawerDragY(0);
      setIsDraggingSheet(false);
      setIsDraggingDrawer(false);
      sheetDragRef.current = null;
      drawerDragRef.current = null;
      suppressDrawerClickRef.current = false;
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

  // Global window pointer tracking so fast swipes never stall when leaving small handles
  useEffect(() => {
    if (!isOpen) return;

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
        suppressDrawerClickRef.current = true;
        window.setTimeout(() => {
          suppressDrawerClickRef.current = false;
        }, 120);
        const elapsed = Math.max(1, Date.now() - drag.lastTime);
        if (drag.wasExpanded) {
          const downwardVelocity = drag.lastDy / elapsed;
          if (drag.lastDy >= 28 && (drag.lastDy > 72 || downwardVelocity > 0.45)) {
            setMobileExpanded(false);
          }
        } else {
          const upwardVelocity = -drag.lastDy / elapsed;
          if (drag.lastDy <= -28 && (drag.lastDy < -55 || upwardVelocity > 0.42)) {
            setMobileExpanded(true);
          }
        }
      }
      setDrawerDragY(0);
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      const sDrag = sheetDragRef.current;
      if (sDrag) {
        const dy = e.clientY - sDrag.startY;
        const dx = Math.abs(e.clientX - sDrag.startX);
        if (!sDrag.active) {
          if (dy > 12 && dy > dx * 1.2) {
            sDrag.active = true;
            setIsDraggingSheet(true);
          } else if (dx > 18 || dy < -12) {
            resetSheetDrag();
          }
        }
        if (sDrag.active) {
          const clampedDy = Math.max(0, dy);
          sDrag.lastDy = clampedDy;
          setSheetDragY(clampedDy);
        }
      }

      const dDrag = drawerDragRef.current;
      if (dDrag) {
        const dy = e.clientY - dDrag.startY;
        const dx = Math.abs(e.clientX - dDrag.startX);
        if (!dDrag.active) {
          if (dDrag.fromScrollTop && ((dDrag.scrollEl?.scrollTop ?? 0) > 2 || dy < -4)) {
            resetDrawerDrag();
            return;
          }
          const correctDirection = dDrag.wasExpanded ? dy > 10 : dy < -10;
          if (correctDirection && Math.abs(dy) > dx * 1.15) {
            dDrag.active = true;
            setIsDraggingDrawer(true);
          } else if (
            dx > 18 ||
            (dDrag.wasExpanded && dy < -12) ||
            (!dDrag.wasExpanded && dy > 12)
          ) {
            resetDrawerDrag();
            return;
          } else {
            return;
          }
        }

        const clampedDy = dDrag.wasExpanded
          ? Math.max(0, Math.min(480, dy))
          : Math.min(0, Math.max(-240, dy));
        dDrag.lastDy = clampedDy;
        setDrawerDragY(clampedDy);
      }
    };

    const onWindowPointerUp = () => {
      if (sheetDragRef.current) finalizeSheetDrag();
      if (drawerDragRef.current) finalizeDrawerDrag();
    };

    const onWindowPointerCancel = () => {
      if (sheetDragRef.current) resetSheetDrag();
      if (drawerDragRef.current) resetDrawerDrag();
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

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

  const activeTrack = currentTrack ?? lastTrackRef.current;
  const activeTint = useTrackTint(activeTrack);
  if (!shouldRender || !activeTrack) return null;

  const liked = tasteProfile.likedTrackIds.includes(activeTrack.id);
  const canSeek = Number.isFinite(duration) && duration > 0;
  const clampedTime = canSeek ? Math.min(Math.max(0, currentTime), duration) : 0;
  const progress = canSeek ? Math.min(100, Math.max(0, (clampedTime / duration) * 100)) : 0;
  const artSrc = activeTrack.artworkUrl || FALLBACK_ART;

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (showPlaylistMenu) {
      setShowPlaylistMenu(false);
    } else if (showBottomSleepMenu) {
      setShowBottomSleepMenu(false);
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

  // Start tracking vertical drawer drag (window listeners follow pointer across entire screen)
  const handleDrawerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const targetEl = e.target as HTMLElement;
    if (!mobileExpanded && targetEl.closest('button')) return;
    drawerDragRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      lastDy: 0,
      lastTime: Date.now(),
      wasExpanded: mobileExpanded,
      active: false,
    };
  };

  // Allow smooth pull-down-to-close when Queue / Lyrics scroll container is at scrollTop === 0
  const handleScrollAreaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mobileExpanded) return;
    if (e.currentTarget.scrollTop > 2) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button[data-no-drag]')) return;
    e.stopPropagation();
    drawerDragRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      lastDy: 0,
      lastTime: Date.now(),
      wasExpanded: true,
      fromScrollTop: true,
      scrollEl: e.currentTarget,
      active: false,
    };
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
      onPointerCancel={resetSheetDrag}
      style={{
        transform: sheetTransform,
        opacity: sheetOpacity,
      }}
      className={`fixed inset-0 z-50 bg-[#090b10] flex flex-col overflow-hidden will-change-transform ${
        isDraggingSheet
          ? 'transition-none'
          : 'transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
      } ${!isVisible ? 'pointer-events-none' : ''}`}
    >
      {/* Mobile Full-Bleed Edge-to-Edge Artwork Hero + Seamless Album-Synced Lower Background */}
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
              background: `linear-gradient(to bottom, transparent 14dvh, ${activeTint.deepSurface} 54dvh, ${activeTint.deepSurface} 100%)`,
            }}
            className="absolute inset-0 transition-[background] duration-300"
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
              style={
                shuffle
                  ? {
                      backgroundColor: activeTint.cardBg,
                      borderColor: activeTint.cardBorder,
                      color: activeTint.subtextColor,
                    }
                  : undefined
              }
              className={`rv-interactive-btn w-11 h-11 rounded-2xl border flex items-center justify-center ${
                shuffle
                  ? 'shadow-sm'
                  : 'border-transparent bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.75)] hover:text-[#f4f5f7]'
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
              style={
                repeatMode !== 'off'
                  ? {
                      backgroundColor: activeTint.cardBg,
                      borderColor: activeTint.cardBorder,
                      color: activeTint.subtextColor,
                    }
                  : undefined
              }
              className={`rv-interactive-btn w-11 h-11 rounded-2xl border flex items-center justify-center ${
                repeatMode !== 'off'
                  ? 'shadow-sm'
                  : 'border-transparent bg-[rgba(255,255,255,0.06)] text-[rgba(244,245,247,0.75)] hover:text-[#f4f5f7]'
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

        {/* Mobile Bottom Action Bar (Queue · Sleep Timer · Lyrics — album-synced seamless backdrop) */}
        <div
          data-no-sheet-drag
          data-testid="mobile-peek-bar"
          onPointerDown={handleDrawerPointerDown}
          onPointerCancel={resetDrawerDrag}
          style={{
            paddingBottom: 'max(14px, var(--rv-safe-bottom))',
            backgroundColor: activeTint.deepSurface,
            transform: !mobileExpanded && isDraggingDrawer && drawerDragY < 0
              ? `translate3d(0, ${drawerDragY * 0.35}px, 0)`
              : undefined,
          }}
          className={`md:hidden touch-none shrink-0 relative px-7 pt-2 flex items-center justify-between ${
            isDraggingDrawer
              ? 'transition-none'
              : 'transition-[transform,background-color,opacity] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
          } ${
            mobileExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setTab('queue');
              setShowBottomSleepMenu(false);
              setMobileExpanded(true);
            }}
            className="rv-interactive-btn min-h-[44px] px-2.5 rounded-xl inline-flex items-center gap-2 text-[14px] font-medium text-[rgba(244,245,247,0.84)] hover:text-white"
          >
            <ListMusic className="w-[18px] h-[18px]" aria-hidden="true" />
            <span>Queue</span>
          </button>

          <div className="relative flex items-center justify-center">
            <button
              type="button"
              aria-label="Sleep timer"
              aria-expanded={showBottomSleepMenu}
              onClick={() => setShowBottomSleepMenu((v) => !v)}
              style={
                sleepTimerMode !== 'off'
                  ? { color: activeTint.subtextColor }
                  : undefined
              }
              className={`rv-interactive-btn min-h-[44px] px-3 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors ${
                sleepTimerMode !== 'off'
                  ? ''
                  : 'text-[rgba(244,245,247,0.84)] hover:text-white'
              }`}
            >
              <Moon
                className={`w-[18px] h-[18px] ${sleepTimerMode !== 'off' ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
              {sleepTimerMode !== 'off' ? (
                <span className="text-xs font-semibold tabular-nums">{sleepTimerMode}</span>
              ) : null}
            </button>

            {showBottomSleepMenu ? (
              <>
                <div
                  aria-hidden="true"
                  onClick={() => setShowBottomSleepMenu(false)}
                  className="fixed inset-0 z-40"
                />
                <div
                  role="group"
                  aria-label="Sleep timer options"
                  style={{
                    backgroundColor: activeTint.drawerSurface,
                    borderColor: activeTint.cardBorder,
                  }}
                  className="rv-pop-in absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-52 p-2 rounded-2xl border backdrop-blur-xl shadow-[0_18px_42px_rgba(0,0,0,0.62)] space-y-1.5"
                >
                  <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[rgba(244,245,247,0.62)] text-center">
                    Sleep Timer
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {SLEEP_OPTIONS.map(({ mode, label }) => {
                      const selected = sleepTimerMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSleepTimer(mode);
                            setShowBottomSleepMenu(false);
                          }}
                          style={
                            selected
                              ? {
                                  backgroundColor: activeTint.cardBg,
                                  borderColor: activeTint.cardBorder,
                                  color: activeTint.subtextColor,
                                }
                              : undefined
                          }
                          className={`py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                            selected
                              ? 'shadow-sm'
                              : 'border-transparent bg-[rgba(255,255,255,0.08)] text-[rgba(244,245,247,0.78)] hover:text-white'
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

          <button
            type="button"
            onClick={() => {
              setTab('lyrics');
              setShowBottomSleepMenu(false);
              setMobileExpanded(true);
            }}
            className="rv-interactive-btn min-h-[44px] px-2.5 rounded-xl inline-flex items-center gap-2 text-[14px] font-medium text-[rgba(244,245,247,0.84)] hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-[18px] h-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="5" y1="10" x2="19" y2="10" />
              <line x1="7" y1="14" x2="17" y2="14" />
              <line x1="9.5" y1="18" x2="14.5" y2="18" />
            </svg>
            <span>Lyrics</span>
          </button>
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
          className={`flex flex-col border overflow-hidden will-change-transform max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[max(56px,var(--rv-safe-top))] max-md:z-40 max-md:rounded-t-[28px] max-md:border-t max-md:shadow-[0_-16px_44px_rgba(0,0,0,0.65)] md:static md:h-[min(520px,calc(100dvh-104px))] md:rounded-2xl md:backdrop-blur-2xl ${
            isDraggingDrawer
              ? 'transition-none'
              : 'transition-[transform,opacity,background-color,border-color] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
          } ${
            mobileExpanded
              ? 'max-md:translate-y-0 max-md:opacity-100'
              : 'max-md:translate-y-full max-md:opacity-0 max-md:pointer-events-none'
          }`}
        >
          {/* Full Top Draggable Zone (Grab Handle + Tab Bar — slide down from anywhere here to close) */}
          <div
            onPointerDown={handleDrawerPointerDown}
            onPointerCancel={resetDrawerDrag}
            onClickCapture={(e) => {
              if (suppressDrawerClickRef.current) {
                e.stopPropagation();
                e.preventDefault();
                suppressDrawerClickRef.current = false;
              }
            }}
            className="md:cursor-default touch-none select-none cursor-grab active:cursor-grabbing"
          >
            <div className="md:hidden pt-2.5 pb-1 flex justify-center">
              {mobileExpanded ? (
                <button
                  type="button"
                  aria-label="Collapse queue and lyrics panel"
                  onClick={() => setMobileExpanded(false)}
                  className="px-8 py-1 rounded-full flex items-center justify-center group"
                >
                  <span className="w-9 h-1 rounded-full bg-[rgba(255,255,255,0.32)] group-hover:bg-[rgba(255,255,255,0.55)]" />
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-200 ${
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
          </div>

          {/* Persistent Queue Container + Studio Fade Lyrics Body (supports pull-down at scrollTop=0) */}
          <div
            data-queue-scroll-container
            onPointerDown={handleScrollAreaPointerDown}
            onPointerCancel={resetDrawerDrag}
            className="flex-1 overflow-y-auto overscroll-y-contain rv-scroll p-3"
          >
            <div className={tab === 'queue' ? 'block rv-tab-enter' : 'hidden'}>
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
