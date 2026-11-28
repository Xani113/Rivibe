import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, MoreVertical, Play } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useOverlay } from '../context/overlayStore';
import { formatDuration, formatTotalDuration } from '../utils/formatTime';
import { useTrackTint } from '../utils/dominantColor';
import { ArtworkImage } from './ArtworkImage';

interface QueueListProps {
  showSummaryHeader?: boolean;
  emptyMessage?: string;
  isActive?: boolean;
}

export function QueueList({
  showSummaryHeader = true,
  emptyMessage = 'Tap + queue or Play on any song to build your queue.',
  isActive = true,
}: QueueListProps) {
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    currentTime,
    duration,
    infiniteRadio,
    playQueueIndex,
    moveQueueItem,
  } = usePlayer();
  const { openTrackMenu } = useOverlay();

  const rootRef = useRef<HTMLDivElement>(null);
  const activeTrack = queue[queueIndex] ?? currentTrack;
  const activeTint = useTrackTint(activeTrack);

  // Align scroll synchronously before paint so opening Queue always starts on Playing Now + Next Queue sequence
  useLayoutEffect(() => {
    if (!isActive) return;
    const root = rootRef.current;
    if (!root) return;
    const scrollContainer = root.closest('[data-queue-scroll-container]') as HTMLElement | null;
    const activeRow = root.querySelector<HTMLElement>('[data-current="true"]');
    if (scrollContainer && activeRow) {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      const rowTop = activeRow.getBoundingClientRect().top;
      const targetTop = scrollContainer.scrollTop + (rowTop - containerTop) - 6;
      scrollContainer.scrollTop = Math.max(0, targetTop);
    }
  }, [isActive, queueIndex]);

  // Subtle collapse spacer when an item is removed so count updates immediately while visual space collapses smoothly
  const prevLenRef = useRef(queue.length);
  const [collapsingPulse, setCollapsingPulse] = useState(false);

  useEffect(() => {
    if (queue.length < prevLenRef.current) {
      setCollapsingPulse(true);
      const t = window.setTimeout(() => setCollapsingPulse(false), 180);
      prevLenRef.current = queue.length;
      return () => window.clearTimeout(t);
    }
    prevLenRef.current = queue.length;
  }, [queue.length]);

  const remainingDurationSec = useMemo(() => {
    if (queue.length === 0) return 0;
    const startIdx = Math.max(0, queueIndex);
    let total = 0;
    for (let i = startIdx; i < queue.length; i++) {
      const item = queue[i]!;
      if (i === queueIndex) {
        const activeDur = duration > 0 ? duration : item.durationSec || 0;
        total += Math.max(0, activeDur - currentTime);
      } else {
        total += item.durationSec || 0;
      }
    }
    return total;
  }, [queue, queueIndex, currentTime, duration]);

  // Smooth touch/pointer drag-to-reorder exclusively bound to each row's grip handle
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStateRef = useRef<{
    idx: number;
    startY: number;
    rowHeight: number;
  } | null>(null);

  useEffect(() => {
    if (dragIdx === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      setDragOffsetY(dy);

      const stepThreshold = Math.max(44, drag.rowHeight * 0.72);
      if (dy > stepThreshold && drag.idx < queue.length - 1) {
        const nextIdx = drag.idx + 1;
        moveQueueItem(drag.idx, nextIdx);
        drag.idx = nextIdx;
        drag.startY += drag.rowHeight;
        setDragIdx(nextIdx);
        setDragOffsetY(e.clientY - drag.startY);
      } else if (dy < -stepThreshold && drag.idx > 0) {
        const nextIdx = drag.idx - 1;
        moveQueueItem(drag.idx, nextIdx);
        drag.idx = nextIdx;
        drag.startY -= drag.rowHeight;
        setDragIdx(nextIdx);
        setDragOffsetY(e.clientY - drag.startY);
      }
    };

    const stopDrag = () => {
      dragStateRef.current = null;
      setDragIdx(null);
      setDragOffsetY(0);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, [dragIdx, moveQueueItem, queue.length]);

  const handleGripPointerDown = (idx: number, e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rowEl = e.currentTarget.closest('li');
    const rowHeight = rowEl ? rowEl.getBoundingClientRect().height + 6 : 64;
    dragStateRef.current = { idx, startY: e.clientY, rowHeight };
    setDragIdx(idx);
    setDragOffsetY(0);
  };

  if (queue.length === 0) {
    return (
      <div ref={rootRef} className="py-14 px-4 text-center space-y-1.5">
        <p className="text-sm font-semibold text-[#f4f5f7]">Queue is empty</p>
        <p className="text-xs text-[rgba(244,245,247,0.52)]">{emptyMessage}</p>
      </div>
    );
  }

  const upcomingTotal = Math.max(0, queue.length - 1 - queueIndex);

  return (
    <div ref={rootRef} className="space-y-2.5">
      {showSummaryHeader ? (
        <div className="px-1.5 pb-1 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[rgba(244,245,247,0.72)] truncate">
            {infiniteRadio ? 'Autoplaying similar music' : 'Up next in queue'}
          </span>
          <span
            data-testid="queue-total-duration"
            className="font-semibold text-[#f4f5f7] tabular-nums shrink-0"
          >
            {formatTotalDuration(remainingDurationSec)}
          </span>
        </div>
      ) : null}

      <ul
        role="list"
        className={`space-y-1.5 transition-[opacity] duration-150 ${
          collapsingPulse ? 'opacity-95' : 'opacity-100'
        }`}
      >
        {queue.map((item, idx) => {
          const isCurrent = idx === queueIndex;
          const isFirstUpcoming = idx === queueIndex + 1 && upcomingTotal > 0;
          const upcomingOrder = idx > queueIndex ? idx - queueIndex : null;
          const isDragging = dragIdx === idx;
          const eagerArt = Math.abs(idx - queueIndex) <= 10;

          return (
            <li
              key={`${item.id}-${idx}`}
              data-current={isCurrent}
              className="space-y-1.5"
            >
              {isFirstUpcoming ? (
                <div className="px-2 pt-2 pb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[#a78bfa]">
                  <span>Next in Queue</span>
                  <span className="tabular-nums text-[rgba(244,245,247,0.52)]">
                    {upcomingTotal} upcoming
                  </span>
                </div>
              ) : null}

              <div
                style={{
                  backgroundColor: isCurrent ? activeTint.cardBg : undefined,
                  borderColor: isCurrent ? activeTint.cardBorder : undefined,
                  transform: isDragging ? `translate3d(0, ${dragOffsetY}px, 0) scale(1.015)` : undefined,
                }}
                className={`relative flex items-center gap-2 px-2 py-2 rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200 ${
                  isCurrent
                    ? 'shadow-lg'
                    : 'border-transparent hover:bg-[rgba(255,255,255,0.05)]'
                } ${isDragging ? 'z-20 shadow-2xl ring-1 ring-[rgba(255,255,255,0.22)]' : ''}`}
              >
                {/* Drag Handle + Sequence Indicator */}
                <button
                  type="button"
                  aria-label={`Reorder ${item.title} in queue`}
                  onPointerDown={(e) => handleGripPointerDown(idx, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' && idx > 0) {
                      e.preventDefault();
                      moveQueueItem(idx, idx - 1);
                    } else if (e.key === 'ArrowDown' && idx < queue.length - 1) {
                      e.preventDefault();
                      moveQueueItem(idx, idx + 1);
                    }
                  }}
                  className="touch-none w-6 h-10 rounded-lg flex items-center justify-center text-[rgba(244,245,247,0.34)] hover:text-[rgba(244,245,247,0.75)] cursor-grab active:cursor-grabbing shrink-0"
                >
                  {upcomingOrder !== null ? (
                    <span className="text-[11px] font-semibold tabular-nums text-[rgba(244,245,247,0.45)]">
                      {upcomingOrder}
                    </span>
                  ) : (
                    <GripVertical className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>

                {/* Clickable Artwork + Metadata */}
                <button
                  type="button"
                  aria-label={`Play ${item.title} from queue`}
                  onClick={() => void playQueueIndex(idx)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-xl"
                >
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#161b26]">
                    <ArtworkImage
                      src={item.artworkUrl}
                      youtubeVideoId={item.youtubeVideoId}
                      loading={eagerArt ? 'eager' : 'lazy'}
                      priority={isCurrent ? 'high' : undefined}
                      className="w-full h-full object-cover"
                    />
                    {isCurrent ? (
                      <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        {isPlaying ? (
                          <span className="inline-flex items-end gap-0.5 h-3.5" aria-hidden="true">
                            <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                            <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                            <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                          </span>
                        ) : (
                          <Play className="w-4 h-4 text-white fill-current ml-0.5" aria-hidden="true" />
                        )}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold truncate text-[#f4f5f7]">
                      {item.title}
                    </div>
                    <div
                      style={isCurrent ? { color: activeTint.subtextColor } : undefined}
                      className={`text-xs truncate mt-0.5 tabular-nums ${
                        isCurrent ? 'font-medium' : 'text-[rgba(244,245,247,0.58)]'
                      }`}
                    >
                      {item.artist} • {formatDuration(item.durationSec)}
                    </div>
                  </div>
                </button>

                {/* Single Clean 3-Dot Action Sheet Trigger */}
                <button
                  type="button"
                  aria-label={`More options for ${item.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openTrackMenu({ track: item, queueIndex: idx });
                  }}
                  className="rv-interactive-btn w-9 h-9 rounded-xl hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[rgba(244,245,247,0.82)] hover:text-[#f4f5f7] shrink-0"
                >
                  <MoreVertical className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
