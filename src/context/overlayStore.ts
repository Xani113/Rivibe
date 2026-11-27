import { createContext, useContext } from 'react';
import type { Track } from '../types/music';

export interface TrackMenuTarget {
  track: Track;
  queueIndex?: number;
  onPlayOverride?: (track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export interface ArtistInfoTarget {
  artistQuery: string;
  seedTrack?: Track;
}

export interface OverlayContextValue {
  trackMenu: TrackMenuTarget | null;
  artistInfo: ArtistInfoTarget | null;
  openTrackMenu: (target: TrackMenuTarget) => void;
  closeTrackMenu: () => void;
  openArtistInfo: (artistQuery: string, seedTrack?: Track) => void;
  closeArtistInfo: () => void;
}

export const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOptionalOverlay(): OverlayContextValue | null {
  return useContext(OverlayContext);
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
}
