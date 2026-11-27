import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseIsoDurationToSec, resolveFullSongViaYouTube, searchServerCatalog } from './musicProxy';

describe('musicProxy (YouTube Data API v3 + public-apis#music)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses YouTube ISO-8601 durations accurately', () => {
    expect(parseIsoDurationToSec('PT3M42S')).toBe(222);
    expect(parseIsoDurationToSec('PT1H2M5S')).toBe(3725);
    expect(parseIsoDurationToSec('PT45S')).toBe(45);
    expect(parseIsoDurationToSec('invalid')).toBe(180);
  });

  it('merges YouTube Data API v3 full tracks with Audius and Deezer when YOUTUBE_API_KEY is supplied', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('youtube/v3/search')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: { videoId: 'yt-full-1' },
                snippet: {
                  title: 'Troye Sivan - Youth (Official Audio)',
                  channelTitle: 'Troye Sivan',
                  publishedAt: '2015-11-13T00:00:00Z',
                  thumbnails: { high: { url: 'https://i.ytimg.com/vi/yt-full-1/hqdefault.jpg' } },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('youtube/v3/videos')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'yt-full-1',
                contentDetails: { duration: 'PT3M18S' },
                status: { embeddable: true },
                statistics: { viewCount: '120000000' },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('audius.co')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'aud-1',
                title: 'Warm Echoes',
                user: { name: 'Indie Synth' },
                genre: 'Electronic',
                duration: 240,
                artwork: { '480x480': 'https://audius.example/art.jpg' },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('api.deezer.com')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes('itunes.apple.com')) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const results = await searchServerCatalog('Troye Sivan Youth', {
      youtubeApiKey: 'test-yt-key',
    });

    const ytTrack = results.find((t) => t.source === 'youtube');
    expect(ytTrack).toBeDefined();
    expect(ytTrack?.streamType).toBe('youtube');
    expect(ytTrack?.youtubeVideoId).toBe('yt-full-1');
    expect(ytTrack?.durationSec).toBe(198);

    const audTrack = results.find((t) => t.source === 'audius');
    expect(audTrack?.streamType).toBe('full');
  });

  it('resolves a full YouTube videoId for an existing track', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('youtube/v3/search')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: { videoId: 'yt-res-99' },
                snippet: {
                  title: 'Miles Davis - Bitches Brew',
                  channelTitle: 'Miles Davis',
                  thumbnails: { high: { url: 'https://i.ytimg.com/vi/yt-res-99/hqdefault.jpg' } },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('youtube/v3/videos')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'yt-res-99',
                contentDetails: { duration: 'PT4M50S' },
                status: { embeddable: true },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);
    const resolved = await resolveFullSongViaYouTube('Miles Davis', 'Bitches Brew', 'test-yt-key');
    expect(resolved?.youtubeVideoId).toBe('yt-res-99');
    expect(resolved?.durationSec).toBe(290);
  });
});
