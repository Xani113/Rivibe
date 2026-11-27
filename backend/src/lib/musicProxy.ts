import type { CloudTrack } from './types';

export interface ServerMusicKeys {
  youtubeApiKey?: string;
  lastfmApiKey?: string;
  tastediveApiKey?: string;
  jamendoClientId?: string;
}

const serverCache = new Map<string, { expiresAt: number; data: unknown }>();

async function cachedFetchJson<T>(url: string, init?: RequestInit, ttlMs = 1000 * 60 * 10): Promise<T | null> {
  const cacheKey = url;
  const hit = serverCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    serverCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, data: json });
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseIsoDurationToSec(iso?: string): number {
  if (!iso) return 180;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.trim());
  if (!match) return 180;
  const hours = Number(match[1] ?? 0);
  const mins = Number(match[2] ?? 0);
  const secs = Number(match[3] ?? 0);
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : 180;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function inferMoods(label: string): string[] {
  const g = label.toLowerCase();
  const moods = new Set<string>(['for-you']);
  if (g.includes('jazz') || g.includes('acoustic')) moods.add('jazz');
  if (g.includes('chill') || g.includes('lo-fi') || g.includes('ambient')) moods.add('chill');
  if (g.includes('focus') || g.includes('study') || g.includes('ambient')) moods.add('focus');
  if (g.includes('electronic') || g.includes('dance') || g.includes('workout')) moods.add('workout');
  if (g.includes('indie') || g.includes('pop')) moods.add('indie');
  if (g.includes('night') || g.includes('r&b') || g.includes('synth')) moods.add('late-night');
  return Array.from(moods);
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
      };
    };
  }>;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
    status?: { embeddable?: boolean };
    statistics?: { viewCount?: string };
  }>;
}

export async function searchYouTubeMusicCatalog(
  query: string,
  youtubeApiKey: string,
  limit = 10,
): Promise<CloudTrack[]> {
  if (!youtubeApiKey.trim()) return [];

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=${limit}` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(youtubeApiKey.trim())}`;

  const searchData = await cachedFetchJson<YouTubeSearchResponse>(searchUrl);
  const items = (searchData?.items ?? []).filter((item) => item.id?.videoId && item.snippet?.title);
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id!.videoId!).join(',');
  const detailsUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status,statistics&id=${encodeURIComponent(ids)}` +
    `&key=${encodeURIComponent(youtubeApiKey.trim())}`;

  const detailsData = await cachedFetchJson<YouTubeVideosResponse>(detailsUrl);
  const detailById = new Map((detailsData?.items ?? []).map((v) => [v.id, v]));

  return items
    .map((item): CloudTrack | null => {
      const videoId = item.id!.videoId!;
      const detail = detailById.get(videoId);
      if (detail?.status?.embeddable === false) return null;

      const rawTitle = decodeHtmlEntities(item.snippet?.title ?? 'Untitled');
      const channel = decodeHtmlEntities((item.snippet?.channelTitle ?? 'YouTube Music').replace(/ - Topic$/i, ''));
      const parts = rawTitle.split(/\s+-\s+/);
      const artist = parts.length > 1 ? parts[0]!.trim() : channel;
      const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : rawTitle;
      const views = Number(detail?.statistics?.viewCount ?? 0);

      return {
        id: `yt-${videoId}`,
        title,
        artist,
        album: 'YouTube Music Catalog',
        artworkUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        audioUrl: null,
        youtubeVideoId: videoId,
        streamType: 'youtube',
        durationSec: parseIsoDurationToSec(detail?.contentDetails?.duration),
        genres: ['YouTube Music'],
        moods: inferMoods(rawTitle),
        releaseYear: item.snippet?.publishedAt ? Number(item.snippet.publishedAt.slice(0, 4)) : undefined,
        source: 'youtube',
        externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
        popularity: views > 0 ? Math.min(99, Math.round(Math.log10(views + 1) * 11)) : 85,
      };
    })
    .filter((t): t is CloudTrack => t !== null);
}

export async function resolveFullSongViaYouTube(
  artist: string,
  title: string,
  youtubeApiKey: string,
): Promise<{ youtubeVideoId: string; durationSec: number; artworkUrl: string } | null> {
  if (!youtubeApiKey.trim()) return null;
  const results = await searchYouTubeMusicCatalog(`${artist} ${title} official audio`, youtubeApiKey, 3);
  const first = results[0];
  if (!first?.youtubeVideoId) return null;
  return {
    youtubeVideoId: first.youtubeVideoId,
    durationSec: first.durationSec,
    artworkUrl: first.artworkUrl,
  };
}

async function searchAudiusServer(query: string, limit = 10): Promise<CloudTrack[]> {
  const url = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=RiVibe&limit=${limit}`;
  const data = await cachedFetchJson<{
    data?: Array<{
      id?: string;
      title?: string;
      user?: { name?: string };
      genre?: string;
      mood?: string;
      duration?: number;
      play_count?: number;
      artwork?: { '480x480'?: string; '150x150'?: string };
      permalink?: string;
    }>;
  }>(url);

  return (data?.data ?? [])
    .filter((t) => t.id && t.title)
    .map((t) => ({
      id: `audius-${t.id}`,
      title: t.title!,
      artist: t.user?.name || 'Independent Artist',
      album: 'Audius Discovery',
      artworkUrl: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
      audioUrl: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(t.id!)}/stream?app_name=RiVibe`,
      streamType: 'full' as const,
      durationSec: t.duration ?? 210,
      genres: [t.genre || 'Electronic'],
      moods: inferMoods(`${t.genre ?? ''} ${t.mood ?? ''}`),
      source: 'audius',
      externalUrl: t.permalink ? `https://audius.co${t.permalink}` : undefined,
      popularity: t.play_count ? Math.min(98, Math.round(Math.log10(t.play_count + 1) * 18)) : 75,
    }));
}

