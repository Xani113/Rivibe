import type {
  ApiVault,
  LyricLine,
  LyricsResult,
  MoodId,
  Track,
} from '../types/music';
import { SEED_TRACKS } from './seedCatalog';
import { normalizeText } from '../utils/formatTime';
import {
  fetchNativeRecommendations,
  isNativeAndroidPlaybackAvailable,
  searchNativeCatalog,
} from './nativeMusicBridge';

const responseCache = new Map<string, { expiresAt: number; data: unknown }>();

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    responseCache.set(url, { expiresAt: Date.now() + 1000 * 60 * 5, data: json });
    return json;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function shouldQueryBackend(vault: ApiVault): boolean {
  if (isNativeAndroidPlaybackAvailable()) return false;
  if (vault.backendUrl.trim().length > 0) return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return import.meta.env.MODE === 'test' || host === 'localhost' || host === '127.0.0.1';
}

function buildBackendUrl(vault: ApiVault, path: string): string {
  const clean = vault.backendUrl.trim().replace(/\/$/, '');
  return clean ? `${clean}${path}` : path;
}

async function resolveViaOptionalBackend(
  artist: string,
  title: string,
  vault: ApiVault,
): Promise<{ youtubeVideoId: string; durationSec: number; artworkUrl: string } | null> {
  if (!shouldQueryBackend(vault)) return null;
  const url = buildBackendUrl(
    vault,
    `/api/music/resolve-full?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`,
  );
  const res = await fetchJsonWithTimeout<{
    resolved?: { youtubeVideoId: string; durationSec: number; artworkUrl: string } | null;
  }>(url, 3500);
  return res?.resolved ?? null;
}

async function searchViaOptionalBackend(query: string, vault: ApiVault): Promise<Track[] | null> {
  if (!shouldQueryBackend(vault)) return null;
  const url = buildBackendUrl(vault, `/api/music/search?q=${encodeURIComponent(query)}`);
  const res = await fetchJsonWithTimeout<{ tracks?: Track[] }>(url, 4000);
  return res?.tracks ?? null;
}

async function recommendViaOptionalBackend(
  artist: string,
  title: string,
  vault: ApiVault,
): Promise<Track[] | null> {
  if (!shouldQueryBackend(vault)) return null;
  const url = buildBackendUrl(
    vault,
    `/api/music/recommend?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`,
  );
  const res = await fetchJsonWithTimeout<{ tracks?: Track[] }>(url, 4000);
  return res?.tracks ?? null;
}

function parseIsoDuration(iso?: string): number {
  if (!iso) return 180;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.trim());
  if (!m) return 180;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : 180;
}

function inferMoodsFromGenre(genre: string): string[] {
  const g = normalizeText(genre);
  const moods: string[] = ['for-you'];
  if (g.includes('jazz') || g.includes('blues') || g.includes('acoustic')) {
    moods.push('jazz', 'late-night', 'chill');
  }
  if (g.includes('electronic') || g.includes('dance') || g.includes('house')) {
    moods.push('workout', 'late-night', 'focus');
  }
  if (g.includes('ambient') || g.includes('classical') || g.includes('lo-fi') || g.includes('chill')) {
    moods.push('focus', 'chill');
  }
  if (g.includes('pop') || g.includes('indie') || g.includes('alternative')) {
    moods.push('indie', 'chill');
  }
  if (g.includes('hip-hop') || g.includes('rap') || g.includes('r&b')) {
    moods.push('late-night', 'workout');
  }
  return Array.from(new Set(moods));
}

