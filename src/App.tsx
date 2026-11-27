import { useMemo, useRef, useState } from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import type { CuratedMix, LibrarySection, RailSection, Track } from './types/music';
import { LeftRail } from './components/LeftRail';
import { LibrarySidebar } from './components/LibrarySidebar';
import { TopHeader } from './components/TopHeader';
import { CoverGrid } from './components/CoverGrid';
import { MadeForYouView } from './components/MadeForYouView';
import { TrackList } from './components/TrackList';
import { RadioView } from './components/RadioView';
import { FloatingPlayer } from './components/FloatingPlayer';
import { NowPlayingSheet } from './components/NowPlayingSheet';
import { ApiVaultModal } from './components/ApiVaultModal';
import { GetAppModal } from './components/GetAppModal';
import { AuthModal } from './components/AuthModal';
import { MobileDock } from './components/MobileDock';
import { YouTubeAudioBridge } from './components/YouTubeAudioBridge';
import { normalizeText } from './utils/formatTime';

function RiVibeWorkspace() {
  const {
    tasteProfile,
    apiVault,
    playlists,
    catalog,
    curatedMixes,
    recommendations,
    activeMood,
    setActiveMood,
    fullOnly,
    setFullOnly,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    isLoadingCatalog,
    radioStations,
    isLoadingRadio,
    cloudUser,
    backendOnline,
    loadRadio,
    toggleLike,
    recordSkip,
    createPlaylist,
    addTrackToPlaylist,
    updateDisplayName,
    updateApiVault,
    clearApiVault,
    runSurpriseVibe,
    signInCloud,
    signUpCloud,
    signOutCloud,
  } = useLibrary();

  const {
    currentTrack,
    currentRadioStation,
    activeYoutubeVideoId,
    youtubeSeekTarget,
    isPlaying,
    volume,
    isMuted,
    playTrack,
    startTrackRadio,
    playRadioStation,
    handleYoutubeProgress,
    handleYoutubeStateSync,
    handleYoutubeEnded,
    handleYoutubeError,
  } = usePlayer();

  const [railSection, setRailSection] = useState<RailSection>('browse');
  const [librarySection, setLibrarySection] = useState<LibrarySection>('all-playlists');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [apiVaultOpen, setApiVaultOpen] = useState(false);
  const [getAppOpen, setGetAppOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectRail = (section: RailSection) => {
    setRailSection(section);
    setActivePlaylistId(null);

    if (section === 'now-playing') {
      setNowPlayingOpen(true);
    } else if (section === 'browse') {
      setLibrarySection('all-playlists');
    } else if (section === 'songs') {
      setLibrarySection('songs');
    } else if (section === 'albums') {
      setLibrarySection('albums');
    } else if (section === 'search') {
      searchInputRef.current?.focus();
    }
  };

  const handleSelectLibrary = (section: LibrarySection) => {
    setLibrarySection(section);
    setActivePlaylistId(null);
    if (section === 'songs') setRailSection('songs');
    else if (section === 'albums') setRailSection('albums');
    else if (section === 'made-for-you') setRailSection('songs');
    else setRailSection('browse');
  };

  const handlePlayMix = (mix: CuratedMix) => {
    const tracks = mix.tracks.map((s) => s.track);
    if (tracks[0]) {
      void playTrack(tracks[0], tracks);
    }
  };

  const handleSkipTrack = (track: Track) => {
    recordSkip(track);
  };

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId],
  );

  const activePlaylistTracks = useMemo(() => {
    if (!activePlaylist) return [];
    const byId = new Map(catalog.map((t) => [t.id, t]));
    return activePlaylist.trackIds
      .map((id) => byId.get(id))
      .filter((t): t is Track => Boolean(t));
  }, [activePlaylist, catalog]);

  const artistGroups = useMemo(() => {
    const grouped = new Map<string, Track[]>();
    for (const track of catalog) {
      const key = track.artist;
      const list = grouped.get(key) ?? [];
      list.push(track);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries()).slice(0, 12);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (activeMood === 'all' || activeMood === 'for-you') return catalog;
    return catalog.filter((t) => t.moods.some((m) => normalizeText(m) === activeMood));
  }, [catalog, activeMood]);

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[#120e0b] text-[#fbf7f2]">
      {/* Warm Spatial Ambient Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 w-[460px] h-[460px] rounded-full bg-[rgba(168,122,74,0.28)] blur-[120px]" />
        <div className="absolute -bottom-28 right-0 w-[520px] h-[520px] rounded-full bg-[rgba(116,84,58,0.24)] blur-[130px]" />
      </div>

      {/* Main Spatial Stage */}
      <div className="rv-spatial-stage relative z-10 max-w-[1360px] mx-auto px-3 sm:px-6 pt-3 sm:pt-6 pb-36 md:pb-24 flex items-stretch gap-3 sm:gap-4 min-h-dvh">
        {/* Left Floating Glass Rail */}
        <LeftRail activeSection={railSection} onSelect={handleSelectRail} />

        {/* Main Frosted Spatial Window */}
        <div className="rv-window-glass rounded-[22px] sm:rounded-[28px] flex-1 min-w-0 w-full flex overflow-hidden min-h-[calc(100dvh-10rem)] md:min-h-[680px]">
          {/* Desktop / Tablet Library Sidebar */}
          <aside
            aria-label="Library sidebar"
            className="rv-desktop-sidebar hidden md:block w-[248px] shrink-0 rv-sidebar-glass"
          >
            <LibrarySidebar
              activeSection={librarySection}
              activePlaylistId={activePlaylistId}
              playlists={playlists}
              onSelectSection={handleSelectLibrary}
              onSelectPlaylist={(id) => {
                setActivePlaylistId(id);
                setRailSection('browse');
              }}
              onCreatePlaylist={(name) => createPlaylist(name, 'Created in RiVibe')}
              onOpenApiVault={() => setApiVaultOpen(true)}
            />
          </aside>

          {/* Mobile Slide-Over Library Drawer */}
          {mobileDrawerOpen ? (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobileDrawerOpen(false)}
              />
              <aside
                aria-label="Mobile library drawer"
                className="relative z-10 w-72 max-w-[82vw] h-full rv-window-glass rounded-r-[24px]"
              >
                <LibrarySidebar
                  activeSection={librarySection}
                  activePlaylistId={activePlaylistId}
                  playlists={playlists}
                  onSelectSection={handleSelectLibrary}
                  onSelectPlaylist={(id) => {
                    setActivePlaylistId(id);
                    setRailSection('browse');
                  }}
                  onCreatePlaylist={(name) => createPlaylist(name, 'Created in RiVibe')}
                  onOpenApiVault={() => {
                    setMobileDrawerOpen(false);
                    setApiVaultOpen(true);
                  }}
                  onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
                />
              </aside>
            </div>
          ) : null}

          {/* Main Content Pane */}
          <main className="flex-1 min-w-0 w-full flex flex-col p-3.5 sm:p-6 overflow-y-auto overflow-x-hidden rv-scroll">
            <TopHeader
              displayName={tasteProfile.displayName}
              mixCount={curatedMixes.length}
              trackCount={catalog.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeMood={activeMood}
              onMoodChange={setActiveMood}
              fullOnly={fullOnly}
              onToggleFullOnly={() => setFullOnly(!fullOnly)}
              cloudUser={cloudUser}
              backendOnline={backendOnline}
              onOpenAuth={() => setAuthModalOpen(true)}
              onUpdateDisplayName={updateDisplayName}
              onOpenApiVault={() => setApiVaultOpen(true)}
              onOpenGetApp={() => setGetAppOpen(true)}
              onOpenMobileMenu={() => setMobileDrawerOpen(true)}
              onSurpriseVibe={() => void runSurpriseVibe()}
              apiVault={apiVault}
              searchInputRef={searchInputRef}
            />

            <div className="mt-5 flex-1">
              {isSearchActive ? (
                <section aria-label="Search results" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#fbf7f2]">
                      Results for &ldquo;{searchQuery}&rdquo;
                    </h2>
                    <span className="text-xs text-[rgba(247,239,230,0.62)] tabular-nums">
                      {isSearching ? 'Searching public music APIs...' : `${searchResults.length} tracks`}
                    </span>
                  </div>
                  <CoverGrid
                    tracks={searchResults}
                    currentTrackId={currentTrack?.id}
                    isPlaying={isPlaying}
                    likedIds={tasteProfile.likedTrackIds}
                    onPlayTrack={(t, list) => void playTrack(t, list)}
                    onToggleLike={toggleLike}
                    onStartRadio={(t) => void startTrackRadio(t)}
                    isLoading={isSearching}
                    emptyMessage="No matching tracks found across iTunes, Audius, or Jamendo."
                  />
                </section>
              ) : railSection === 'radio' ? (
                <RadioView
                  stations={radioStations}
                  activeStationId={currentRadioStation?.id}
                  isPlaying={isPlaying}
                  isLoading={isLoadingRadio}
                  onPlayStation={(s) => void playRadioStation(s)}
                  onFilterTag={(tag) => void loadRadio(tag)}
                />
              ) : activePlaylist ? (
                <section aria-label={activePlaylist.name} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={activePlaylist.coverUrl}
                      alt=""
                      className="w-16 h-16 rounded-2xl object-cover"
                    />
                    <div>
                      <h2 className="text-lg font-semibold text-[#fbf7f2]">
                        {activePlaylist.name}
                      </h2>
                      <p className="text-xs text-[rgba(247,239,230,0.64)]">
                        {activePlaylist.description}
                      </p>
                    </div>
                  </div>
                  <TrackList
                    items={activePlaylistTracks}
                    currentTrackId={currentTrack?.id}
                    isPlaying={isPlaying}
                    likedIds={tasteProfile.likedTrackIds}
                    playlists={playlists}
                    onPlayTrack={(t, list) => void playTrack(t, list)}
                    onToggleLike={toggleLike}
                    onStartRadio={(t) => void startTrackRadio(t)}
                    onAddToPlaylist={addTrackToPlaylist}
                  />
                </section>
              ) : librarySection === 'made-for-you' ? (
                <MadeForYouView
                  mixes={curatedMixes}
                  recommendations={recommendations}
                  currentTrackId={currentTrack?.id}
                  isPlaying={isPlaying}
                  likedIds={tasteProfile.likedTrackIds}
                  playlists={playlists}
                  onPlayMix={handlePlayMix}
                  onPlayTrack={(t, list) => void playTrack(t, list)}
                  onToggleLike={toggleLike}
                  onSkipTrack={handleSkipTrack}
                  onStartRadio={(t) => void startTrackRadio(t)}
                  onAddToPlaylist={addTrackToPlaylist}
                />
              ) : librarySection === 'songs' ? (
                <section aria-label="Songs and recommendations" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#fbf7f2]">
                      Songs · Ranked for Your Taste
                    </h2>
                    <span className="text-xs text-[rgba(247,239,230,0.6)]">
                      Tap radio icon on any song for endless similar tracks
                    </span>
                  </div>
                  <TrackList
                    items={recommendations}
                    currentTrackId={currentTrack?.id}
                    isPlaying={isPlaying}
                    likedIds={tasteProfile.likedTrackIds}
                    playlists={playlists}
                    onPlayTrack={(t, list) => void playTrack(t, list)}
                    onToggleLike={toggleLike}
                    onSkipTrack={handleSkipTrack}
                    onStartRadio={(t) => void startTrackRadio(t)}
                    onAddToPlaylist={addTrackToPlaylist}
                  />
                </section>
              ) : librarySection === 'artists' ? (
                <section aria-label="Artists" className="space-y-4">
                  <h2 className="text-base font-semibold text-[#fbf7f2]">Artists in Your Vibe</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {artistGroups.map(([artist, tracks]) => (
                      <button
                        key={artist}
                        type="button"
                        onClick={() => void playTrack(tracks[0]!, tracks)}
                        className="rv-cover-card text-left bg-[rgba(255,248,240,0.06)] border border-[rgba(255,244,230,0.12)]"
                      >
                        <img
                          src={tracks[0]?.artworkUrl}
                          alt={artist}
                          className="aspect-square w-full object-cover rv-cover-card-art"
                        />
                        <div className="p-2">
                          <div className="text-sm font-semibold text-[#fbf7f2] truncate">
                            {artist}
                          </div>
                          <div className="text-xs text-[rgba(247,239,230,0.6)] tabular-nums">
                            {tracks.length} track{tracks.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="space-y-7">
                  {/* Primary 4-column Cover Grid matching reference design */}
                  <section aria-label="Featured albums and playlists">
                    <CoverGrid
                      tracks={filteredCatalog.slice(0, 8)}
                      currentTrackId={currentTrack?.id}
                      isPlaying={isPlaying}
                      likedIds={tasteProfile.likedTrackIds}
                      onPlayTrack={(t, list) => void playTrack(t, list)}
                      onToggleLike={toggleLike}
                      onStartRadio={(t) => void startTrackRadio(t)}
                      isLoading={isLoadingCatalog}
                    />
                  </section>

                  {/* Spotify-style Curated Mixes right below */}
                  <section aria-label="Spotify-style personalized mixes" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-[#fbf7f2]">
                        Recommended Mixes For You
                      </h2>
                      <button
                        type="button"
                        onClick={() => handleSelectLibrary('made-for-you')}
                        className="text-xs font-semibold text-[#f0c46c] hover:underline"
                      >
                        Open Full Mixes
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {curatedMixes.slice(0, 4).map((mix) => (
                        <button
                          key={mix.id}
                          type="button"
                          onClick={() => handlePlayMix(mix)}
                          className="rv-interactive-btn text-left p-3 rounded-2xl bg-[rgba(255,248,240,0.07)] hover:bg-[rgba(255,248,240,0.14)] border border-[rgba(255,244,230,0.12)] flex items-center gap-3"
                        >
                          <img
                            src={mix.coverUrl}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#fbf7f2] truncate">
                              {mix.title}
                            </div>
                            <div className="text-[11px] text-[rgba(247,239,230,0.62)] truncate">
                              {mix.badge} · {mix.tracks.length} tracks
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Bottom Floating Glass Playback Pill */}
      <FloatingPlayer onOpenSheet={() => setNowPlayingOpen(true)} />

      {/* Mobile Portrait Bottom Thumb Dock (automatically swaps with left rail in side-wise landscape) */}
      <MobileDock
        activeSection={railSection}
        isForYouActive={librarySection === 'made-for-you'}
        onSelectRail={handleSelectRail}
        onSelectForYou={() => handleSelectLibrary('made-for-you')}
      />

      {/* Modals & Sheets */}
      <NowPlayingSheet isOpen={nowPlayingOpen} onClose={() => setNowPlayingOpen(false)} />

      <ApiVaultModal
        isOpen={apiVaultOpen}
        vault={apiVault}
        onSave={updateApiVault}
        onReset={clearApiVault}
        onClose={() => setApiVaultOpen(false)}
      />

      <GetAppModal
        isOpen={getAppOpen}
        githubRepoUrl={apiVault.githubRepoUrl}
        onClose={() => setGetAppOpen(false)}
      />

      <AuthModal
        isOpen={authModalOpen}
        cloudUser={cloudUser}
        backendOnline={backendOnline}
        onSignIn={signInCloud}
        onSignUp={signUpCloud}
        onSignOut={signOutCloud}
        onClose={() => setAuthModalOpen(false)}
      />

      <YouTubeAudioBridge
        videoId={activeYoutubeVideoId}
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        seekTargetSec={youtubeSeekTarget}
        onProgress={handleYoutubeProgress}
        onStateSync={handleYoutubeStateSync}
        onEnded={handleYoutubeEnded}
        onError={handleYoutubeError}
      />
    </div>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <RiVibeWorkspace />
      </PlayerProvider>
    </LibraryProvider>
  );
}
