import type {
  ApiVault,
  BackendCapabilities,
  CloudUser,
  Playlist,
  TasteProfile,
  Track,
} from '../types/music';
import { loadAuthToken, saveAuthToken } from './storage';

function buildApiUrl(base: string, path: string): string {
  const cleanBase = base.trim().replace(/\/$/, '');
  return cleanBase ? `${cleanBase}${path}` : path;
}

function buildAuthHeaders(vault?: ApiVault): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = loadAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (vault?.youtubeApiKey) headers['x-youtube-api-key'] = vault.youtubeApiKey;
  if (vault?.lastfmApiKey) headers['x-lastfm-api-key'] = vault.lastfmApiKey;
  if (vault?.tastediveApiKey) headers['x-tastedive-api-key'] = vault.tastediveApiKey;
  if (vault?.jamendoClientId) headers['x-jamendo-client-id'] = vault.jamendoClientId;
  return headers;
}

async function safeApiFetch<T>(
  base: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(buildApiUrl(base, path), {
      ...init,
      credentials: 'include',
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: T | null = null;
    try {
      parsed = text ? (JSON.parse(text) as T) : null;
    } catch {
      parsed = null;
    }
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as { error?: { message?: string } }).error?.message
        : undefined;
    return { ok: res.ok, status: res.status, data: parsed, error: errMsg };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Cloud backend unreachable' };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkBackendHealth(baseUrl: string): Promise<BackendCapabilities | null> {
  const res = await safeApiFetch<BackendCapabilities>(baseUrl, '/api/health', { method: 'GET' }, 2500);
  if (!res.ok || !res.data?.ok) return null;
  return res.data;
}

export async function registerCloudAccount(
  baseUrl: string,
  input: { email: string; password: string; displayName: string },
): Promise<{ user?: CloudUser; error?: string }> {
  const res = await safeApiFetch<{ user?: CloudUser; token?: string }>(
    baseUrl,
    '/api/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok || !res.data?.user) {
    return { error: res.error || 'Could not create account' };
  }
  if (res.data.token) saveAuthToken(res.data.token);
  return { user: res.data.user };
}

export async function loginCloudAccount(
  baseUrl: string,
  input: { email: string; password: string },
): Promise<{ user?: CloudUser; error?: string }> {
  const res = await safeApiFetch<{ user?: CloudUser; token?: string }>(
    baseUrl,
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok || !res.data?.user) {
    return { error: res.error || 'Invalid email or password' };
  }
  if (res.data.token) saveAuthToken(res.data.token);
  return { user: res.data.user };
}

export async function logoutCloudAccount(baseUrl: string): Promise<void> {
  saveAuthToken(null);
  await safeApiFetch(baseUrl, '/api/auth/logout', { method: 'POST' }, 2500);
}

export async function fetchCurrentCloudUser(baseUrl: string): Promise<CloudUser | null> {
  const res = await safeApiFetch<{ user?: CloudUser | null }>(
    baseUrl,
    '/api/auth/me',
    { method: 'GET', headers: buildAuthHeaders() },
    2500,
  );
  if (!res.ok) return null;
  return res.data?.user ?? null;
}

export interface CloudLibraryResponse {
  snapshot: {
    displayName: string;
    genreWeights: Record<string, number>;
    artistWeights: Record<string, number>;
    moodWeights: Record<string, number>;
    likedTracks: Track[];
    dislikedTrackIds: string[];
    recentTrackIds: string[];
    seedArtists: string[];
    preferredMood: string;
  } | null;
  playlists: Array<{
    id: string;
    name: string;
    description: string;
    coverUrl: string;
    tracks: Track[];
    createdAt: number;
    isSystem?: boolean;
  }>;
}

export async function fetchCloudLibrary(baseUrl: string): Promise<CloudLibraryResponse | null> {
  const res = await safeApiFetch<CloudLibraryResponse>(baseUrl, '/api/library', {
    method: 'GET',
    headers: buildAuthHeaders(),
  });
  if (!res.ok || !res.data) return null;
  return res.data;
}

export async function syncCloudLibrary(
  baseUrl: string,
  profile: TasteProfile,
  catalog: Track[],
): Promise<boolean> {
  const byId = new Map(catalog.map((t) => [t.id, t]));
  const likedTracks = profile.likedTrackIds
    .map((id) => byId.get(id))
    .filter((t): t is Track => Boolean(t));

  const res = await safeApiFetch(baseUrl, '/api/library', {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      displayName: profile.displayName,
      genreWeights: profile.genreWeights,
      artistWeights: profile.artistWeights,
      moodWeights: profile.moodWeights,
      likedTracks,
      dislikedTrackIds: profile.dislikedTrackIds,
      recentTrackIds: profile.recentTrackIds,
      seedArtists: profile.seedArtists,
      preferredMood: profile.preferredMood,
    }),
  });
  return res.ok;
}

export async function createCloudPlaylist(
  baseUrl: string,
  playlist: Playlist,
  initialTrack?: Track,
): Promise<CloudLibraryResponse['playlists'][number] | null> {
  const res = await safeApiFetch<{ playlist?: CloudLibraryResponse['playlists'][number] }>(
    baseUrl,
    '/api/library/playlists',
    {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        name: playlist.name,
        description: playlist.description,
        coverUrl: playlist.coverUrl,
        initialTrack,
      }),
    },
  );
  return res.ok ? (res.data?.playlist ?? null) : null;
}

export async function addTrackToCloudPlaylist(
  baseUrl: string,
  playlistId: string,
  track: Track,
): Promise<boolean> {
  const res = await safeApiFetch(baseUrl, `/api/library/playlists/${encodeURIComponent(playlistId)}`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify({ addTrack: track }),
  });
  return res.ok;
}

export async function searchMusicViaBackend(
  query: string,
  fullOnly: boolean,
  vault: ApiVault,
): Promise<Track[] | null> {
  const res = await safeApiFetch<{ tracks?: Track[] }>(
    vault.backendUrl,
    `/api/music/search?q=${encodeURIComponent(query)}&fullOnly=${fullOnly ? 'true' : 'false'}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(vault),
    },
    4500,
  );
  if (!res.ok || !res.data?.tracks) return null;
  return res.data.tracks;
}

export async function resolveFullSongViaBackend(
  artist: string,
  title: string,
  vault: ApiVault,
): Promise<{ youtubeVideoId: string; durationSec: number; artworkUrl: string } | null> {
  const res = await safeApiFetch<{
    resolved?: { youtubeVideoId: string; durationSec: number; artworkUrl: string } | null;
  }>(
    vault.backendUrl,
    `/api/music/resolve-full?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(vault),
    },
    4500,
  );
  if (!res.ok) return null;
  return res.data?.resolved ?? null;
}

export async function recommendViaBackend(
  artist: string,
  title: string,
  vault: ApiVault,
): Promise<Track[] | null> {
  const res = await safeApiFetch<{ tracks?: Track[] }>(
    vault.backendUrl,
    `/api/music/recommend?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(vault),
    },
    4500,
  );
  if (!res.ok || !res.data?.tracks) return null;
  return res.data.tracks;
}