export async function searchYouTubeDirect(
  query: string,
  youtubeApiKey: string,
  limit = 10,
): Promise<Track[]> {
  if (!youtubeApiKey.trim()) return [];
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=${limit}` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(youtubeApiKey.trim())}`;

  const data = await fetchJsonWithTimeout<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
      };
    }>;
  }>(searchUrl);

  const items = (data?.items ?? []).filter((i) => i.id?.videoId && i.snippet?.title);
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id!.videoId!).join(',');
  const detailUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${encodeURIComponent(ids)}` +
    `&key=${encodeURIComponent(youtubeApiKey.trim())}`;
  const detailRes = await fetchJsonWithTimeout<{
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      status?: { embeddable?: boolean };
    }>;
  }>(detailUrl);
  const details = new Map((detailRes?.items ?? []).map((v) => [v.id, v]));

  return items
    .map((item): Track | null => {
      const videoId = item.id!.videoId!;
      const detail = details.get(videoId);
      if (detail?.status?.embeddable === false) return null;
      const rawTitle = item.snippet?.title ?? 'Untitled';
      const channel = (item.snippet?.channelTitle ?? 'YouTube Music').replace(/ - Topic$/i, '');
      const split = rawTitle.split(/\s+-\s+/);
      const artist = split.length > 1 ? split[0]!.trim() : channel;
      const title = split.length > 1 ? split.slice(1).join(' - ').trim() : rawTitle;

      return {
        id: `yt-${videoId}`,
        title,
        artist,
        album: 'YouTube Music',
        artworkUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        audioUrl: null,
        youtubeVideoId: videoId,
        streamType: 'youtube',
        durationSec: parseIsoDuration(detail?.contentDetails?.duration),
        genres: ['YouTube Music'],
        moods: inferMoodsFromGenre(rawTitle),
        releaseYear: item.snippet?.publishedAt ? Number(item.snippet.publishedAt.slice(0, 4)) : undefined,
        source: 'youtube',
        externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
        popularity: 88,
      };
    })
    .filter((t): t is Track => t !== null);
}

export async function resolveFullSongTrack(track: Track, vault: ApiVault): Promise<Track> {
  if (track.streamType === 'full' || (track.streamType === 'youtube' && track.youtubeVideoId)) {
    return track;
  }

  if (isNativeAndroidPlaybackAvailable()) {
    const nativeHits = await searchNativeCatalog(`${track.artist} ${track.title} official audio`, 3);
    if (nativeHits[0]?.youtubeVideoId) {
      return {
        ...track,
        youtubeVideoId: nativeHits[0].youtubeVideoId,
        streamType: 'youtube',
        durationSec: nativeHits[0].durationSec || track.durationSec,
        artworkUrl: track.artworkUrl || nativeHits[0].artworkUrl,
      };
    }
  }

  const serverResolved = await resolveViaOptionalBackend(track.artist, track.title, vault);
  if (serverResolved?.youtubeVideoId) {
    return {
      ...track,
      youtubeVideoId: serverResolved.youtubeVideoId,
      streamType: 'youtube',
      durationSec: serverResolved.durationSec,
      artworkUrl: track.artworkUrl || serverResolved.artworkUrl,
    };
  }

  if (vault.youtubeApiKey.trim()) {
    const ytHits = await searchYouTubeDirect(
      `${track.artist} ${track.title} official audio`,
      vault.youtubeApiKey,
      2,
    );
    if (ytHits[0]?.youtubeVideoId) {
      return {
        ...track,
        youtubeVideoId: ytHits[0].youtubeVideoId,
        streamType: 'youtube',
        durationSec: ytHits[0].durationSec,
      };
    }
  }

  return track;
}

interface ItunesResultItem {
  trackId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
  trackViewUrl?: string;
  trackExplicitness?: string;
}

function normalizeItunesTrack(item: ItunesResultItem): Track | null {
  if (!item.trackName || !item.artistName) return null;
  const art = (item.artworkUrl100 ?? '').replace('100x100bb', '600x600bb');
  const genre = item.primaryGenreName || 'Pop';
  const year = item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : undefined;

  return {
    id: `itunes-${item.trackId ?? `${item.artistName}-${item.trackName}`}`,
    title: item.trackName,
    artist: item.artistName,
    album: item.collectionName || item.trackName,
    artworkUrl: art,
    audioUrl: item.previewUrl ?? null,
    streamType: item.previewUrl ? 'preview' : 'none',
    durationSec: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 180,
    genres: [genre],
    moods: inferMoodsFromGenre(genre),
    releaseYear: Number.isFinite(year) ? year : undefined,
    source: 'itunes',
    externalUrl: item.trackViewUrl,
    explicit: item.trackExplicitness === 'explicit',
    popularity: 82,
  };
}

export async function searchItunes(term: string, limit = 16): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
  const data = await fetchJsonWithTimeout<{ results?: ItunesResultItem[] }>(url);
  if (!data?.results) return [];
  return data.results.map(normalizeItunesTrack).filter((t): t is Track => t !== null);
}

interface AudiusItem {
  id?: string;
  title?: string;
  user?: { name?: string };
  genre?: string;
  mood?: string;
  duration?: number;
  play_count?: number;
  artwork?: { '480x480'?: string; '150x150'?: string };
  permalink?: string;
}

function normalizeAudiusTrack(item: AudiusItem): Track | null {
  if (!item.id || !item.title) return null;
  const genre = item.genre || 'Electronic';
  const moodList = inferMoodsFromGenre(genre);
  if (item.mood) moodList.push(normalizeText(item.mood));

  return {
    id: `audius-${item.id}`,
    title: item.title,
    artist: item.user?.name || 'Independent Artist',
    album: 'Audius',
    artworkUrl: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
    audioUrl: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(item.id)}/stream?app_name=RiVibe`,
    streamType: 'full',
    durationSec: item.duration ?? 210,
    genres: [genre],
    moods: Array.from(new Set(moodList)),
    source: 'audius',
    externalUrl: item.permalink ? `https://audius.co${item.permalink}` : undefined,
    popularity: item.play_count ? Math.min(98, Math.round(Math.log10(item.play_count + 1) * 18)) : 75,
  };
}

