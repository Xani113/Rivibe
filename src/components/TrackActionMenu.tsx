import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  FolderPlus,
  ListEnd,
  ListPlus,
  MoreVertical,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Playlist, Track } from '../types/music';

interface TrackActionMenuProps {
  track: Track;
  playlists: Playlist[];
  onPlay: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export function TrackActionMenu({
  track,
  playlists,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onStartRadio,
  onAddToPlaylist,
  onRemoveFromPlaylist,
}: TrackActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowPlaylists(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowPlaylists(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setShowPlaylists(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={`More options for ${track.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => !v);
          setShowPlaylists(false);
        }}
        className="rv-interactive-btn w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.09)] flex items-center justify-center text-[rgba(244,245,247,0.65)] hover:text-[#f4f5f7]"
      >
        <MoreVertical className="w-4 h-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${track.title}`}
          className="absolute right-0 top-9 z-40 w-52 p-1.5 rounded-xl rv-glass-overlay border shadow-2xl space-y-0.5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onPlay(track);
              closeMenu();
            }}
            className="w-full px-2.5 py-2 rounded-lg text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.09)] flex items-center gap-2.5 text-left"
          >
            <Play className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
            Play Now
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onPlayNext(track);
              closeMenu();
            }}
            className="w-full px-2.5 py-2 rounded-lg text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.09)] flex items-center gap-2.5 text-left"
          >
            <ListPlus className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
            Play Next
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAddToQueue(track);
              closeMenu();
            }}
            className="w-full px-2.5 py-2 rounded-lg text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.09)] flex items-center gap-2.5 text-left"
          >
            <ListEnd className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
            Add to Queue
          </button>

          {onStartRadio ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onStartRadio(track);
                closeMenu();
              }}
              className="w-full px-2.5 py-2 rounded-lg text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.09)] flex items-center gap-2.5 text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#a5b4fc]" aria-hidden="true" />
              Start Song Radio
            </button>
          ) : null}

          <div className="my-1 border-t border-[rgba(255,255,255,0.08)]" />

          <button
            type="button"
            onClick={() => setShowPlaylists((v) => !v)}
            className="w-full px-2.5 py-2 rounded-lg text-xs font-medium text-[#f4f5f7] hover:bg-[rgba(255,255,255,0.09)] flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-2.5">
              <FolderPlus className="w-3.5 h-3.5 text-[rgba(244,245,247,0.7)]" aria-hidden="true" />
              Add to Playlist
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${showPlaylists ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>

          {showPlaylists ? (
            <div className="pl-2 pr-1 py-1 space-y-0.5 max-h-36 overflow-y-auto rv-scroll">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    onAddToPlaylist(pl.id, track);
                    closeMenu();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md text-[11px] text-[rgba(244,245,247,0.84)] hover:bg-[rgba(34,211,166,0.16)] hover:text-[#22d3a6] text-left truncate"
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
                closeMenu();
              }}
              className="w-full px-2.5 py-2 rounded-lg text-xs font-medium text-[#f87171] hover:bg-[rgba(248,113,113,0.12)] flex items-center gap-2.5 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Remove from Playlist
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
