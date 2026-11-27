import type { ApiVault, Playlist, TasteProfile, Track } from '../types/music';
import { DEFAULT_PLAYLISTS, SEED_TRACKS } from './seedCatalog';

export const STORAGE_VERSION = 1;

const KEYS = {
  taste: 'rivibe_taste_profile_v1',
  vault: 'rivibe_api_vault_v1',
  playlists: 'rivibe_playlists_v1',
  tracks: 'rivibe_saved_tracks_v1',
  authToken: 'rivibe_cloud_token_v1',
  queue: 'rivibe_queue_v1',
  recentSearches: 'rivibe_recent_searches_v1',
} as const;

export interface PersistedQueueState {
  queue: Track[];
  queueIndex: number;
}

function safeReadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-browsing errors cleanly
  }
}

export function createDefaultTasteProfile(): TasteProfile {
  return {
    version: STORAGE_VERSION,
    displayName: 'Manoj',
    genreWeights: {
      'synth-pop': 2.6,
      electronic: 2.2,
      indie: 1.8,
      jazz: 1.4,
      'lo-fi': 1.6,
    },
    artistWeights: {
      'troye sivan': 2.0,
      'porter robinson': 1.8,
      'miles davis': 1.3,
    },
    moodWeights: {
      chill: 2.0,
      'late-night': 1.6,
      focus: 1.4,
    },
    likedTrackIds: ['seed-blue-neighbourhood', 'seed-level-high'],
    dislikedTrackIds: [],
    playCounts: {},
    recentTrackIds: ['seed-blue-neighbourhood', 'seed-coming-together', 'seed-bitches-brew'],
    seedArtists: ['Troye Sivan', 'Porter Robinson', 'Miles Davis'],
    preferredMood: 'all',
  };
}

export function loadTasteProfile(): TasteProfile {
  const parsed = safeReadJson<Partial<TasteProfile>>(KEYS.taste);
  if (!parsed || parsed.version !== STORAGE_VERSION) {
    return createDefaultTasteProfile();
  }
  const defaults = createDefaultTasteProfile();
  return {
    ...defaults,
    ...parsed,
    genreWeights: parsed.genreWeights ?? defaults.genreWeights,
    artistWeights: parsed.artistWeights ?? defaults.artistWeights,
    moodWeights: parsed.moodWeights ?? defaults.moodWeights,
    likedTrackIds: Array.isArray(parsed.likedTrackIds) ? parsed.likedTrackIds : defaults.likedTrackIds,
    dislikedTrackIds: Array.isArray(parsed.dislikedTrackIds) ? parsed.dislikedTrackIds : [],
    playCounts: parsed.playCounts ?? {},
    recentTrackIds: Array.isArray(parsed.recentTrackIds) ? parsed.recentTrackIds : defaults.recentTrackIds,
    seedArtists: Array.isArray(parsed.seedArtists) ? parsed.seedArtists : defaults.seedArtists,
  };
}

export function saveTasteProfile(profile: TasteProfile): void {
  safeWriteJson(KEYS.taste, { ...profile, version: STORAGE_VERSION });
}

export function createDefaultApiVault(): ApiVault {
  return {
    version: STORAGE_VERSION,
    youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY ?? '',
    lastfmApiKey: import.meta.env.VITE_LASTFM_API_KEY ?? '',
    tastediveApiKey: import.meta.env.VITE_TASTEDIVE_API_KEY ?? '',
    jamendoClientId: import.meta.env.VITE_JAMENDO_CLIENT_ID ?? '',
    theAudioDbApiKey: import.meta.env.VITE_THEAUDIODB_API_KEY || '123',
    geniusAccessToken: import.meta.env.VITE_GENIUS_ACCESS_TOKEN ?? '',
    spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '',
    githubRepoUrl: import.meta.env.VITE_GITHUB_REPO_URL || 'https://github.com/Xani113/Rivibe',
    backendUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  };
}

export function loadApiVault(): ApiVault {
  const defaults = createDefaultApiVault();
  const parsed = safeReadJson<Partial<ApiVault>>(KEYS.vault);
  if (!parsed || parsed.version !== STORAGE_VERSION) {
    return defaults;
  }
  return {
    ...defaults,
    ...parsed,
    theAudioDbApiKey: parsed.theAudioDbApiKey || defaults.theAudioDbApiKey,
    githubRepoUrl: parsed.githubRepoUrl || defaults.githubRepoUrl,
    backendUrl: parsed.backendUrl ?? defaults.backendUrl,
  };
}

export function saveApiVault(vault: ApiVault): void {
  safeWriteJson(KEYS.vault, { ...vault, version: STORAGE_VERSION });
}

export function resetVaultSecrets(): ApiVault {
  const clean: ApiVault = {
    version: STORAGE_VERSION,
    youtubeApiKey: '',
    lastfmApiKey: '',
    tastediveApiKey: '',
    jamendoClientId: '',
    theAudioDbApiKey: '123',
    geniusAccessToken: '',
    spotifyClientId: '',
    githubRepoUrl: 'https://github.com/Xani113/Rivibe',
    backendUrl: '',
  };
  saveApiVault(clean);
  return clean;
}

export function loadAuthToken(): string | null {
  try {
    return localStorage.getItem(KEYS.authToken);
  } catch {
    return null;
  }
}

export function saveAuthToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(KEYS.authToken);
    else localStorage.setItem(KEYS.authToken, token);
  } catch {
    // Ignore storage errors cleanly
  }
}

export function loadPlaylists(): Playlist[] {
  const parsed = safeReadJson<Playlist[]>(KEYS.playlists);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_PLAYLISTS;
  }
  return parsed;
}

export function savePlaylists(playlists: Playlist[]): void {
  safeWriteJson(KEYS.playlists, playlists);
}

export function loadSavedTracks(): Track[] {
  const parsed = safeReadJson<Track[]>(KEYS.tracks);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return SEED_TRACKS;
  }
  const byId = new Map<string, Track>();
  for (const track of SEED_TRACKS) byId.set(track.id, track);
  for (const track of parsed) {
    if (track?.id) byId.set(track.id, track);
  }
  return Array.from(byId.values());
}

export function saveTracksCache(tracks: Track[]): void {
  const trimmed = tracks.slice(0, 140);
  safeWriteJson(KEYS.tracks, trimmed);
}

export function loadSavedQueue(): PersistedQueueState | null {
  const parsed = safeReadJson<PersistedQueueState>(KEYS.queue);
  if (!parsed || !Array.isArray(parsed.queue) || parsed.queue.length === 0) {
    return null;
  }
  const safeQueue = parsed.queue.filter((t) => Boolean(t?.id && t?.title));
  if (safeQueue.length === 0) return null;
  const idx =
    typeof parsed.queueIndex === 'number' && parsed.queueIndex >= 0 && parsed.queueIndex < safeQueue.length
      ? parsed.queueIndex
      : 0;
  return { queue: safeQueue, queueIndex: idx };
}

export function saveQueueState(queue: Track[], queueIndex: number): void {
  safeWriteJson(KEYS.queue, {
    queue: queue.slice(0, 100),
    queueIndex: Math.max(0, Math.min(queueIndex, Math.max(0, queue.length - 1))),
  });
}

export function loadRecentSearches(): string[] {
  const parsed = safeReadJson<string[]>(KEYS.recentSearches);
  return Array.isArray(parsed) ? parsed.filter((q) => typeof q === 'string' && q.trim().length > 0) : [];
}

export function saveRecentSearches(queries: string[]): void {
  safeWriteJson(KEYS.recentSearches, queries.slice(0, 10));
}
