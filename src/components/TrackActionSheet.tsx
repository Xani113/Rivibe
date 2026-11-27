import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderPlus,
  ListEnd,
  ListPlus,
  Play,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { useOverlay } from '../context/overlayStore';
import { useAnimatedOverlay } from '../hooks/useAnimatedOverlay';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

export function TrackActionSheet() {
  const { trackMenu, closeTrackMenu, openArtistInfo } = useOverlay();
  const {
    queue,
    playTrack,
    playQueueIndex,
    playNext,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    startTrackRadio,
  } = usePlayer();
  const { playlists, addTrackToPlaylist } = useLibrary();

  const [showPlaylists, setShowPlaylists] = useState(false);
  const activeTargetRef = useRef(trackMenu);
  if (trackMenu) {
    activeTargetRef.current = trackMenu;
  }

  const isOpen = Boolean(trackMenu);
  const { shouldRender, isVisible } = useAnimatedOverlay(isOpen, 220);

  useEffect(() => {
    setShowPlaylists(false);
  }, [trackMenu]);

  if (!shouldRender) return null;
  const target = trackMenu ?? activeTargetRef.current;
  if (!target) return null;

  const { track, queueIndex, onPlayOverride, onRemoveFromPlaylist } = target;
  const matchedQueueIndex =
    typeof queueIndex === 'number' && queue[queueIndex]?.id === track.id
      ? queueIndex
      : queue.findIndex((item) => item.id === track.id);
  const inQueue = matchedQueueIndex >= 0;

  const handlePlayNow = () => {
    if (typeof queueIndex === 'number' && inQueue) {
      void playQueueIndex(matchedQueueIndex);
    } else if (onPlayOverride) {
      onPlayOverride(track);
    } else {
      void playTrack(track, undefined, { appendSimilar: true });
    }
    closeTrackMenu();
  };

  return (
    <div
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      aria-label={`Actions for ${track.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          closeTrackMenu();
        }
      }}
      className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="fixed inset-0 bg-[rgba(4,6,10,0.68)] backdrop-blur-sm"
        onClick={closeTrackMenu}
        aria-hidden="true"
      />

      <div
        role="menu"
        aria-label={`Track actions for ${track.title}`}
        className={`relative z-10 w-full sm:max-w-sm rounded-t-[26px] sm:rounded-2xl bg-[#0e121b] border-t sm:border border-[rgba(255,255,255,0.12)] shadow-2xl overflow-hidden transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-3 sm:scale-95'
        }`}
        style={{ paddingBottom: 'max(10px, var(--rv-safe-bottom))' }}
      >
        {/* Drag Handle (Mobile) */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <span className="w-9 h-1 rounded-full bg-[rgba(255,255,255,0.24)]" />
        </div>

        {/* Selected Track Header */}
        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] flex items-center gap-3">
          <img
            src={track.artworkUrl || FALLBACK_ART}
            alt=""
            className="w-11 h-11 rounded-lg object-cover bg-[#181d29] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#f4f5f7] truncate">{track.title}</div>
            <div className="text-xs text-[rgba(244,245,247,0.62)] truncate">
              {track.artist} · {formatDuration(track.durationSec)}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close track menu"
            onClick={closeTrackMenu}
            className="rv-interactive-btn w-9 h-9 rounded-xl bg-[rgba(255,255,255,0.07)] flex items-center justify-center text-[rgba(244,245,247,0.75)] shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Action List */}
        <div className="p-2 max-h-[65dvh] overflow-y-auto rv-scroll space-y-0.5">
          <button
            type="button"
            role="menuitem"
            onClick={handlePlayNow}
            className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.07)] flex items-center gap-3 text-left"
          >
            <Play className="w-4 h-4 text-[#22d3a6]" aria-hidden="true" />
            <span>Play Now</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              playNext(track);
              closeTrackMenu();
            }}
            className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.07)] flex items-center gap-3 text-left"
          >
            <ListPlus className="w-4 h-4 text-[#22d3a6]" aria-hidden="true" />
            <span>Play Next</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              addToQueue(track);
              closeTrackMenu();
            }}
            className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.07)] flex items-center gap-3 text-left"
          >
            <ListEnd className="w-4 h-4 text-[#22d3a6]" aria-hidden="true" />
            <span>Add to Queue</span>
          </button>

          {inQueue ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                removeFromQueue(matchedQueueIndex);
                closeTrackMenu();
              }}
              className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f87171] hover:bg-[rgba(248,113,113,0.12)] flex items-center gap-3 text-left"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Remove from Queue</span>
            </button>
          ) : null}

          {typeof queueIndex === 'number' && inQueue ? (
            <div className="flex gap-1 px-1 py-0.5">
              <button
                type="button"
                role="menuitem"
                disabled={matchedQueueIndex === 0}
                onClick={() => {
                  moveQueueItem(matchedQueueIndex, matchedQueueIndex - 1);
                  closeTrackMenu();
                }}
                className="rv-interactive-btn flex-1 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.09)] disabled:opacity-35 text-xs font-medium text-[#f4f5f7] flex items-center justify-center gap-1.5"
              >
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                Move Up
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={matchedQueueIndex >= queue.length - 1}
                onClick={() => {
                  moveQueueItem(matchedQueueIndex, matchedQueueIndex + 1);
                  closeTrackMenu();
                }}
                className="rv-interactive-btn flex-1 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.09)] disabled:opacity-35 text-xs font-medium text-[#f4f5f7] flex items-center justify-center gap-1.5"
              >
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                Move Down
              </button>
            </div>
          ) : null}

          <div className="my-1 border-t border-[rgba(255,255,255,0.08)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => openArtistInfo(track.artist, track)}
            className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.07)] flex items-center gap-3 text-left"
          >
            <UserRound className="w-4 h-4 text-[#a5b4fc]" aria-hidden="true" />
            <span>Know About Artist</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void startTrackRadio(track);
              closeTrackMenu();
            }}
            className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.07)] flex items-center gap-3 text-left"
          >
            <Sparkles className="w-4 h-4 text-[#22d3a6]" aria-hidden="true" />
            <span>Start Song Radio</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPlaylists((v) => !v)}
            className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.07)] flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-3">
              <FolderPlus className="w-4 h-4 text-[rgba(244,245,247,0.72)]" aria-hidden="true" />
              <span>Add to Playlist</span>
            </span>
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-150 ${showPlaylists ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>

          {showPlaylists ? (
            <div className="pl-3 pr-1 py-1 space-y-1 max-h-40 overflow-y-auto rv-scroll">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    addTrackToPlaylist(pl.id, track);
                    closeTrackMenu();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[rgba(244,245,247,0.88)] hover:bg-[rgba(34,211,166,0.16)] hover:text-[#22d3a6] text-left truncate"
                >
                  {pl.name}
                </button>
              ))}
            </div>
          ) : null}

          {onRemoveFromPlaylist ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRemoveFromPlaylist(track.id);
                closeTrackMenu();
              }}
              className="rv-interactive-btn w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#f87171] hover:bg-[rgba(248,113,113,0.12)] flex items-center gap-3 text-left"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Remove from Playlist</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
