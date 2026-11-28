import { useEffect, useRef } from 'react';
import { Infinity as InfinityIcon, ListMusic, Trash2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAnimatedOverlay } from '../hooks/useAnimatedOverlay';
import { QueueList } from './QueueList';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueueDrawer({ isOpen, onClose }: QueueDrawerProps) {
  const { queue, infiniteRadio, setInfiniteRadio, clearUpcomingQueue } = usePlayer();
  const { shouldRender, isVisible } = useAnimatedOverlay(isOpen, 360);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      aria-label="Playback queue"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 flex justify-end items-end md:items-stretch transition-opacity duration-[360ms] ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="fixed inset-0 bg-[rgba(4,6,10,0.65)] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full md:w-[420px] max-h-[84dvh] md:max-h-full bg-[#0d1017] border-t md:border-t-0 md:border-l border-[rgba(255,255,255,0.1)] rounded-t-[26px] md:rounded-none flex flex-col overflow-hidden shadow-2xl will-change-transform transition-transform duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'
        }`}
        style={{ paddingBottom: 'var(--rv-safe-bottom)' }}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ListMusic className="w-4 h-4 text-[#a78bfa] shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#f4f5f7]">Up Next</h2>
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
              Keeps up to 50 similar tracks queued automatically
            </div>
          </div>
          <button
            type="button"
            aria-label="Toggle autoplay similar tracks"
            aria-pressed={infiniteRadio}
            onClick={() => setInfiniteRadio(!infiniteRadio)}
            className={`rv-interactive-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 border ${
              infiniteRadio
                ? 'bg-[rgba(124,92,255,0.18)] border-[rgba(167,139,250,0.45)] text-[#c4b5fd]'
                : 'bg-[#161b26] border-[rgba(255,255,255,0.08)] text-[rgba(244,245,247,0.6)]'
            }`}
          >
            <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {infiniteRadio ? 'On' : 'Off'}
          </button>
        </div>

        {/* Shared Up Next Queue List */}
        <div data-queue-scroll-container className="flex-1 overflow-y-auto rv-scroll p-3">
          <QueueList isActive={isOpen} />
        </div>
      </div>
    </div>
  );
}
