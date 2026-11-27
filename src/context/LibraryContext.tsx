import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  ApiVault,
  CuratedMix,
  MoodId,
  Playlist,
  RadioStation,
  ScoredTrack,
  TasteProfile,
  Track,
} from '../types/music';
import {
  loadApiVault,
  loadPlaylists,
  loadSavedTracks,
  loadTasteProfile,
  resetVaultSecrets,
  saveApiVault,
  savePlaylists,
  saveTasteProfile,
  saveTracksCache,
} from '../services/storage';
import {
  fetchDiscoveryTracks,
  fetchRadioStations,
  fetchSerendipitousGenre,
  searchAllMusic,
} from '../services/musicApis';
import { SEED_RADIO_STATIONS } from '../services/seedCatalog';
import {
  applyInteractionToTaste,
  buildCuratedMixes,
  rankRecommendations,
} from '../engine/vibeEngine';
import { useDebounce } from '../hooks/useDebounce';

interface LibraryContextValue {
  tasteProfile: TasteProfile;
  apiVault: ApiVault;
  playlists: Playlist[];
  catalog: Track[];
  curatedMixes: CuratedMix[];
  recommendations: ScoredTrack[];
  activeMood: MoodId;
  setActiveMood: (mood: MoodId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Track[];
  isSearching: boolean;
  isLoadingCatalog: boolean;
  radioStations: RadioStation[];
  isLoadingRadio: boolean;
  loadRadio: (tag?: string) => Promise<void>;
  toggleLike: (track: Track) => void;
  recordPlay: (track: Track) => void;
  recordComplete: (track: Track) => void;
  recordSkip: (track: Track) => void;
  createPlaylist: (name: string, description: string, initialTrack?: Track) => Playlist;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  updateDisplayName: (name: string) => void;
  updateApiVault: (vault: ApiVault) => void;
  clearApiVault: () => void;
  registerTracks: (tracks: Track[]) => void;
  runSurpriseVibe: () => Promise<string>;
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
    if (!prev || (!prev.audioUrl && t.audioUrl)) {
      map.set(t.id, t);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aLive = a.streamType !== 'none' && a.source !== 'seed' ? 1 : 0;
    const bLive = b.streamType !== 'none' && b.source !== 'seed' ? 1 : 0;
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
  const debouncedQuery = useDebounce(searchQuery, 320);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [radioStations, setRadioStations] = useState<RadioStation[]>(SEED_RADIO_STATIONS);
  const [isLoadingRadio, setIsLoadingRadio] = useState(false);

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
    fetchDiscoveryTracks(activeMood, apiVault)
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
    searchAllMusic(trimmed, apiVault)
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

  const loadRadio = useCallback(async (tag = '') => {
    setIsLoadingRadio(true);
    try {
      const stations = await fetchRadioStations(tag);
      setRadioStations(stations);
    } finally {
      setIsLoadingRadio(false);
    }
  }, []);

  useEffect(() => {
    void loadRadio();
  }, [loadRadio]);

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
    (name: string, description: string, initialTrack?: Track): Playlist => {
      if (initialTrack) registerTracks([initialTrack]);
      const created: Playlist = {
        id: `pl-${Date.now()}`,
        name: name.trim() || 'Untitled Mix',
        description: description.trim() || 'Curated in RiVibe',
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

  const updateDisplayName = useCallback((name: string) => {
    const clean = name.trim() || 'Manoj';
    setTasteProfile((prev) => {
      const next = { ...prev, displayName: clean };
      saveTasteProfile(next);
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

  const runSurpriseVibe = useCallback(async (): Promise<string> => {
    const genre = await fetchSerendipitousGenre();
    setSearchQuery(genre);
    return genre;
  }, []);

  const recommendations = useMemo(
    () =>
      rankRecommendations(catalog, tasteProfile, {
        limit: 24,
        maxPerArtist: 2,
        moodFilter: activeMood,
      }),
    [catalog, tasteProfile, activeMood],
  );

  const curatedMixes = useMemo(
    () => buildCuratedMixes(catalog, tasteProfile),
    [catalog, tasteProfile],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      tasteProfile,
      apiVault,
      playlists,
      catalog,
      curatedMixes,
      recommendations,
      activeMood,
      setActiveMood,
      searchQuery,
      setSearchQuery,
      searchResults,
      isSearching,
      isLoadingCatalog,
      radioStations,
      isLoadingRadio,
      loadRadio,
      toggleLike,
      recordPlay,
      recordComplete,
      recordSkip,
      createPlaylist,
      addTrackToPlaylist,
      updateDisplayName,
      updateApiVault,
      clearApiVault,
      registerTracks,
      runSurpriseVibe,
    }),
    [
      tasteProfile,
      apiVault,
      playlists,
      catalog,
      curatedMixes,
      recommendations,
      activeMood,
      setActiveMood,
      searchQuery,
      searchResults,
      isSearching,
      isLoadingCatalog,
      radioStations,
      isLoadingRadio,
      loadRadio,
      toggleLike,
      recordPlay,
      recordComplete,
      recordSkip,
      createPlaylist,
      addTrackToPlaylist,
      updateDisplayName,
      updateApiVault,
      clearApiVault,
      registerTracks,
      runSurpriseVibe,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
