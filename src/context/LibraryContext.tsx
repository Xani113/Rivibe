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
  BackendCapabilities,
  CloudUser,
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
import {
  addTrackToCloudPlaylist,
  checkBackendHealth,
  createCloudPlaylist,
  fetchCloudLibrary,
  fetchCurrentCloudUser,
  loginCloudAccount,
  logoutCloudAccount,
  registerCloudAccount,
  syncCloudLibrary,
} from '../services/cloudApi';
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
  fullOnly: boolean;
  setFullOnly: (enabled: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Track[];
  isSearching: boolean;
  isLoadingCatalog: boolean;
  radioStations: RadioStation[];
  isLoadingRadio: boolean;
  cloudUser: CloudUser | null;
  backendOnline: boolean;
  backendCapabilities: BackendCapabilities['capabilities'] | null;
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
  signInCloud: (email: string, password: string) => Promise<string | null>;
  signUpCloud: (email: string, password: string, displayName: string) => Promise<string | null>;
  signOutCloud: () => Promise<void>;
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
  const [fullOnly, setFullOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 320);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [radioStations, setRadioStations] = useState<RadioStation[]>(SEED_RADIO_STATIONS);
  const [isLoadingRadio, setIsLoadingRadio] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [backendCapabilities, setBackendCapabilities] =
    useState<BackendCapabilities['capabilities'] | null>(null);

  const registerTracks = useCallback((incoming: Track[]) => {
    if (incoming.length === 0) return;
    setCatalog((prev) => {
      const merged = mergeTracks(prev, incoming);
      saveTracksCache(merged);
      return merged;
    });
  }, []);

  const hydrateFromCloud = useCallback(
    async (baseUrl: string) => {
      const cloud = await fetchCloudLibrary(baseUrl);
      if (!cloud) return;

      if (cloud.snapshot) {
        const snap = cloud.snapshot;
        registerTracks(snap.likedTracks);
        setTasteProfile((prev) => {
          const next: TasteProfile = {
            ...prev,
            displayName: snap.displayName || prev.displayName,
            genreWeights: snap.genreWeights ?? prev.genreWeights,
            artistWeights: snap.artistWeights ?? prev.artistWeights,
            moodWeights: snap.moodWeights ?? prev.moodWeights,
            likedTrackIds: snap.likedTracks.map((t) => t.id),
            dislikedTrackIds: snap.dislikedTrackIds ?? prev.dislikedTrackIds,
            recentTrackIds: snap.recentTrackIds ?? prev.recentTrackIds,
            seedArtists: snap.seedArtists ?? prev.seedArtists,
          };
          saveTasteProfile(next);
          return next;
        });
      }

      if (cloud.playlists.length > 0) {
        const allCloudTracks = cloud.playlists.flatMap((p) => p.tracks);
        registerTracks(allCloudTracks);
        setPlaylists((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          for (const cp of cloud.playlists) {
            byId.set(cp.id, {
              id: cp.id,
              name: cp.name,
              description: cp.description,
              coverUrl: cp.coverUrl || cp.tracks[0]?.artworkUrl || prev[0]?.coverUrl || '',
              trackIds: cp.tracks.map((t) => t.id),
              createdAt: cp.createdAt,
              isSystem: cp.isSystem,
            });
          }
          const next = Array.from(byId.values());
          savePlaylists(next);
          return next;
        });
      }
    },
    [registerTracks],
  );

  // Detect Next.js Cloud Backend & restore session
  useEffect(() => {
    let active = true;
    void Promise.all([
      checkBackendHealth(apiVault.backendUrl),
      fetchCurrentCloudUser(apiVault.backendUrl),
    ]).then(([health, user]) => {
      if (!active) return;
      setBackendOnline(Boolean(health?.ok));
      setBackendCapabilities(health?.capabilities ?? null);
      if (user) {
        setCloudUser(user);
        void hydrateFromCloud(apiVault.backendUrl);
      }
    });
    return () => {
      active = false;
    };
  }, [apiVault.backendUrl, hydrateFromCloud]);

  useEffect(() => {
    let active = true;
    setIsLoadingCatalog(true);
    fetchDiscoveryTracks(activeMood, apiVault, fullOnly)
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
  }, [activeMood, apiVault, fullOnly, registerTracks]);

  useEffect(() => {
    let active = true;
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchAllMusic(trimmed, apiVault, fullOnly)
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
  }, [debouncedQuery, apiVault, fullOnly, registerTracks]);

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

  const syncProfileIfSignedIn = useCallback(
    (nextProfile: TasteProfile, nextCatalog: Track[]) => {
      if (cloudUser) {
        void syncCloudLibrary(apiVault.backendUrl, nextProfile, nextCatalog);
      }
    },
    [apiVault.backendUrl, cloudUser],
  );

  const setActiveMood = useCallback(
    (mood: MoodId) => {
      setActiveMoodState(mood);
      setTasteProfile((prev) => {
        const next = { ...prev, preferredMood: mood };
        saveTasteProfile(next);
        syncProfileIfSignedIn(next, catalog);
        return next;
      });
    },
    [catalog, syncProfileIfSignedIn],
  );

  const toggleLike = useCallback(
    (track: Track) => {
      registerTracks([track]);
      setTasteProfile((prev) => {
        const alreadyLiked = prev.likedTrackIds.includes(track.id);
        const next = applyInteractionToTaste(prev, track, alreadyLiked ? 'unlike' : 'like');
        saveTasteProfile(next);
        syncProfileIfSignedIn(next, [track, ...catalog]);
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
    [catalog, registerTracks, syncProfileIfSignedIn],
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

  const recordSkip = useCallback(
    (track: Track) => {
      setTasteProfile((prev) => {
        const next = applyInteractionToTaste(prev, track, 'skip');
        saveTasteProfile(next);
        syncProfileIfSignedIn(next, catalog);
        return next;
      });
    },
    [catalog, syncProfileIfSignedIn],
  );

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

      if (cloudUser) {
        void createCloudPlaylist(apiVault.backendUrl, created, initialTrack).then((remote) => {
          if (!remote) return;
          setPlaylists((prev) => {
            const next = prev.map((p) => (p.id === created.id ? { ...p, id: remote.id } : p));
            savePlaylists(next);
            return next;
          });
        });
      }
      return created;
    },
    [apiVault.backendUrl, catalog, cloudUser, registerTracks],
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
      if (cloudUser) {
        void addTrackToCloudPlaylist(apiVault.backendUrl, playlistId, track);
      }
    },
    [apiVault.backendUrl, cloudUser, registerTracks],
  );

  const updateDisplayName = useCallback(
    (name: string) => {
      const clean = name.trim() || 'Manoj';
      setTasteProfile((prev) => {
        const next = { ...prev, displayName: clean };
        saveTasteProfile(next);
        syncProfileIfSignedIn(next, catalog);
        return next;
      });
    },
    [catalog, syncProfileIfSignedIn],
  );

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

  const signInCloud = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const res = await loginCloudAccount(apiVault.backendUrl, { email, password });
      if (res.error || !res.user) return res.error ?? 'Sign in failed';
      setCloudUser(res.user);
      setBackendOnline(true);
      await hydrateFromCloud(apiVault.backendUrl);
      return null;
    },
    [apiVault.backendUrl, hydrateFromCloud],
  );

  const signUpCloud = useCallback(
    async (email: string, password: string, displayName: string): Promise<string | null> => {
      const res = await registerCloudAccount(apiVault.backendUrl, {
        email,
        password,
        displayName,
      });
      if (res.error || !res.user) return res.error ?? 'Registration failed';
      setCloudUser(res.user);
      setBackendOnline(true);
      const nextProfile = { ...tasteProfile, displayName: res.user.displayName };
      setTasteProfile(nextProfile);
      saveTasteProfile(nextProfile);
      await syncCloudLibrary(apiVault.backendUrl, nextProfile, catalog);
      await hydrateFromCloud(apiVault.backendUrl);
      return null;
    },
    [apiVault.backendUrl, catalog, hydrateFromCloud, tasteProfile],
  );

  const signOutCloud = useCallback(async () => {
    await logoutCloudAccount(apiVault.backendUrl);
    setCloudUser(null);
  }, [apiVault.backendUrl]);

  const activeCatalog = useMemo(() => {
    if (!fullOnly) return catalog;
    const filtered = catalog.filter((t) => t.streamType === 'full' || t.streamType === 'youtube');
    return filtered.length > 0 ? filtered : catalog;
  }, [catalog, fullOnly]);

  const recommendations = useMemo(
    () =>
      rankRecommendations(activeCatalog, tasteProfile, {
        limit: 24,
        maxPerArtist: 2,
        moodFilter: activeMood,
      }),
    [activeCatalog, tasteProfile, activeMood],
  );

  const curatedMixes = useMemo(
    () => buildCuratedMixes(activeCatalog, tasteProfile),
    [activeCatalog, tasteProfile],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      tasteProfile,
      apiVault,
      playlists,
      catalog: activeCatalog,
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
      backendCapabilities,
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
      signInCloud,
      signUpCloud,
      signOutCloud,
    }),
    [
      tasteProfile,
      apiVault,
      playlists,
      activeCatalog,
      curatedMixes,
      recommendations,
      activeMood,
      setActiveMood,
      fullOnly,
      searchQuery,
      searchResults,
      isSearching,
      isLoadingCatalog,
      radioStations,
      isLoadingRadio,
      cloudUser,
      backendOnline,
      backendCapabilities,
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
      signInCloud,
      signUpCloud,
      signOutCloud,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
