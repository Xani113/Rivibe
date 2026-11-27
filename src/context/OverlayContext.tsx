import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Track } from '../types/music';
import {
  OverlayContext,
  type ArtistInfoTarget,
  type OverlayContextValue,
  type TrackMenuTarget,
} from './overlayStore';

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [trackMenu, setTrackMenu] = useState<TrackMenuTarget | null>(null);
  const [artistInfo, setArtistInfo] = useState<ArtistInfoTarget | null>(null);

  const openTrackMenu = useCallback((target: TrackMenuTarget) => {
    setTrackMenu(target);
  }, []);

  const closeTrackMenu = useCallback(() => {
    setTrackMenu(null);
  }, []);

  const openArtistInfo = useCallback((artistQuery: string, seedTrack?: Track) => {
    setTrackMenu(null);
    setArtistInfo({ artistQuery, seedTrack });
  }, []);

  const closeArtistInfo = useCallback(() => {
    setArtistInfo(null);
  }, []);

  const value = useMemo<OverlayContextValue>(
    () => ({
      trackMenu,
      artistInfo,
      openTrackMenu,
      closeTrackMenu,
      openArtistInfo,
      closeArtistInfo,
    }),
    [trackMenu, artistInfo, openTrackMenu, closeTrackMenu, openArtistInfo, closeArtistInfo],
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}