async function searchDeezerServer(query: string, limit = 10): Promise<CloudTrack[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await cachedFetchJson<{
    data?: Array<{
      id?: number;
      title?: string;
      duration?: number;
      preview?: string;
      artist?: { name?: string };
      album?: { title?: string; cover_big?: string; cover_medium?: string };
    }>;
  }>(url);

  return (data?.data ?? [])
    .filter((d) => d.id && d.title && d.artist?.name)
    .map((d) => ({
      id: `deezer-${d.id}`,
      title: d.title!,
      artist: d.artist!.name!,
      album: d.album?.title || 'Deezer',
      artworkUrl: d.album?.cover_big || d.album?.cover_medium || '',
      audioUrl: d.preview || null,
      streamType: d.preview ? ('preview' as const) : ('none' as const),
      durationSec: d.duration ?? 180,
      genres: ['Pop'],
      moods: ['for-you', 'chill'],
      source: 'deezer',
      popularity: 82,
    }));
}

async function searchItunesServer(query: string, limit = 12): Promise<CloudTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;
  const data = await cachedFetchJson<{
    results?: Array<{
      trackId?: number;
      trackName?: string;
      artistName?: string;
      collectionName?: string;
      artworkUrl100?: string;
      previewUrl?: string;
      trackTimeMillis?: number;
      primaryGenreName?: string;
      releaseDate?: string;
    }>;
  }>(url);

  return (data?.results ?? [])
    .filter((i) => i.trackName && i.artistName)
    .map((i) => ({
      id: `itunes-${i.trackId ?? `${i.artistName}-${i.trackName}`}`,
      title: i.trackName!,
      artist: i.artistName!,
      album: i.collectionName || i.trackName!,
      artworkUrl: (i.artworkUrl100 ?? '').replace('100x100bb', '600x600bb'),
      audioUrl: i.previewUrl || null,
      streamType: i.previewUrl ? ('preview' as const) : ('none' as const),
      durationSec: i.trackTimeMillis ? Math.round(i.trackTimeMillis / 1000) : 180,
      genres: [i.primaryGenreName || 'Pop'],
      moods: inferMoods(i.primaryGenreName || 'Pop'),
      releaseYear: i.releaseDate ? Number(i.releaseDate.slice(0, 4)) : undefined,
      source: 'itunes',
      popularity: 80,
    }));
}

