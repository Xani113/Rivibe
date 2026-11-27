import { useRef, useState } from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import type { AppTab } from './types/music';
import { NavShell } from './components/NavShell';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { LibraryView } from './components/LibraryView';
import { PlayerBar } from './components/PlayerBar';
import { QueueDrawer } from './components/QueueDrawer';
import { NowPlayingSheet } from './components/NowPlayingSheet';
import { SettingsModal } from './components/SettingsModal';
import { YouTubeAudioBridge } from './components/YouTubeAudioBridge';

function resolveInitialTab(): AppTab {
  if (typeof window === 'undefined') return 'home';
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param === 'search' || param === 'library') return param;
  return 'home';
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
    handleYoutubeProgress,
    handleYoutubeStateSync,
    handleYoutubeEnded,
    handleYoutubeError,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<AppTab>(() => resolveInitialTab());
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [nowPlayingTab, setNowPlayingTab] = useState<'queue' | 'lyrics'>('queue');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    setActivePlaylistId(null);
    if (tab === 'search') {
      window.setTimeout(() => searchInputRef.current?.focus(), 20);
    }
  };

  const handleSelectPlaylist = (playlistId: string | null) => {
    setActivePlaylistId(playlistId);
    setActiveTab('library');
  };

  const handleOpenSheet = (tab: 'queue' | 'lyrics' = 'queue') => {
    setNowPlayingTab(tab);
    setQueueOpen(false);
    setNowPlayingOpen(true);
  };

  return (
    <div className="rv-app-shell min-h-dvh w-full bg-[#090b10] text-[#f4f5f7] flex flex-col md:flex-row">
      {/* Subtle Top Studio Ambient Glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/4 w-[520px] h-[360px] rounded-full bg-[rgba(34,211,166,0.08)] blur-[140px]" />
        <div className="absolute top-0 right-10 w-[400px] h-[320px] rounded-full bg-[rgba(99,102,241,0.07)] blur-[140px]" />
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

      {/* Primary Content Stage */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        <main className="rv-main-scroll flex-1 px-4 sm:px-8 pt-5 sm:pt-7 pb-36 md:pb-28 max-w-7xl w-full mx-auto">
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
        onClose={() => setNowPlayingOpen(false)}
      />

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
        <RiVibeStudio />
      </PlayerProvider>
    </LibraryProvider>
  );
}
