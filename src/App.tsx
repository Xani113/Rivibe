import { useCallback, useEffect, useRef, useState } from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { OverlayProvider } from './context/OverlayContext';
import { useOverlay } from './context/overlayStore';
import type { AppTab } from './types/music';
import { minimizeNativeApp } from './services/nativeMusicBridge';
import { NavShell } from './components/NavShell';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { LibraryView } from './components/LibraryView';
import { PlayerBar } from './components/PlayerBar';
import { QueueDrawer } from './components/QueueDrawer';
import { NowPlayingSheet } from './components/NowPlayingSheet';
import { SettingsModal } from './components/SettingsModal';
import { TrackActionSheet } from './components/TrackActionSheet';
import { ArtistInfoModal } from './components/ArtistInfoModal';
import { YouTubeAudioBridge } from './components/YouTubeAudioBridge';

function resolveInitialTab(): AppTab {
  if (typeof window === 'undefined') return 'home';
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param === 'search' || param === 'library') return param;
  return 'home';
}

function isInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type !== 'range' && type !== 'checkbox' && type !== 'radio' && type !== 'button';
  }
  return el.tagName === 'TEXTAREA' || el.isContentEditable;
}

function RiVibeStudio() {
  const {
    tasteProfile,
    apiVault,
    playlists,
    catalog,
    homeTracks,
    likedTracks,
    recentTracks,
    recentSearches,
    activeMood,
    setActiveMood,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    isLoadingCatalog,
    toggleLike,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    addRecentSearch,
    clearRecentSearches,
    updateApiVault,
    clearApiVault,
  } = useLibrary();

  const {
    currentTrack,
    activeYoutubeVideoId,
    youtubeSeekTarget,
    queue,
    isPlaying,
    volume,
    isMuted,
    playTrack,
    addToQueue,
    playNext,
    startTrackRadio,
    showToast,
    handleYoutubeProgress,
    handleYoutubeStateSync,
    handleYoutubeEnded,
    handleYoutubeError,
  } = usePlayer();

  const { trackMenu, artistInfo, closeTrackMenu, closeArtistInfo } = useOverlay();

  const [activeTab, setActiveTab] = useState<AppTab>(() => resolveInitialTab());
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [nowPlayingTab, setNowPlayingTab] = useState<'queue' | 'lyrics'>('queue');
  const [nowPlayingExpanded, setNowPlayingExpanded] = useState(false);
  const [nowPlayingPlaylistOpen, setNowPlayingPlaylistOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastBackHomeTsRef = useRef(0);
  const backLockSentinelRef = useRef(false);

  const uiRef = useRef({
    trackMenu,
    artistInfo,
    settingsOpen,
    nowPlayingPlaylistOpen,
    nowPlayingOpen,
    nowPlayingExpanded,
    queueOpen,
    activePlaylistId,
    activeTab,
  });
  uiRef.current = {
    trackMenu,
    artistInfo,
    settingsOpen,
    nowPlayingPlaylistOpen,
    nowPlayingOpen,
    nowPlayingExpanded,
    queueOpen,
    activePlaylistId,
    activeTab,
  };

  const closeNowPlaying = useCallback(() => {
    uiRef.current.nowPlayingOpen = false;
    uiRef.current.nowPlayingExpanded = false;
    uiRef.current.nowPlayingPlaylistOpen = false;
    setNowPlayingOpen(false);
    setNowPlayingExpanded(false);
    setNowPlayingPlaylistOpen(false);
  }, []);

  const handleSelectTab = (tab: AppTab) => {
    // Do NOT auto-focus search input when navigating to Search (prevents unprompted keyboard pop-up)
    lastBackHomeTsRef.current = 0;
    setActiveTab(tab);
    setActivePlaylistId(null);
  };

  const handleSelectPlaylist = (playlistId: string | null) => {
    setActivePlaylistId(playlistId);
    setActiveTab('library');
  };

  const handleOpenSheet = (tab: 'queue' | 'lyrics' = 'queue') => {
    const startExpanded = tab === 'lyrics';
    uiRef.current.nowPlayingOpen = true;
    uiRef.current.nowPlayingExpanded = startExpanded;
    uiRef.current.nowPlayingPlaylistOpen = false;
    uiRef.current.queueOpen = false;
    setNowPlayingTab(tab);
    setNowPlayingExpanded(startExpanded);
    setNowPlayingPlaylistOpen(false);
    setQueueOpen(false);
    setNowPlayingOpen(true);
  };

  // Strict deterministic 6-layer UI priority stack for Android hardware/gesture Back & browser Back.
  // Reads & updates uiRef synchronously so rapid back gestures within a single frame step cleanly through layers.
  const handleBackNavigation = useCallback((): boolean => {
    const ui = uiRef.current;

    // 1. Open context menus / modals / popovers close first
    if (ui.trackMenu) {
      ui.trackMenu = null;
      closeTrackMenu();
      return true;
    }
    if (ui.artistInfo) {
      ui.artistInfo = null;
      closeArtistInfo();
      return true;
    }
    if (ui.settingsOpen) {
      ui.settingsOpen = false;
      setSettingsOpen(false);
      return true;
    }
    if (ui.nowPlayingPlaylistOpen) {
      ui.nowPlayingPlaylistOpen = false;
      setNowPlayingPlaylistOpen(false);
      return true;
    }

    // 2. Collapse expanded Up Next / Lyrics bottom sheet back to Now Playing (or QueueDrawer)
    if (ui.nowPlayingOpen && ui.nowPlayingExpanded) {
      ui.nowPlayingExpanded = false;
      setNowPlayingExpanded(false);
      return true;
    }
    if (ui.queueOpen) {
      ui.queueOpen = false;
      setQueueOpen(false);
      return true;
    }

    // 3. Collapse Full-Screen Now Playing smoothly down to Mini-Player
    if (ui.nowPlayingOpen) {
      closeNowPlaying();
      return true;
    }

    // 4. Dismiss active keyboard / search focus cleanly without leaving tab yet
    if (isInputFocused()) {
      (document.activeElement as HTMLElement).blur();
      return true;
    }

    // 5. Collapse nested Library playlist -> Library -> Home, or Search -> Home
    if (ui.activeTab === 'library' && ui.activePlaylistId) {
      ui.activePlaylistId = null;
      setActivePlaylistId(null);
      lastBackHomeTsRef.current = 0;
      return true;
    }
    if (ui.activeTab !== 'home') {
      ui.activeTab = 'home';
      ui.activePlaylistId = null;
      setActiveTab('home');
      setActivePlaylistId(null);
      lastBackHomeTsRef.current = 0;
      return true;
    }

    // 6. Already on Home root with no overlays open: double-back toast before backgrounding
    const now = Date.now();
    if (now - lastBackHomeTsRef.current < 2000) {
      lastBackHomeTsRef.current = 0;
      void minimizeNativeApp();
      return false;
    }

    lastBackHomeTsRef.current = now;
    showToast('Press back again to exit');
    return true;
  }, [closeArtistInfo, closeNowPlaying, closeTrackMenu, showToast]);

  const backHandlerRef = useRef(handleBackNavigation);
  backHandlerRef.current = handleBackNavigation;

  const hasInteractiveLayer =
    Boolean(trackMenu) ||
    Boolean(artistInfo) ||
    settingsOpen ||
    queueOpen ||
    nowPlayingOpen ||
    Boolean(activePlaylistId) ||
    activeTab !== 'home';

  // Push one browser history guard when secondary UI layers open so mobile PWA Back pops cleanly too
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasInteractiveLayer && !backLockSentinelRef.current) {
      try {
        window.history.pushState({ rivibeGuard: true }, '');
        backLockSentinelRef.current = true;
      } catch {
        // Ignore restricted history frames
      }
    } else if (!hasInteractiveLayer) {
      backLockSentinelRef.current = false;
    }
  }, [hasInteractiveLayer]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onNativeBack = () => {
      backHandlerRef.current();
    };

    const onPopState = () => {
      const consumed = backHandlerRef.current();
      if (consumed) {
        try {
          window.history.pushState({ rivibeGuard: true }, '');
          backLockSentinelRef.current = true;
        } catch {
          // Ignore
        }
      } else {
        backLockSentinelRef.current = false;
      }
    };

    window.addEventListener('rivibeHardwareBack', onNativeBack);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('rivibeHardwareBack', onNativeBack);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return (
    <div className="rv-app-shell min-h-dvh w-full bg-[#090b10] text-[#f4f5f7] flex flex-col md:flex-row">
      {/* Subtle Top Studio Ambient Glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/4 w-[520px] h-[360px] rounded-full bg-[rgba(124,92,255,0.11)] blur-[140px]" />
        <div className="absolute top-0 right-10 w-[400px] h-[320px] rounded-full bg-[rgba(192,132,252,0.07)] blur-[140px]" />
      </div>

      {/* Unified Desktop Sidebar + Mobile Header & 3-Tab Bottom Nav */}
      <NavShell
        activeTab={activeTab}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        queueCount={queue.length}
        queueOpen={queueOpen}
        onSelectTab={handleSelectTab}
        onSelectPlaylist={handleSelectPlaylist}
        onCreatePlaylist={(name) => createPlaylist(name)}
        onToggleQueue={() => setQueueOpen((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Primary Content Stage with Crisp GPU Tab Transition */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        <main className="rv-main-scroll flex-1 px-4 sm:px-8 pt-5 sm:pt-7 pb-36 md:pb-28 max-w-7xl w-full mx-auto">
          <div key={activeTab} className="rv-tab-enter">
            {activeTab === 'home' ? (
              <HomeView
                tracks={homeTracks}
                recentTracks={recentTracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                isLoading={isLoadingCatalog}
                activeMood={activeMood}
                likedIds={tasteProfile.likedTrackIds}
                playlists={playlists}
                onMoodChange={setActiveMood}
                onPlayTrack={(t, list) => void playTrack(t, list, { appendSimilar: true })}
                onAddToQueue={addToQueue}
                onPlayNext={playNext}
                onToggleLike={toggleLike}
                onStartRadio={(t) => void startTrackRadio(t)}
                onAddToPlaylist={addTrackToPlaylist}
              />
            ) : null}

            {activeTab === 'search' ? (
              <SearchView
                query={searchQuery}
                results={searchResults}
                recentSearches={recentSearches}
                isSearching={isSearching}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                likedIds={tasteProfile.likedTrackIds}
                playlists={playlists}
                inputRef={searchInputRef}
                onQueryChange={setSearchQuery}
                onSubmitSearch={addRecentSearch}
                onClearRecentSearches={clearRecentSearches}
                onPlayTrack={(t, list) => void playTrack(t, list, { appendSimilar: true })}
                onAddToQueue={addToQueue}
                onPlayNext={playNext}
                onToggleLike={toggleLike}
                onStartRadio={(t) => void startTrackRadio(t)}
                onAddToPlaylist={addTrackToPlaylist}
              />
            ) : null}

            {activeTab === 'library' ? (
              <LibraryView
                playlists={playlists}
                catalog={catalog}
                likedTracks={likedTracks}
                recentTracks={recentTracks}
                activePlaylistId={activePlaylistId}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                likedIds={tasteProfile.likedTrackIds}
                onSelectPlaylist={handleSelectPlaylist}
                onCreatePlaylist={(name) => createPlaylist(name)}
                onDeletePlaylist={deletePlaylist}
                onPlayTrack={(t, list) => void playTrack(t, list)}
                onAddToQueue={addToQueue}
                onPlayNext={playNext}
                onToggleLike={toggleLike}
                onStartRadio={(t) => void startTrackRadio(t)}
                onAddToPlaylist={addTrackToPlaylist}
                onRemoveFromPlaylist={removeTrackFromPlaylist}
              />
            ) : null}
          </div>
        </main>
      </div>

      {/* Bottom Docked Player Deck */}
      <PlayerBar
        queueOpen={queueOpen}
        onOpenSheet={handleOpenSheet}
        onToggleQueue={() => setQueueOpen((v) => !v)}
      />

      {/* Dedicated Playback Queue Drawer */}
      <QueueDrawer isOpen={queueOpen} onClose={() => setQueueOpen(false)} />

      {/* Full-Screen Expanded Now Playing Studio */}
      <NowPlayingSheet
        isOpen={nowPlayingOpen}
        initialTab={nowPlayingTab}
        isExpanded={nowPlayingExpanded}
        onExpandedChange={setNowPlayingExpanded}
        playlistMenuOpen={nowPlayingPlaylistOpen}
        onPlaylistMenuOpenChange={setNowPlayingPlaylistOpen}
        onClose={closeNowPlaying}
      />

      {/* Know About Artist Sheet */}
      <ArtistInfoModal />

      {/* Global 3-Dot Track Action Bottom Sheet */}
      <TrackActionSheet />

      {/* Consolidated Clean Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        vault={apiVault}
        onSaveVault={updateApiVault}
        onResetVault={clearApiVault}
        onClose={() => setSettingsOpen(false)}
      />

      <YouTubeAudioBridge
        videoId={activeYoutubeVideoId}
        trackTitle={currentTrack?.title}
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
        <OverlayProvider>
          <RiVibeStudio />
        </OverlayProvider>
      </PlayerProvider>
    </LibraryProvider>
  );
}
