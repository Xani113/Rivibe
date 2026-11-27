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
  githubRepoUrl: 'https://github.com/xani13/rivibe',
  backendUrl: '',
};

describe('musicApis (public-apis#music adapters)', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
