import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mswServer';
import {
  fetchArtistSpotlight,
  fetchDiscoveryTracks,
  fetchLyrics,
  fetchPersonalizedRecommendations,
  fetchRadioStations,
  PUBLIC_MUSIC_API_DIRECTORY,
  searchAllMusic,
} from './musicApis';
import {
  __setNativeBridgeAdapterForTests,
  type NativeMusicPluginAdapter,
} from './nativeMusicBridge';
import type { ApiVault, Track } from '../types/music';

const emptyVault: ApiVault = {
  version: 1,
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

describe('musicApis (public-apis#music adapters)', () => {
  beforeEach(() => {
    localStorage.clear();
    __setNativeBridgeAdapterForTests(null);
  });

  it('documents the public-apis#music catalog entries accurately', () => {
    const names = PUBLIC_MUSIC_API_DIRECTORY.map((e) => e.name);
    expect(names).toContain('iTunes Search');
    expect(names).toContain('Audius');
    expect(names).toContain('Last.fm');
    expect(names).toContain('ListenBrainz');
    expect(names).toContain('Radio Browser');
    expect(names).toContain('TheAudioDB');
    expect(names).toContain('Jamendo');
    expect(names).toContain('Lyrics.ovh');
  });

  it('searches iTunes and Audius in parallel and returns normalized tracks with playable audio', async () => {
    const tracks = await searchAllMusic('troye sivan', emptyVault);
    expect(tracks.length).toBeGreaterThanOrEqual(2);

    const itunesTrack = tracks.find((t) => t.source === 'itunes');
    expect(itunesTrack).toBeDefined();
    expect(itunesTrack?.artworkUrl).toContain('600x600bb');
    expect(itunesTrack?.audioUrl).toContain('https://');
    expect(itunesTrack?.streamType).toBe('preview');

    const audiusTrack = tracks.find((t) => t.source === 'audius');
    expect(audiusTrack).toBeDefined();
    expect(audiusTrack?.streamType).toBe('full');
    expect(audiusTrack?.audioUrl).toContain('/tracks/aud-902/stream');
  });

  it('fetches discovery tracks from trending Audius + curated queries + ListenBrainz without throwing on partial error', async () => {
    server.use(
      http.get('https://api.listenbrainz.org/1/explore/fresh-releases/', () => {
        return new HttpResponse(null, { status: 503 });
      }),
    );

    const tracks = await fetchDiscoveryTracks('chill', emptyVault);
    expect(tracks.length).toBeGreaterThan(0);
  });

  it('uses Last.fm track.getSimilar and Jamendo when user configures keys in ApiVault', async () => {
    server.use(
      http.get('https://ws.audioscrobbler.com/2.0/', ({ request }) => {
        const method = new URL(request.url).searchParams.get('method');
        if (method === 'track.getSimilar') {
          return HttpResponse.json({
            similartracks: {
              track: [
                {
                  name: 'Run Away With Me',
                  artist: { name: 'Carly Rae Jepsen' },
                  match: '0.92',
                },
              ],
            },
          });
        }
        return HttpResponse.json({});
      }),
      http.get('https://api.jamendo.com/v3.0/tracks/', () => {
        return HttpResponse.json({
          results: [
            {
              id: 'jam-1',
              name: 'Glass Afternoon',
              artist_name: 'Nora Sun',
              album_name: 'Warm Light',
              duration: 215,
              audio: 'https://jamendo.example/audio.mp3',
              album_image: 'https://jamendo.example/cover.jpg',
              musicinfo: { tags: { genres: ['ambient', 'chill'] } },
            },
          ],
        });
      }),
    );

    const seedTrack: Track = {
      id: 'seed-1',
      title: 'Youth',
      artist: 'Troye Sivan',
      album: 'Blue Neighbourhood',
      artworkUrl: '',
      audioUrl: null,
      streamType: 'none',
      durationSec: 185,
      genres: ['Synth-Pop'],
      moods: ['chill'],
      source: 'itunes',
    };

    const tracks = await fetchPersonalizedRecommendations(seedTrack, 'chill', {
      ...emptyVault,
      lastfmApiKey: 'demo-lfm-key',
      jamendoClientId: 'demo-jam-id',
    });

    expect(tracks.some((t) => t.source === 'jamendo')).toBe(true);
    expect(tracks.some((t) => t.artist === 'Troye Sivan' || t.artist === 'Porter Robinson')).toBe(true);
  });

  it('fetches live internet radio stations, lyrics, and artist spotlight', async () => {
    const stations = await fetchRadioStations('jazz');
    expect(stations.length).toBeGreaterThan(0);
    expect(stations[0]?.streamUrl).toContain('https://');

    const lyrics = await fetchLyrics('Coldplay', 'Yellow');
    expect(lyrics.source).toBe('lyricsovh');
    expect(lyrics.lyrics).toContain('Look at the stars');

    const spotlight = await fetchArtistSpotlight('Troye Sivan', emptyVault);
    expect(spotlight?.name).toBe('Troye Sivan');
    expect(spotlight?.genre).toBe('Synth-Pop');
  });

  it('uses native keyless Android search & LRCLIB fallback lyrics when available', async () => {
    const mockAdapter: NativeMusicPluginAdapter = {
      isNativeAndroid: () => true,
      getCapabilities: async () => ({
        nativeAvailable: true,
        engine: 'media3-exoplayer+innertube',
        innertube: true,
        media3: true,
      }),
      searchCatalog: async () => ({
        tracks: [
          {
            id: 'nativeYt1',
            title: 'Midnight City',
            artist: 'M83',
            album: 'Hurry Up',
            durationSec: 243,
          },
        ],
      }),
      getRecommendations: async () => ({ tracks: [] }),
      resolveStream: async () => {
        throw new Error('unused');
      },
      playTrack: async () => ({
        trackId: 'yt-nativeYt1',
        isPlaying: true,
        currentTime: 0,
        duration: 243,
        isBuffering: false,
      }),
      pause: async () => {},
      resume: async () => {},
      seekTo: async () => {},
      setVolume: async () => {},
      stop: async () => {},
      getPlaybackState: async () => ({
        trackId: 'yt-nativeYt1',
        isPlaying: false,
        currentTime: 0,
        duration: 243,
        isBuffering: false,
      }),
      addListener: async () => ({ remove: async () => {} }),
    };
    __setNativeBridgeAdapterForTests(mockAdapter);

    server.use(
      http.get('https://api.lyrics.ovh/v1/:artist/:title', () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.get('https://lrclib.net/api/get', () => {
        return HttpResponse.json({
          plainLyrics: 'Waiting in a car\nWaiting for a ride in the dark',
          syncedLyrics: '[00:12.40] Waiting in a car\n[00:18.00] Waiting for a ride in the dark',
        });
      }),
    );

    const tracks = await searchAllMusic('M83 Midnight City', emptyVault);
    expect(tracks.some((t) => t.youtubeVideoId === 'nativeYt1' && t.streamType === 'youtube')).toBe(true);

    const lyrics = await fetchLyrics('M83', 'Midnight City');
    expect(lyrics.lyrics).toContain('Waiting in a car');
    expect(lyrics.syncedLines).toHaveLength(2);
    expect(lyrics.syncedLines?.[0]?.timeSec).toBeCloseTo(12.4, 1);
  });

  it('prioritizes genuine similar tracks over unrelated Audius trending songs and excludes seed track', async () => {
    const mockAdapter: NativeMusicPluginAdapter = {
      isNativeAndroid: () => true,
      getCapabilities: async () => ({
        nativeAvailable: true,
        engine: 'media3-exoplayer+innertube',
        innertube: true,
        media3: true,
      }),
      searchCatalog: async () => ({ tracks: [] }),
      getRecommendations: async () => ({
        tracks: [
          {
            id: 'sim-1',
            title: 'Similar Acoustic Song',
            artist: 'Rito Riba',
            youtubeVideoId: 'sim-1',
            durationSec: 205,
          },
        ],
      }),
      resolveStream: async () => {
        throw new Error('unused');
      },
      playTrack: async () => ({
        trackId: 'yt-sim-1',
        isPlaying: true,
        currentTime: 0,
        duration: 205,
        isBuffering: false,
      }),
      pause: async () => {},
      resume: async () => {},
      seekTo: async () => {},
      setVolume: async () => {},
      stop: async () => {},
      getPlaybackState: async () => ({
        trackId: 'yt-sim-1',
        isPlaying: false,
        currentTime: 0,
        duration: 205,
        isBuffering: false,
      }),
      addListener: async () => ({ remove: async () => {} }),
    };
    __setNativeBridgeAdapterForTests(mockAdapter);

    const seed: Track = {
      id: 'yt-ayanam',
      title: 'Ayanam',
      artist: 'Rito Riba, Harshvardhan',
      album: 'Single',
      artworkUrl: '',
      audioUrl: null,
      youtubeVideoId: 'ayanamVid',
      streamType: 'youtube',
      durationSec: 210,
      genres: ['YouTube Music'],
      moods: ['chill'],
      source: 'youtube',
    };

    const recs = await fetchPersonalizedRecommendations(seed, 'all', emptyVault);
    expect(recs[0]?.id).toBe('yt-sim-1');
    expect(recs.some((t) => t.youtubeVideoId === 'ayanamVid')).toBe(false);
  });
});
