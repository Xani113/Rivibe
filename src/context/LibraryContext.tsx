import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ApiVault, MoodId, Playlist, TasteProfile, Track } from '../types/music';
import {
  loadApiVault,
  loadPlaylists,
  loadRecentSearches,
  loadSavedTracks,
  loadTasteProfile,
  resetVaultSecrets,
  saveApiVault,
  savePlaylists,
  saveRecentSearches,
  saveTasteProfile,
  saveTracksCache,
} from '../services/storage';
import { fetchDiscoveryTracks, searchAllMusic } from '../services/musicApis';
import { applyInteractionToTaste, rankRecommendations } from '../engine/vibeEngine';
import { useDebounce } from '../hooks/useDebounce';

interface LibraryContextValue {
  tasteProfile: TasteProfile;
  apiVault: ApiVault;
  playlists: Playlist[];
  catalog: Track[];
  homeTracks: Track[];
  likedTracks: Track[];
  recentTracks: Track[];
  recentSearches: string[];
  activeMood: MoodId;
  setActiveMood: (mood: MoodId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Track[];
  isSearching: boolean;
  isLoadingCatalog: boolean;
  toggleLike: (track: Track) => void;
  recordPlay: (track: Track) => void;
  recordComplete: (track: Track) => void;
  recordSkip: (track: Track) => void;
  createPlaylist: (name: string, description?: string, initialTrack?: Track) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  updateApiVault: (vault: ApiVault) => void;
  clearApiVault: () => void;
  registerTracks: (tracks: Track[]) => void;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

function mergeTracks(existing: Track[], incoming: Track[]): Track[] {
  const map = new Map<string, Track>();
  for (const t of incoming) {
    if (t.streamType !== 'none' && t.artworkUrl) {
      map.set(t.id, t);
    }
  }
  for (const t of existing) {
    if (!map.has(t.id)) map.set(t.id, t);
  }
  for (const t of incoming) {
    const prev = map.get(t.id);
    if (!prev || (!prev.audioUrl && !prev.youtubeVideoId && (t.audioUrl || t.youtubeVideoId))) {
      map.set(t.id, t);
    }
  }
  const rank = (t: Track) =>
    t.streamType === 'full' ? 3 : t.streamType === 'youtube' ? 2 : t.streamType === 'preview' ? 1 : 0;

  return Array.from(map.values()).sort((a, b) => {
    const aLive = a.source !== 'seed' ? rank(a) : -1;
    const bLive = b.source !== 'seed' ? rank(b) : -1;
    return bLive - aLive;
  });
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [tasteProfile, setTasteProfile] = useState<TasteProfile>(() => loadTasteProfile());
  const [apiVault, setApiVault] = useState<ApiVault>(() => loadApiVault());
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());
  const [catalog, setCatalog] = useState<Track[]>(() => loadSavedTracks());
  const [activeMood, setActiveMoodState] = useState<MoodId>(() => loadTasteProfile().preferredMood);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 280);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  const registerTracks = useCallback((incoming: Track[]) => {
    if (incoming.length === 0) return;
    setCatalog((prev) => {
      const merged = mergeTracks(prev, incoming);
      saveTracksCache(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoadingCatalog(true);
    fetchDiscoveryTracks(activeMood, apiVault, false)
      .then((tracks) => {
        if (!active) return;
        registerTracks(tracks);
      })
      .finally(() => {
        if (active) setIsLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, [activeMood, apiVault, registerTracks]);

  useEffect(() => {
    let active = true;
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchAllMusic(trimmed, apiVault, false)
      .then((results) => {
        if (!active) return;
        setSearchResults(results);
        registerTracks(results);
      })
      .finally(() => {
        if (active) setIsSearching(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, apiVault, registerTracks]);

  const addRecentSearch = useCallback((query: string) => {
    const clean = query.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        8,
      );
      saveRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    saveRecentSearches([]);
  }, []);

  const setActiveMood = useCallback((mood: MoodId) => {
    setActiveMoodState(mood);
    setTasteProfile((prev) => {
      const next = { ...prev, preferredMood: mood };
      saveTasteProfile(next);
      return next;
    });
  }, []);

  const toggleLike = useCallback(
    (track: Track) => {
      registerTracks([track]);
      setTasteProfile((prev) => {
        const alreadyLiked = prev.likedTrackIds.includes(track.id);
        const next = applyInteractionToTaste(prev, track, alreadyLiked ? 'unlike' : 'like');
        saveTasteProfile(next);
        return next;
      });
      setPlaylists((prev) => {
        const next = prev.map((pl) => {
          if (pl.id !== 'pl-liked') return pl;
          const exists = pl.trackIds.includes(track.id);
          const nextIds = exists
            ? pl.trackIds.filter((id) => id !== track.id)
            : [track.id, ...pl.trackIds];
          return {
            ...pl,
            coverUrl: track.artworkUrl || pl.coverUrl,
            trackIds: nextIds,
          };
        });
        savePlaylists(next);
        return next;
      });
    },
    [registerTracks],
  );

  const recordPlay = useCallback(
    (track: Track) => {
      registerTracks([track]);
      setTasteProfile((prev) => {
        const next = applyInteractionToTaste(prev, track, 'play');
        saveTasteProfile(next);
        return next;
      });
    },
    [registerTracks],
  );

  const recordComplete = useCallback((track: Track) => {
    setTasteProfile((prev) => {
      const next = applyInteractionToTaste(prev, track, 'complete');
      saveTasteProfile(next);
      return next;
    });
  }, []);

  const recordSkip = useCallback((track: Track) => {
    setTasteProfile((prev) => {
      const next = applyInteractionToTaste(prev, track, 'skip');
      saveTasteProfile(next);
      return next;
    });
  }, []);

  const createPlaylist = useCallback(
    (name: string, description = 'Created in RiVibe', initialTrack?: Track): Playlist => {
      if (initialTrack) registerTracks([initialTrack]);
      const created: Playlist = {
        id: `pl-${Date.now()}`,
        name: name.trim() || 'Untitled Playlist',
        description: description.trim() || 'Created in RiVibe',
        coverUrl: initialTrack?.artworkUrl || catalog[0]?.artworkUrl || '',
        trackIds: initialTrack ? [initialTrack.id] : [],
        createdAt: Date.now(),
      };
      setPlaylists((prev) => {
        const next = [...prev, created];
        savePlaylists(next);
        return next;
      });
      return created;
    },
    [catalog, registerTracks],
  );

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => {
      const target = prev.find((p) => p.id === playlistId);
      if (!target || target.isSystem) return prev;
      const next = prev.filter((p) => p.id !== playlistId);
      savePlaylists(next);
      return next;
    });
  }, []);

  const addTrackToPlaylist = useCallback(
    (playlistId: string, track: Track) => {
      registerTracks([track]);
      setPlaylists((prev) => {
        const next = prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          if (pl.trackIds.includes(track.id)) return pl;
          return {
            ...pl,
            coverUrl: pl.coverUrl || track.artworkUrl,
            trackIds: [...pl.trackIds, track.id],
          };
        });
        savePlaylists(next);
        return next;
      });
    },
    [registerTracks],
  );

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) => {
      const next = prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          trackIds: pl.trackIds.filter((id) => id !== trackId),
        };
      });
      savePlaylists(next);
      return next;
    });
  }, []);

  const updateApiVault = useCallback((nextVault: ApiVault) => {
    saveApiVault(nextVault);
    setApiVault(nextVault);
  }, []);

  const clearApiVault = useCallback(() => {
    const cleared = resetVaultSecrets();
    setApiVault(cleared);
  }, []);

  const homeTracks = useMemo(() => {
    const playable = catalog.filter((t) => t.source !== 'seed' && t.streamType !== 'none');
    const pool = playable.length > 0 ? playable : catalog;
    return rankRecommendations(pool, tasteProfile, {
      limit: 24,
      maxPerArtist: 3,
      moodFilter: activeMood,
    }).map((scored) => scored.track);
  }, [catalog, tasteProfile, activeMood]);

  const trackById = useMemo(() => new Map(catalog.map((t) => [t.id, t])), [catalog]);

  const likedTracks = useMemo(
    () =>
      tasteProfile.likedTrackIds
        .map((id) => trackById.get(id))
        .filter((t): t is Track => Boolean(t)),
    [tasteProfile.likedTrackIds, trackById],
  );

  const recentTracks = useMemo(
    () =>
      tasteProfile.recentTrackIds
        .map((id) => trackById.get(id))
        .filter((t): t is Track => Boolean(t)),
    [tasteProfile.recentTrackIds, trackById],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
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
      recordPlay,
      recordComplete,
      recordSkip,
      createPlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      addRecentSearch,
      clearRecentSearches,
      updateApiVault,
      clearApiVault,
      registerTracks,
    }),
    [
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
      searchResults,
      isSearching,
      isLoadingCatalog,
      toggleLike,
      recordPlay,
      recordComplete,
      recordSkip,
      createPlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      addRecentSearch,
      clearRecentSearches,
      updateApiVault,
      clearApiVault,
      registerTracks,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