export async function fetchAudiusTrending(limit = 10): Promise<Track[]> {
  const url = `https://discoveryprovider.audius.co/v1/tracks/trending?app_name=RiVibe&limit=${limit}`;
  const data = await fetchJsonWithTimeout<{ data?: AudiusItem[] }>(url);
  if (!data?.data) return [];
  return data.data.map(normalizeAudiusTrack).filter((t): t is Track => t !== null);
}

export async function searchAudius(term: string, limit = 10): Promise<Track[]> {
  const url = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(term)}&app_name=RiVibe&limit=${limit}`;
  const data = await fetchJsonWithTimeout<{ data?: AudiusItem[] }>(url);
  if (!data?.data) return [];
  return data.data.map(normalizeAudiusTrack).filter((t): t is Track => t !== null);
}

function streamRank(track: Track): number {
  if (track.streamType === 'full') return 3;
  if (track.streamType === 'youtube') return 2;
  if (track.streamType === 'preview') return 1;
  return 0;
}

function mergeAndDeduplicateTracks(lists: Track[][], fullOnly = false): Track[] {
  const byKey = new Map<string, Track>();
  for (const list of lists) {
    for (const track of list) {
      const key = `${normalizeText(track.title)}::${normalizeText(track.artist)}`;
      const existing = byKey.get(key);
      if (!existing || streamRank(track) > streamRank(existing)) {
        byKey.set(key, track);
      }
    }
  }
  const merged = Array.from(byKey.values()).sort((a, b) => streamRank(b) - streamRank(a));
  return fullOnly
    ? merged.filter((t) => t.streamType === 'full' || t.streamType === 'youtube')
    : merged;
}

export async function searchAllMusic(
  query: string,
  vault: ApiVault,
  fullOnly = false,
): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return SEED_TRACKS;

  const nativePromise = isNativeAndroidPlaybackAvailable()
    ? searchNativeCatalog(trimmed, 16)
    : Promise.resolve<Track[]>([]);

  const backendPromise = searchViaOptionalBackend(trimmed, vault);

  const [nativeTracks, backendTracks] = await Promise.all([nativePromise, backendPromise]);
  if (nativeTracks.length > 0 && (!backendTracks || backendTracks.length === 0)) {
    return mergeAndDeduplicateTracks([nativeTracks], fullOnly);
  }
  if (backendTracks && backendTracks.length > 0) {
    return nativeTracks.length > 0
      ? mergeAndDeduplicateTracks([nativeTracks, backendTracks], fullOnly)
      : backendTracks;
  }

  const [ytTracks, audiusTracks, itunesTracks] = await Promise.all([
    searchYouTubeDirect(trimmed, vault.youtubeApiKey, 10),
    searchAudius(trimmed, 10),
    fullOnly ? Promise.resolve([]) : searchItunes(trimmed, 14),
  ]);

  const merged = mergeAndDeduplicateTracks([nativeTracks, ytTracks, audiusTracks, itunesTracks], fullOnly);
  if (merged.length > 0) return merged;

  const q = normalizeText(trimmed);
  return SEED_TRACKS.filter(
    (t) =>
      normalizeText(t.title).includes(q) ||
      normalizeText(t.artist).includes(q) ||
      normalizeText(t.album).includes(q),
  );
}

const MOOD_QUERY_MAP: Record<MoodId, string> = {
  all: 'Troye Sivan Porter Robinson Miles Davis',
  'for-you': 'synth pop chill indie electronic',
  chill: 'chill indie electronic acoustic',
  focus: 'ambient lo-fi instrumental study',
  'late-night': 'nocturnal r&b synthwave jazz',
  workout: 'upbeat electronic dance pop',
  indie: 'indie alternative bedroom pop',
  jazz: 'miles davis modern jazz fusion',
};

export async function fetchDiscoveryTracks(
  mood: MoodId,
  vault: ApiVault,
  fullOnly = false,
): Promise<Track[]> {
  const query = MOOD_QUERY_MAP[mood] || MOOD_QUERY_MAP.all;

  if (isNativeAndroidPlaybackAvailable()) {
    const nativeTracks = await fetchNativeRecommendations({ mood, limit: 20 });
    if (nativeTracks.length > 0) return nativeTracks;
  }

  const [ytTracks, audiusTrending, itunes] = await Promise.all([
    searchYouTubeDirect(query, vault.youtubeApiKey, 10),
    fetchAudiusTrending(12),
    fullOnly ? Promise.resolve([]) : searchItunes(query, 12),
  ]);

  const liveTracks = mergeAndDeduplicateTracks([ytTracks, audiusTrending, itunes], fullOnly);
  if (liveTracks.length > 0) return liveTracks;
  return mergeAndDeduplicateTracks([SEED_TRACKS], fullOnly);
}

function extractPrimaryArtist(artist: string): string {
  const first = artist.split(/[,&]|\s+(?:feat|ft)\.?\s+/i)[0]?.trim();
  return first || artist.trim();
}

function mergePreserveSimilarityOrder(
  lists: Track[][],
  seedTrack: Track,
  fullOnly = false,
): Track[] {
  const seedKey = `${normalizeText(seedTrack.title)}::${normalizeText(seedTrack.artist)}`;
  const seedVid = seedTrack.youtubeVideoId?.trim();
  const byKey = new Map<string, Track>();

  for (const list of lists) {
    for (const track of list) {
      if (fullOnly && track.streamType !== 'full' && track.streamType !== 'youtube') continue;
      if (seedVid && track.youtubeVideoId && track.youtubeVideoId === seedVid) continue;
      const key = `${normalizeText(track.title)}::${normalizeText(track.artist)}`;
      if (key === seedKey) continue;
      if (!byKey.has(key)) {
        byKey.set(key, track);
      }
    }
  }
  return Array.from(byKey.values());
}

export interface ArtistProfileInfo {
  name: string;
  subtitle: string;
  bio: string;
  artworkUrl: string;
  genres: string[];
  topTracks: Track[];
  source: 'wikipedia+catalog' | 'catalog';
}

function isLikelyMusicianWiki(data: { type?: string; description?: string; extract?: string } | null): boolean {
  if (!data || data.type !== 'standard' || !data.extract) return false;
  const combined = `${data.description ?? ''} ${data.extract}`.toLowerCase();
  return /(singer|musician|songwriter|rapper|dj|producer|band|composer|vocalist|music|recording artist|performer)/.test(
    combined,
  );
}

/**
 * Fetches verified artist metadata (Wikipedia summary + catalog songs across Audius/iTunes/YouTube).
 */
export async function fetchArtistProfile(
  artistName: string,
  vault: ApiVault,
  catalogFallback: Track[] = [],
): Promise<ArtistProfileInfo> {
  const cleanName = artistName.trim();
  const wikiCandidates = [
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`${cleanName} (musician)`)}`,
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`${cleanName} (singer)`)}`,
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`,
  ];

  const [searchedTracks, ...wikiResults] = await Promise.all([
    searchAllMusic(cleanName, vault, false),
    ...wikiCandidates.map((url) =>
      fetchJsonWithTimeout<{
        type?: string;
        title?: string;
        description?: string;
        extract?: string;
        thumbnail?: { source?: string };
      }>(url, 4500),
    ),
  ]);

  const normArtist = normalizeText(cleanName);
  const catalogMatches = catalogFallback.filter((t) =>
    normalizeText(t.artist).includes(normArtist),
  );
  const allTracks = mergeAndDeduplicateTracks([searchedTracks, catalogMatches], false);
  const topTracks = allTracks.slice(0, 20);

  const wiki = wikiResults.find(isLikelyMusicianWiki);
  const genres = Array.from(
    new Set(
      topTracks
        .flatMap((t) => t.genres)
        .filter((g) => g && normalizeText(g) !== 'youtube music'),
    ),
  ).slice(0, 5);

  const artworkUrl =
    wiki?.thumbnail?.source ||
    topTracks.find((t) => Boolean(t.artworkUrl))?.artworkUrl ||
    '';

  const fallbackBio =
    topTracks.length > 0
      ? `${cleanName} has ${topTracks.length} tracks available across ${genres.length > 0 ? genres.join(', ') : 'live music streams'}.`
      : `Artist details and tracks for ${cleanName}.`;

  return {
    name: cleanName,
    subtitle: wiki?.description || genres[0] || 'Recording Artist',
    bio: wiki?.extract || fallbackBio,
    artworkUrl,
    genres,
    topTracks,
    source: wiki ? 'wikipedia+catalog' : 'catalog',
  };
}

