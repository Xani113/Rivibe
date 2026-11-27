import type {
  ApiVault,
  ArtistSpotlight,
  LyricsResult,
  MoodId,
  RadioStation,
  Track,
} from '../types/music';
import { SEED_RADIO_STATIONS, SEED_TRACKS } from './seedCatalog';
import { normalizeText } from '../utils/formatTime';
import {
  recommendViaBackend,
  resolveFullSongViaBackend,
  searchMusicViaBackend,
} from './cloudApi';

export interface PublicApiEntry {
  name: string;
  auth: 'No' | 'apiKey' | 'OAuth';
  cors: 'Yes' | 'Unknown';
  role: string;
  docsUrl: string;
  keyField?: keyof ApiVault;
}

export const PUBLIC_MUSIC_API_DIRECTORY: PublicApiEntry[] = [
  {
    name: 'YouTube Data API v3',
    auth: 'apiKey',
    cors: 'Yes',
    role: 'Full-length music catalog search & official YouTube IFrame full-song playback',
    docsUrl: 'https://developers.google.com/youtube/v3',
    keyField: 'youtubeApiKey',
  },
  {
    name: 'iTunes Search',
    auth: 'No',
    cors: 'Yes',
    role: 'Catalog search, album covers & 30s AAC audio previews',
    docsUrl: 'https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/',
  },
  {
    name: 'Audius',
    auth: 'No',
    cors: 'Yes',
    role: 'Full-length independent & electronic audio streams',
    docsUrl: 'https://docs.audius.org/developers/api',
  },
  {
    name: 'ListenBrainz',
    auth: 'No',
    cors: 'Yes',
    role: 'Open fresh releases radar & scrobble discovery',
    docsUrl: 'https://listenbrainz.readthedocs.io/en/latest/users/api/index.html',
  },
  {
    name: 'Radio Browser',
    auth: 'No',
    cors: 'Yes',
    role: 'Live global internet radio streams by mood & genre',
    docsUrl: 'https://api.radio-browser.info/',
  },
  {
    name: 'Lyrics.ovh',
    auth: 'No',
    cors: 'Yes',
    role: 'Instant song lyrics lookup in Now Playing',
    docsUrl: 'https://lyricsovh.docs.apiary.io',
  },
  {
    name: 'Genrenator',
    auth: 'No',
    cors: 'Yes',
    role: 'Surprise genre & vibe roulette seeds',
    docsUrl: 'https://binaryjazz.us/genrenator-api/',
  },
  {
    name: 'TheAudioDB',
    auth: 'apiKey',
    cors: 'Yes',
    role: 'Artist biographies, styles, moods & fanart (default test key: 123)',
    docsUrl: 'https://www.theaudiodb.com/',
    keyField: 'theAudioDbApiKey',
  },
  {
    name: 'Last.fm',
    auth: 'apiKey',
    cors: 'Yes',
    role: 'Spotify-like track.getSimilar, artist.getSimilar & tag top tracks',
    docsUrl: 'https://www.last.fm/api',
    keyField: 'lastfmApiKey',
  },
  {
    name: 'TasteDive',
    auth: 'apiKey',
    cors: 'Unknown',
    role: 'Similar artist recommendation graph (via Next.js server proxy)',
    docsUrl: 'https://tastedive.com/read/api',
    keyField: 'tastediveApiKey',
  },
  {
    name: 'Jamendo',
    auth: 'OAuth',
    cors: 'Yes',
    role: 'Full-length Creative Commons music catalog by mood tag',
    docsUrl: 'https://developer.jamendo.com/v3.0/docs',
    keyField: 'jamendoClientId',
  },
];

