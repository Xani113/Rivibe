import type { ApiVault, Playlist, TasteProfile, Track } from '../types/music';
import { DEFAULT_PLAYLISTS, SEED_TRACKS } from './seedCatalog';

export const STORAGE_VERSION = 1;

const KEYS = {
  taste: 'rivibe_taste_profile_v1',
  vault: 'rivibe_api_vault_v1',
  playlists: 'rivibe_playlists_v1',
  tracks: 'rivibe_saved_tracks_v1',
} as const;

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
    lastfmApiKey: import.meta.env.VITE_LASTFM_API_KEY ?? '',
    tastediveApiKey: import.meta.env.VITE_TASTEDIVE_API_KEY ?? '',
    jamendoClientId: import.meta.env.VITE_JAMENDO_CLIENT_ID ?? '',
    theAudioDbApiKey: import.meta.env.VITE_THEAUDIODB_API_KEY || '123',
    geniusAccessToken: import.meta.env.VITE_GENIUS_ACCESS_TOKEN ?? '',
    spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '',
    githubRepoUrl: import.meta.env.VITE_GITHUB_REPO_URL || 'https://github.com/xani13/rivibe',
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
  };
}

export function saveApiVault(vault: ApiVault): void {
  safeWriteJson(KEYS.vault, { ...vault, version: STORAGE_VERSION });
}

export function resetVaultSecrets(): ApiVault {
  const clean: ApiVault = {
    version: STORAGE_VERSION,
    lastfmApiKey: '',
    tastediveApiKey: '',
    jamendoClientId: '',
    theAudioDbApiKey: '123',
    geniusAccessToken: '',
    spotifyClientId: '',
    githubRepoUrl: 'https://github.com/xani13/rivibe',
  };
  saveApiVault(clean);
  return clean;
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
  const trimmed = tracks.slice(0, 120);
  safeWriteJson(KEYS.tracks, trimmed);
}