async function searchJamendoServer(query: string, clientId: string, limit = 8): Promise<CloudTrack[]> {
  if (!clientId.trim()) return [];
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo`;
  const data = await cachedFetchJson<{
    results?: Array<{
      id?: string;
      name?: string;
      artist_name?: string;
      album_name?: string;
      duration?: number;
      audio?: string;
      album_image?: string;
      musicinfo?: { tags?: { genres?: string[] } };
    }>;
  }>(url);

  return (data?.results ?? [])
    .filter((r) => r.id && r.name && r.audio)
    .map((r) => ({
      id: `jamendo-${r.id}`,
      title: r.name!,
      artist: r.artist_name || 'Jamendo Artist',
      album: r.album_name || 'Jamendo CC',
      artworkUrl: r.album_image || '',
      audioUrl: r.audio!,
      streamType: 'full' as const,
      durationSec: r.duration ?? 200,
      genres: r.musicinfo?.tags?.genres?.length ? r.musicinfo.tags.genres : ['Indie'],
      moods: inferMoods((r.musicinfo?.tags?.genres ?? []).join(' ')),
      source: 'jamendo',
      popularity: 76,
    }));
}

export async function searchServerCatalog(
  query: string,
  keys: ServerMusicKeys,
  fullOnly = false,
): Promise<CloudTrack[]> {
  const ytKey = keys.youtubeApiKey || process.env.YOUTUBE_API_KEY || '';
  const jamendoKey = keys.jamendoClientId || process.env.JAMENDO_CLIENT_ID || '';

  const [ytTracks, audiusTracks, jamendoTracks, deezerTracks, itunesTracks] = await Promise.all([
    searchYouTubeMusicCatalog(query, ytKey, 10),
    searchAudiusServer(query, 10),
    searchJamendoServer(query, jamendoKey, 8),
    searchDeezerServer(query, 8),
    searchItunesServer(query, 10),
  ]);

  const byKey = new Map<string, CloudTrack>();
  const rank = (t: CloudTrack) =>
    t.streamType === 'full' ? 3 : t.streamType === 'youtube' ? 2 : t.streamType === 'preview' ? 1 : 0;

  for (const list of [ytTracks, audiusTracks, jamendoTracks, deezerTracks, itunesTracks]) {
    for (const track of list) {
      const k = `${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
      const existing = byKey.get(k);
      if (!existing || rank(track) > rank(existing)) {
        byKey.set(k, track);
      }
    }
  }

  const all = Array.from(byKey.values()).sort((a, b) => rank(b) - rank(a));
  return fullOnly ? all.filter((t) => t.streamType === 'full' || t.streamType === 'youtube') : all;
}

export async function fetchServerRecommendations(
  artist: string,
  title: string,
  keys: ServerMusicKeys,
): Promise<CloudTrack[]> {
  const lfmKey = keys.lastfmApiKey || process.env.LASTFM_API_KEY || '';
  const tdKey = keys.tastediveApiKey || process.env.TASTEDIVE_API_KEY || '';
  const ytKey = keys.youtubeApiKey || process.env.YOUTUBE_API_KEY || '';

  const similarQueries: string[] = [];

  if (lfmKey) {
    const lfmUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getSimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&api_key=${encodeURIComponent(lfmKey)}&format=json&limit=6`;
    const lfm = await cachedFetchJson<{
      similartracks?: { track?: Array<{ name?: string; artist?: { name?: string } }> };
    }>(lfmUrl);
    for (const item of (lfm?.similartracks?.track ?? []).slice(0, 3)) {
      if (item.name && item.artist?.name) {
        similarQueries.push(`${item.artist.name} ${item.name}`);
      }
    }
  }

  if (tdKey) {
    const tdUrl = `https://tastedive.com/api/similar?q=${encodeURIComponent(artist)}&type=music&limit=4&k=${encodeURIComponent(tdKey)}`;
    const td = await cachedFetchJson<{ Similar?: { Results?: Array<{ Name?: string }> } }>(tdUrl);
    for (const item of (td?.Similar?.Results ?? []).slice(0, 3)) {
      if (item.Name) similarQueries.push(item.Name);
    }
  }

  if (similarQueries.length === 0) {
    similarQueries.push(`${artist} mix`, `${title} similar`);
  }

  const batches = await Promise.all(
    similarQueries.slice(0, 3).map((q) => searchServerCatalog(q, { ...keys, youtubeApiKey: ytKey }, false)),
  );
  return batches.flat();
}