const responseCache = new Map<string, { expiresAt: number; data: unknown }>();

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6500): Promise<T | null> {
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

function parseIsoDuration(iso?: string): number {
  if (!iso) return 180;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.trim());
  if (!m) return 180;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : 180;
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
        album: 'YouTube Music Catalog',
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

export async function resolveFullSongTrack(
  track: Track,
  vault: ApiVault,
): Promise<Track> {
  if (track.streamType === 'full' || (track.streamType === 'youtube' && track.youtubeVideoId)) {
    return track;
  }

  // 1. Try Next.js server resolver (handles server-side YOUTUBE_API_KEY cleanly)
  const serverResolved = await resolveFullSongViaBackend(track.artist, track.title, vault);
  if (serverResolved?.youtubeVideoId) {
    return {
      ...track,
      youtubeVideoId: serverResolved.youtubeVideoId,
      streamType: 'youtube',
      durationSec: serverResolved.durationSec,
      artworkUrl: track.artworkUrl || serverResolved.artworkUrl,
    };
  }

  // 2. Fallback to direct browser YouTube Data API v3 key if configured in API Vault
  if (vault.youtubeApiKey.trim()) {
    const ytHits = await searchYouTubeDirect(`${track.artist} ${track.title} official audio`, vault.youtubeApiKey, 2);
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
  collectionId?: number;
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
    album: 'Audius Discovery',
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

interface JamendoTrackItem {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
  audio?: string;
  album_image?: string;
  musicinfo?: { tags?: { genres?: string[] } };
}

export async function searchJamendo(
  query: string,
  clientId: string,
  limit = 10,
): Promise<Track[]> {
  if (!clientId.trim()) return [];
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo`;
  const data = await fetchJsonWithTimeout<{ results?: JamendoTrackItem[] }>(url);
  if (!data?.results) return [];
  return data.results
    .filter((item) => item.id && item.name && item.audio)
    .map((item) => {
      const genres = item.musicinfo?.tags?.genres?.length
        ? item.musicinfo.tags.genres
        : ['Indie'];
      return {
        id: `jamendo-${item.id}`,
        title: item.name!,
        artist: item.artist_name || 'Jamendo Artist',
        album: item.album_name || 'Jamendo CC',
        artworkUrl: item.album_image || '',
        audioUrl: item.audio!,
        streamType: 'full',
        durationSec: item.duration ?? 200,
        genres,
        moods: inferMoodsFromGenre(genres.join(' ')),
        source: 'jamendo',
        popularity: 76,
      };
    });
}

async function fetchLastFmSimilarNames(seedTrack: Track, apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) return [];
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.getSimilar&artist=${encodeURIComponent(seedTrack.artist)}&track=${encodeURIComponent(seedTrack.title)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=8`;
  const data = await fetchJsonWithTimeout<{
    similartracks?: { track?: Array<{ name?: string; artist?: { name?: string } }> };
  }>(url);
  if (!data?.similartracks?.track) return [];
  return data.similartracks.track
    .map((t) => `${t.name ?? ''} ${t.artist?.name ?? ''}`.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function fetchTasteDiveSimilarArtists(artist: string, apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) return [];
  const url = `https://tastedive.com/api/similar?q=${encodeURIComponent(artist)}&type=music&limit=5&k=${encodeURIComponent(apiKey)}`;
  const data = await fetchJsonWithTimeout<{
    Similar?: { Results?: Array<{ Name?: string }> };
  }>(url);
  return (data?.Similar?.Results ?? [])
    .map((r) => r.Name ?? '')
    .filter(Boolean)
    .slice(0, 4);
}

export async function fetchListenBrainzFreshCount(): Promise<Array<{ title: string; artist: string }>> {
  const url = 'https://api.listenbrainz.org/1/explore/fresh-releases/?days=7';
  const data = await fetchJsonWithTimeout<{
    payload?: { releases?: Array<{ release_name?: string; artist_credit_name?: string }> };
  }>(url, 5000);
  return (data?.payload?.releases ?? [])
    .slice(0, 6)
    .map((r) => ({
      title: r.release_name ?? '',
      artist: r.artist_credit_name ?? '',
    }))
    .filter((r) => r.title && r.artist);
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

  const backendTracks = await searchMusicViaBackend(trimmed, fullOnly, vault);
  if (backendTracks && backendTracks.length > 0) {
    return backendTracks;
  }

  const [ytTracks, audiusTracks, jamendoTracks, itunesTracks] = await Promise.all([
    searchYouTubeDirect(trimmed, vault.youtubeApiKey, 10),
    searchAudius(trimmed, 10),
    searchJamendo(trimmed, vault.jamendoClientId, 8),
    fullOnly ? Promise.resolve([]) : searchItunes(trimmed, 14),
  ]);

  const merged = mergeAndDeduplicateTracks(
    [ytTracks, audiusTracks, jamendoTracks, itunesTracks],
    fullOnly,
  );
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

  const [ytTracks, audiusTrending, jamendo, itunes, freshLb] = await Promise.all([
    searchYouTubeDirect(query, vault.youtubeApiKey, 8),
    fetchAudiusTrending(12),
    searchJamendo(query, vault.jamendoClientId, 8),
    fullOnly ? Promise.resolve([]) : searchItunes(query, 12),
    fetchListenBrainzFreshCount(),
  ]);

  const lbLookup = !fullOnly && freshLb[0]
    ? await searchItunes(`${freshLb[0].artist} ${freshLb[0].title}`, 3)
    : [];

  return mergeAndDeduplicateTracks(
    [ytTracks, audiusTrending, jamendo, itunes, lbLookup, SEED_TRACKS],
    fullOnly,
  );
}

export async function fetchPersonalizedRecommendations(
  seedTrack: Track,
  mood: MoodId,
  vault: ApiVault,
  fullOnly = false,
): Promise<Track[]> {
  const backendRecs = await recommendViaBackend(seedTrack.artist, seedTrack.title, vault);

  const [lastfmQueries, tastediveArtists, ytMatches, audiusMatches, jamendoMatches, genreTracks] =
    await Promise.all([
      fetchLastFmSimilarNames(seedTrack, vault.lastfmApiKey),
      fetchTasteDiveSimilarArtists(seedTrack.artist, vault.tastediveApiKey),
      searchYouTubeDirect(`${seedTrack.artist} ${seedTrack.title} mix`, vault.youtubeApiKey, 6),
      searchAudius(seedTrack.genres[0] ?? seedTrack.artist, 8),
      searchJamendo(seedTrack.genres[0] ?? 'chill', vault.jamendoClientId, 8),
      fullOnly ? Promise.resolve([]) : searchItunes(`${seedTrack.genres[0] ?? 'electronic'} ${seedTrack.artist}`, 10),
    ]);

  const extraQueries = [...lastfmQueries.slice(0, 2), ...tastediveArtists.slice(0, 2)];
  const extraResults = await Promise.all(
    extraQueries.map((q) => (fullOnly ? searchAudius(q, 4) : searchItunes(q, 4))),
  );

  const discoveryFallback = await fetchDiscoveryTracks(mood, vault, fullOnly);

  return mergeAndDeduplicateTracks(
    [
      backendRecs ?? [],
      ytMatches,
      audiusMatches,
      jamendoMatches,
      ...extraResults,
      genreTracks,
      discoveryFallback,
    ],
    fullOnly,
  );
}

interface RadioBrowserRaw {
  stationuuid?: string;
  name?: string;
  url_resolved?: string;
  url?: string;
  favicon?: string;
  country?: string;
  tags?: string;
  bitrate?: number;
  votes?: number;
}

export async function fetchRadioStations(tagOrQuery = ''): Promise<RadioStation[]> {
  const trimmed = tagOrQuery.trim();
  const url = trimmed
    ? `https://de1.api.radio-browser.info/json/stations/search?tag=${encodeURIComponent(trimmed)}&limit=18&hidebroken=true&order=votes&reverse=true`
    : 'https://de1.api.radio-browser.info/json/stations/topvote/18';

  const data = await fetchJsonWithTimeout<RadioBrowserRaw[]>(url);
  if (!data || data.length === 0) return SEED_RADIO_STATIONS;

  const stations = data
    .filter((s) => s.stationuuid && s.name && (s.url_resolved || s.url))
    .map((s) => ({
      id: s.stationuuid!,
      name: s.name!.trim(),
      streamUrl: (s.url_resolved || s.url)!,
      favicon: s.favicon || '',
      country: s.country || 'Global',
      tags: (s.tags || 'music')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 4),
      bitrate: s.bitrate ?? 128,
      votes: s.votes ?? 0,
    }));

  return stations.length > 0 ? stations : SEED_RADIO_STATIONS;
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
  return {
    artist,
    title,
    lyrics: 'Lyrics are not available for this track right now.',
    source: 'unavailable',
  };
}

export async function fetchArtistSpotlight(
  artistName: string,
  vault: ApiVault,
): Promise<ArtistSpotlight | null> {
  const key = encodeURIComponent(vault.theAudioDbApiKey || '123');
  const url = `https://www.theaudiodb.com/api/v1/json/${key}/search.php?s=${encodeURIComponent(artistName)}`;
  const data = await fetchJsonWithTimeout<{
    artists?: Array<{
      strArtist?: string;
      strGenre?: string;
      strMood?: string;
      strStyle?: string;
      strBiographyEN?: string;
      strArtistBanner?: string;
      strArtistThumb?: string;
      intFormedYear?: string;
      strCountry?: string;
    }> | null;
  }>(url);

  const first = data?.artists?.[0];
  if (!first?.strArtist) return null;

  return {
    name: first.strArtist,
    genre: first.strGenre || 'Mixed',
    mood: first.strMood || 'Atmospheric',
    style: first.strStyle || 'Contemporary',
    biography: first.strBiographyEN || '',
    bannerUrl: first.strArtistBanner || '',
    thumbUrl: first.strArtistThumb || '',
    formedYear: first.intFormedYear || undefined,
    country: first.strCountry || undefined,
  };
}

export async function fetchSerendipitousGenre(): Promise<string> {
  const result = await fetchJsonWithTimeout<string>(
    'https://binaryjazz.us/wp-json/genrenator/v1/genre/',
    4000,
  );
  return typeof result === 'string' && result.trim() ? result.trim() : 'ambient synth pop';
}
