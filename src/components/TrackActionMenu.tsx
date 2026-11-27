import { MoreVertical } from 'lucide-react';
import type { Playlist, Track } from '../types/music';
import { useOptionalOverlay } from '../context/overlayStore';

interface TrackActionMenuProps {
  track: Track;
  playlists: Playlist[];
  queueIndex?: number;
  onPlay: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export function TrackActionMenu({
  track,
  queueIndex,
  onPlay,
  onRemoveFromPlaylist,
}: TrackActionMenuProps) {
  const overlay = useOptionalOverlay();

  return (
    <button
      type="button"
      aria-label={`More options for ${track.title}`}
      onClick={(e) => {
        e.stopPropagation();
        overlay?.openTrackMenu({
          track,
          queueIndex,
          onPlayOverride: onPlay,
          onRemoveFromPlaylist,
        });
      }}
      className="rv-interactive-btn w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.09)] flex items-center justify-center text-[rgba(244,245,247,0.68)] hover:text-[#f4f5f7]"
    >
      <MoreVertical className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
