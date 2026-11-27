import { useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, Play, Sparkles, UserRound, X } from 'lucide-react';
import { useOverlay } from '../context/overlayStore';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useAnimatedOverlay } from '../hooks/useAnimatedOverlay';
import { fetchArtistProfile, type ArtistProfileInfo } from '../services/musicApis';
import { splitArtistNames } from '../utils/formatTime';
import { SEED_TRACKS } from '../services/seedCatalog';
import { TrackRow } from './TrackRow';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

export function ArtistInfoModal() {
  const { artistInfo, closeArtistInfo } = useOverlay();
  const {
    apiVault,
    catalog,
    tasteProfile,
    playlists,
    toggleLike,
    addTrackToPlaylist,
  } = useLibrary();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    addToQueue,
    playNext,
    startTrackRadio,
  } = usePlayer();

  const lastInfoRef = useRef(artistInfo);
  if (artistInfo) {
    lastInfoRef.current = artistInfo;
  }

  const isOpen = Boolean(artistInfo);
  const { shouldRender, isVisible } = useAnimatedOverlay(isOpen, 250);

  const artists = useMemo(
    () => splitArtistNames(artistInfo?.artistQuery ?? lastInfoRef.current?.artistQuery ?? ''),
    [artistInfo],
  );
  const [selectedArtist, setSelectedArtist] = useState<string>(artists[0] ?? '');
  const [profile, setProfile] = useState<ArtistProfileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (artists.length > 0) {
      setSelectedArtist(artists[0]!);
    }
  }, [artistInfo, artists]);

  useEffect(() => {
    if (!isOpen || !selectedArtist) return;
    let active = true;
    setIsLoading(true);
    fetchArtistProfile(selectedArtist, apiVault, catalog)
      .then((res) => {
        if (active) setProfile(res);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, selectedArtist, apiVault, catalog]);

  if (!shouldRender) return null;
  const activeTarget = artistInfo ?? lastInfoRef.current;
  if (!activeTarget) return null;

  const fallbackArt = activeTarget.seedTrack?.artworkUrl || FALLBACK_ART;
  const heroArt = profile?.artworkUrl || fallbackArt;
  const topTracks = profile?.topTracks ?? [];

  return (
    <div
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      aria-label={`Artist information for ${selectedArtist || activeTarget.artistQuery}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          closeArtistInfo();
        }
      }}
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 transition-opacity duration-250 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="fixed inset-0 bg-[rgba(4,6,10,0.75)] backdrop-blur-md"
        onClick={closeArtistInfo}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full sm:max-w-xl h-[86dvh] sm:h-auto sm:max-h-[84dvh] rounded-t-[28px] sm:rounded-2xl bg-[#0d1017] border-t sm:border border-[rgba(255,255,255,0.12)] flex flex-col overflow-hidden shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-4 sm:scale-95'
        }`}
        style={{ paddingBottom: 'var(--rv-safe-bottom)' }}
      >
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserRound className="w-4 h-4 text-[#a5b4fc] shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#f4f5f7] truncate">Know About Artist</h2>
          </div>

          <button
            type="button"
            aria-label="Close artist info"
            onClick={closeArtistInfo}
            className="rv-interactive-btn w-9 h-9 rounded-xl bg-[#161b26] hover:bg-[#1f2636] flex items-center justify-center text-[#f4f5f7] shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Multi-Artist Collaboration Pills */}
        {artists.length > 1 ? (
          <div
            role="tablist"
            aria-label="Featured artists"
            className="px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2 overflow-x-auto no-scrollbar bg-[#0b0e14]"
          >
            {artists.map((name) => {
              const selected = name === selectedArtist;
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedArtist(name)}
                  className={`rv-interactive-btn shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    selected
                      ? 'bg-[#22d3a6] text-[#042019] border-[#22d3a6]'
                      : 'bg-[#161b26] text-[rgba(244,245,247,0.75)] border-[rgba(255,255,255,0.1)] hover:text-[#f4f5f7]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto rv-scroll p-5 space-y-5">
          {/* Artist Hero Card */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#121622] border border-[rgba(255,255,255,0.08)]">
            <img
              src={heroArt}
              alt={selectedArtist}
              className="w-20 h-20 rounded-xl object-cover bg-[#181d29] shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#22d3a6] truncate">
                {profile?.subtitle || 'Artist'}
              </div>
              <h3 className="text-lg font-bold text-[#f4f5f7] truncate">{selectedArtist}</h3>
              {profile?.genres && profile.genres.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {profile.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.07)] text-[10px] font-medium text-[rgba(244,245,247,0.78)]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Bio Summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[rgba(244,245,247,0.52)]">
              About
            </h4>
            {isLoading && !profile ? (
              <div className="space-y-2" aria-busy="true">
                <div className="h-3.5 rounded bg-[#161b26] animate-pulse w-11/12" />
                <div className="h-3.5 rounded bg-[#161b26] animate-pulse w-4/5" />
                <div className="h-3.5 rounded bg-[#161b26] animate-pulse w-2/3" />
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-[rgba(244,245,247,0.84)] text-pretty">
                {profile?.bio || `Discover top songs and similar tracks for ${selectedArtist}.`}
              </p>
            )}
          </div>

          {/* Top & Related Tracks */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[rgba(244,245,247,0.52)] flex items-center gap-1.5">
                <Disc3 className="w-3.5 h-3.5 text-[#22d3a6]" aria-hidden="true" />
                Top & Related Tracks ({topTracks.length})
              </h4>
              {topTracks.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void playTrack(topTracks[0]!, topTracks, { appendSimilar: true })}
                    className="rv-interactive-btn px-2.5 py-1 rounded-lg bg-[#22d3a6] text-[#042019] text-[11px] font-bold inline-flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => void startTrackRadio(topTracks[0]!)}
                    className="rv-interactive-btn px-2.5 py-1 rounded-lg bg-[#161b26] border border-[rgba(255,255,255,0.1)] text-[11px] font-semibold text-[#f4f5f7] inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-[#22d3a6]" aria-hidden="true" />
                    Radio
                  </button>
                </div>
              ) : null}
            </div>

            {isLoading && topTracks.length === 0 ? (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-[#11151e] animate-pulse" />
                ))}
              </div>
            ) : topTracks.length === 0 ? (
              <div className="py-8 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#10131b] text-center text-xs text-[rgba(244,245,247,0.55)]">
                No tracks found for {selectedArtist} right now.
              </div>
            ) : (
              <ul role="list" className="space-y-1">
                {topTracks.map((track, idx) => (
                  <TrackRow
                    key={`artist-${track.id}-${idx}`}
                    track={track}
                    index={idx}
                    compact
                    isActive={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    isLiked={tasteProfile.likedTrackIds.includes(track.id)}
                    playlists={playlists}
                    onPlay={(t) => void playTrack(t, topTracks, { appendSimilar: true })}
                    onAddToQueue={addToQueue}
                    onPlayNext={playNext}
                    onToggleLike={toggleLike}
                    onStartRadio={(t) => void startTrackRadio(t)}
                    onAddToPlaylist={addTrackToPlaylist}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
