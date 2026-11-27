import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isNativeAndroidPlaybackAvailable,
  normalizeNativeTrack,
  searchNativeCatalog,
  fetchNativeRecommendations,
  resolveNativeStream,
  __setNativeBridgeAdapterForTests,
  type NativeMusicPluginAdapter,
} from './nativeMusicBridge';

describe('nativeMusicBridge (TDD)', () => {
  beforeEach(() => {
    __setNativeBridgeAdapterForTests(null);
  });

  it('reports unavailable on standard web / browser environments', () => {
    expect(isNativeAndroidPlaybackAvailable()).toBe(false);
  });

  it('detects Android native plugin adapter and searches keyless YouTube Music catalog', async () => {
    const mockAdapter: NativeMusicPluginAdapter = {
      isNativeAndroid: () => true,
      getCapabilities: vi.fn().mockResolvedValue({
        nativeAvailable: true,
        engine: 'media3-exoplayer+innertube',
        innertube: true,
        media3: true,
      }),
      searchCatalog: vi.fn().mockResolvedValue({
        tracks: [
          {
            id: 'dQw4w9WgXcQ',
            title: 'Blue Neighbourhood',
            artist: 'Troye Sivan',
            album: 'Blue Neighbourhood (Deluxe)',
            artworkUrl: 'https://lh3.googleusercontent.com/art=w540-h540-l90-rj',
            youtubeVideoId: 'dQw4w9WgXcQ',
            durationSec: 215,
            genres: ['Synth-Pop'],
            moods: ['chill', 'for-you'],
            source: 'youtube',
            externalUrl: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
          },
        ],
      }),
      getRecommendations: vi.fn().mockResolvedValue({ tracks: [] }),
      resolveStream: vi.fn(),
      playTrack: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      seekTo: vi.fn(),
      setVolume: vi.fn(),
      stop: vi.fn(),
      getPlaybackState: vi.fn(),
      addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    };

    __setNativeBridgeAdapterForTests(mockAdapter);
    expect(isNativeAndroidPlaybackAvailable()).toBe(true);

    const results = await searchNativeCatalog('Troye Sivan', 8);
    expect(mockAdapter.searchCatalog).toHaveBeenCalledWith({
      query: 'Troye Sivan',
      limit: 8,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'yt-dQw4w9WgXcQ',
      title: 'Blue Neighbourhood',
      artist: 'Troye Sivan',
      youtubeVideoId: 'dQw4w9WgXcQ',
      streamType: 'youtube',
      source: 'youtube',
      durationSec: 215,
    });
  });

  it('normalizes native DTOs safely when optional fields are missing', () => {
    const track = normalizeNativeTrack({
      id: 'abc123xyz',
      title: 'Nightwalk',
      artist: 'Neon Drift',
    });

    expect(track.id).toBe('yt-abc123xyz');
    expect(track.youtubeVideoId).toBe('abc123xyz');
    expect(track.artworkUrl).toBe('https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg');
    expect(track.durationSec).toBe(200);
    expect(track.streamType).toBe('youtube');
  });

  it('fetches native recommendations and stream metadata when Android plugin responds', async () => {
    const mockAdapter: NativeMusicPluginAdapter = {
      isNativeAndroid: () => true,
      getCapabilities: vi.fn().mockResolvedValue({
        nativeAvailable: true,
        engine: 'media3-exoplayer+innertube',
        innertube: true,
        media3: true,
      }),
      searchCatalog: vi.fn().mockResolvedValue({ tracks: [] }),
      getRecommendations: vi.fn().mockResolvedValue({
        tracks: [
          {
            id: 'rec-vid-1',
            title: 'FOOLS',
            artist: 'Troye Sivan',
            durationSec: 221,
          },
        ],
      }),
      resolveStream: vi.fn().mockResolvedValue({
        streamUrl: 'https://rr1---sn.googlevideo.com/videoplayback?mime=audio/webm',
        mimeType: 'audio/webm',
        bitrate: 131072,
        durationSec: 221,
        clientName: 'IOS',
        expiresAtMs: Date.now() + 3_600_000,
      }),
      playTrack: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      seekTo: vi.fn(),
      setVolume: vi.fn(),
      stop: vi.fn(),
      getPlaybackState: vi.fn(),
      addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    };

    __setNativeBridgeAdapterForTests(mockAdapter);

    const recs = await fetchNativeRecommendations({
      videoId: 'seed-1',
      artist: 'Troye Sivan',
      title: 'Youth',
      mood: 'chill',
      limit: 12,
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]?.title).toBe('FOOLS');

    const stream = await resolveNativeStream('seed-1');
    expect(stream?.streamUrl).toContain('googlevideo.com');
    expect(stream?.clientName).toBe('IOS');
  });
});