export async function fetchPersonalizedRecommendations(
  seedTrack: Track,
  mood: MoodId,
  vault: ApiVault,
  fullOnly = false,
): Promise<Track[]> {
  const primaryArtist = extractPrimaryArtist(seedTrack.artist);
  const primaryGenre = seedTrack.genres.find((g) => normalizeText(g) !== 'youtube music') ?? '';
  const similarityQuery = primaryGenre ? `${primaryArtist} ${primaryGenre}` : primaryArtist;

  const [
    nativeRecs,
    backendRecs,
    ytMatches,
    audiusArtistMatches,
    audiusGenreMatches,
    itunesSimilarMatches,
  ] = await Promise.all([
    isNativeAndroidPlaybackAvailable()
      ? fetchNativeRecommendations({
          videoId: seedTrack.youtubeVideoId,
          artist: primaryArtist,
          title: seedTrack.title,
          mood,
          limit: 45,
        })
      : Promise.resolve<Track[]>([]),
    recommendViaOptionalBackend(primaryArtist, seedTrack.title, vault),
    searchYouTubeDirect(`${primaryArtist} ${primaryGenre || 'songs'}`, vault.youtubeApiKey, 14),
    searchAudius(primaryArtist, 12),
    primaryGenre ? searchAudius(primaryGenre, 10) : Promise.resolve<Track[]>([]),
    fullOnly ? Promise.resolve([]) : searchItunes(similarityQuery, 18),
  ]);

  const prioritized = mergePreserveSimilarityOrder(
    [
      nativeRecs,
      backendRecs ?? [],
      ytMatches,
      audiusArtistMatches,
      itunesSimilarMatches,
      audiusGenreMatches,
    ],
    seedTrack,
    fullOnly,
  );

  if (prioritized.length >= 25) {
    return prioritized.slice(0, 50);
  }

  const discoveryFallback = await fetchDiscoveryTracks(mood, vault, fullOnly);
  return mergePreserveSimilarityOrder([prioritized, discoveryFallback], seedTrack, fullOnly).slice(0, 50);
}

