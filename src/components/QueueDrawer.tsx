import { useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Infinity as InfinityIcon,
  ListMusic,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueueDrawer({ isOpen, onClose }: QueueDrawerProps) {
  const {
    queue,
    queueIndex,
    isPlaying,
    infiniteRadio,
    setInfiniteRadio,
    playQueueIndex,
    removeFromQueue,
    moveQueueItem,
    clearUpcomingQueue,
  } = usePlayer();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Playback queue"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 flex justify-end items-end md:items-stretch bg-[rgba(4,6,10,0.65)] backdrop-blur-sm"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full md:w-[400px] max-h-[82dvh] md:max-h-full bg-[#0d1017] border-t md:border-t-0 md:border-l border-[rgba(255,255,255,0.1)] rounded-t-2xl md:rounded-none flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ListMusic className="w-4 h-4 text-[#22d3a6] shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#f4f5f7]">Playback Queue</h2>
            <span className="px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[10px] font-semibold text-[rgba(244,245,247,0.75)] tabular-nums">
              {queue.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {queue.length > 1 ? (
              <button
                type="button"
                aria-label="Clear upcoming queue"
                onClick={clearUpcomingQueue}
                className="rv-interactive-btn px-2.5 py-1.5 rounded-lg bg-[#161b26] hover:bg-[rgba(248,113,113,0.14)] text-[11px] font-medium text-[rgba(244,245,247,0.75)] hover:text-[#f87171] inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
                Clear
              </button>
            ) : null}

            <button
              ref={closeRef}
              type="button"
              aria-label="Close playback queue"
              onClick={onClose}
              className="rv-interactive-btn w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.75)]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Autoplay Bar */}
        <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-2 bg-[#0b0e14]">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#f4f5f7]">Autoplay similar tracks</div>
            <div className="text-[11px] text-[rgba(244,245,247,0.5)] truncate">
              Refills queue automatically when finished
            </div>
          </div>
          <button
            type="button"
            aria-label="Toggle autoplay similar tracks"
            aria-pressed={infiniteRadio}
            onClick={() => setInfiniteRadio(!infiniteRadio)}
            className={`rv-interactive-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 border ${
              infiniteRadio
                ? 'bg-[rgba(34,211,166,0.16)] border-[rgba(34,211,166,0.4)] text-[#22d3a6]'
                : 'bg-[#161b26] border-[rgba(255,255,255,0.08)] text-[rgba(244,245,247,0.6)]'
            }`}
          >
            <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {infiniteRadio ? 'On' : 'Off'}
          </button>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto rv-scroll p-2.5">
          {queue.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-1.5">
              <p className="text-sm font-semibold text-[#f4f5f7]">Queue is empty</p>
              <p className="text-xs text-[rgba(244,245,247,0.52)]">
                Tap the + queue button on any song in Home, Search, or Library.
              </p>
            </div>
          ) : (
            <ul role="list" className="space-y-1">
              {queue.map((item, idx) => {
                const isCurrent = idx === queueIndex;
                return (
                  <li
                    key={`${item.id}-${idx}`}
                    data-current={isCurrent}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                      isCurrent
                        ? 'bg-[rgba(34,211,166,0.1)] border-[rgba(34,211,166,0.3)]'
                        : 'border-transparent hover:bg-[rgba(255,255,255,0.04)]'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`Play ${item.title} from queue`}
                      onClick={() => void playQueueIndex(idx)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#161b26]">
                        <img
                          src={item.artworkUrl || FALLBACK_ART}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {isCurrent && isPlaying ? (
                          <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                              <span className="w-0.5 h-full bg-[#22d3a6] rounded-full rv-eq-bar" />
                              <span className="w-0.5 h-full bg-[#22d3a6] rounded-full rv-eq-bar" />
                              <span className="w-0.5 h-full bg-[#22d3a6] rounded-full rv-eq-bar" />
                            </span>
                          </span>
                        ) : isCurrent ? (
                          <span className="absolute inset-0 bg-black/45 flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-[#22d3a6] fill-current" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isCurrent ? 'text-[#22d3a6]' : 'text-[#f4f5f7]'
                            }`}
                          >
                            {item.title}
                          </span>
                          {isCurrent ? (
                            <span className="px-1.5 py-0.2 rounded bg-[#22d3a6] text-[#042019] text-[9px] font-bold uppercase shrink-0">
                              Playing
                            </span>
                          ) : null}
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
                        className="w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.58)] disabled:opacity-25"
                      >
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        aria-label={`Move ${item.title} down in queue`}
                        disabled={idx === queue.length - 1}
                        onClick={() => moveQueueItem(idx, idx + 1)}
                        className="w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.58)] disabled:opacity-25"
                      >
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        aria-label={`Remove ${item.title} from queue`}
                        title="Remove from queue"
                        onClick={() => removeFromQueue(idx)}
                        className="w-7 h-7 rounded-md hover:bg-[rgba(248,113,113,0.16)] flex items-center justify-center text-[rgba(244,245,247,0.58)] hover:text-[#f87171]"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