function parseLrcSyncedLines(syncedLyrics?: string): LyricLine[] | undefined {
  if (!syncedLyrics) return undefined;
  const lines: LyricLine[] = [];
  const linePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
  for (const rawLine of syncedLyrics.split(/\r?\n/)) {
    const match = linePattern.exec(rawLine.trim());
    if (!match) continue;
    const mins = Number(match[1]);
    const secs = Number(match[2]);
    const frac = match[3] ? Number(match[3].padEnd(3, '0')) / 1000 : 0;
    const text = (match[4] ?? '').trim();
    if (!text) continue;
    lines.push({ timeSec: mins * 60 + secs + frac, text });
  }
  return lines.length > 0 ? lines : undefined;
}

export async function fetchLyrics(artist: string, title: string): Promise<LyricsResult> {
  const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
  const data = await fetchJsonWithTimeout<{ lyrics?: string }>(url, 5500);
  if (data?.lyrics && data.lyrics.trim().length > 0) {
    return {
      artist,
      title,
      lyrics: data.lyrics.trim(),
      source: 'lyricsovh',
    };
  }

  const lrcUrl =
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}` +
    `&track_name=${encodeURIComponent(cleanTitle)}`;
  const lrc = await fetchJsonWithTimeout<{ plainLyrics?: string; syncedLyrics?: string }>(lrcUrl, 5500);
  const syncedLines = parseLrcSyncedLines(lrc?.syncedLyrics);
  const resolvedLrc =
    lrc?.plainLyrics?.trim() ||
    (syncedLines ? syncedLines.map((l) => l.text).join('\n') : '') ||
    lrc?.syncedLyrics?.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, '').trim();
  if (resolvedLrc && resolvedLrc.length > 0) {
    return {
      artist,
      title,
      lyrics: resolvedLrc,
      syncedLines,
      source: 'lrclib',
    };
  }

  return {
    artist,
    title,
    lyrics: 'Lyrics are not available for this track right now.',
    source: 'unavailable',
  };
}
