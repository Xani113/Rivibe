import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryProvider } from './LibraryContext';
import { PlayerProvider, usePlayer } from './PlayerContext';
import {
  __setNativeBridgeAdapterForTests,
  type NativeMusicPluginAdapter,
} from '../services/nativeMusicBridge';
import type { Track } from '../types/music';

const testTracks: Track[] = [
  {
    id: 'trk-1',
    title: 'Blue Neighbourhood',
    artist: 'Troye Sivan',
    album: 'Blue Neighbourhood',
    artworkUrl: 'https://example.com/1.jpg',
    audioUrl: 'https://example.com/1.m4a',
    streamType: 'preview',
    durationSec: 185,
    genres: ['Synth-Pop'],
    moods: ['chill'],
    source: 'itunes',
  },
  {
    id: 'trk-2',
    title: 'Shelter',
    artist: 'Porter Robinson',
    album: 'Worlds Live',
    artworkUrl: 'https://example.com/2.jpg',
    audioUrl: 'https://example.com/2.m4a',
    streamType: 'full',
    durationSec: 219,
    genres: ['Electronic'],
    moods: ['focus'],
    source: 'audius',
  },
];

function PlayerHarness() {
  const {
    currentTrack,
    activeYoutubeVideoId,
    isPlaying,
    duration,
    queue,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
  } = usePlayer();

  return (
    <div>
      <div data-testid="now-title">{currentTrack?.title ?? 'none'}</div>
      <div data-testid="now-stream">{currentTrack?.streamType ?? 'none'}</div>
      <div data-testid="now-yt">{activeYoutubeVideoId ?? 'none'}</div>
      <div data-testid="now-dur">{duration}</div>
      <div data-testid="play-state">{isPlaying ? 'playing' : 'paused'}</div>
      <div data-testid="queue-len">{queue.length}</div>
      <button onClick={() => void playTrack(testTracks[0]!, testTracks)}>Play First</button>
      <button onClick={() => void togglePlay()}>Toggle</button>
      <button onClick={() => void nextTrack()}>Next</button>
      <button onClick={() => void prevTrack()}>Prev</button>
      <button onClick={() => seekTo(45)}>Seek 45</button>
    </div>
  );
}

describe('PlayerContext', () => {
  beforeEach(() => {
    __setNativeBridgeAdapterForTests(null);
  });

  it('promotes initial default track to a live full-length stream when catalog loads', async () => {
    render(
      <LibraryProvider>
        <PlayerProvider>
          <PlayerHarness />
        </PlayerProvider>
      </LibraryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('now-stream')).toHaveTextContent('full');
    });
    expect(Number(screen.getByTestId('now-dur').textContent)).toBeGreaterThan(60);
  });

  it('starts playback, navigates next/previous, and toggles pause', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <PlayerHarness />
        </PlayerProvider>
      </LibraryProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play First' }));
    expect(screen.getByTestId('now-title')).toHaveTextContent('Blue Neighbourhood');
    expect(screen.getByTestId('play-state')).toHaveTextContent('playing');
    expect(Number(screen.getByTestId('queue-len').textContent)).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('now-title')).toHaveTextContent('Shelter');

    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(screen.getByTestId('now-title')).toHaveTextContent('Blue Neighbourhood');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
    });
    expect(screen.getByTestId('play-state')).toHaveTextContent('paused');
  });

  it('plays full-length songs via Android ExoPlayer without YouTube iframe when native plugin is active', async () => {
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
            id: 'nativeVid123',
            title: 'Blue Neighbourhood',
            artist: 'Troye Sivan',
            youtubeVideoId: 'nativeVid123',
            durationSec: 218,
          },
        ],
      }),
      getRecommendations: vi.fn().mockResolvedValue({ tracks: [] }),
      resolveStream: vi.fn(),
      playTrack: vi.fn().mockResolvedValue({
        trackId: 'yt-nativeVid123',
        isPlaying: true,
        currentTime: 0,
        duration: 218,
        isBuffering: false,
      }),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      seekTo: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getPlaybackState: vi.fn().mockResolvedValue({
        trackId: 'yt-nativeVid123',
        isPlaying: true,
        currentTime: 0,
        duration: 218,
        isBuffering: false,
      }),
      addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    };

    __setNativeBridgeAdapterForTests(mockAdapter);
    const user = userEvent.setup();

    render(
      <LibraryProvider>
        <PlayerProvider>
          <PlayerHarness />
        </PlayerProvider>
      </LibraryProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play First' }));

    await waitFor(() => {
      expect(mockAdapter.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeVideoId: 'nativeVid123',
          title: 'Blue Neighbourhood',
        }),
      );
    });
    expect(screen.getByTestId('now-yt')).toHaveTextContent('none');
    expect(screen.getByTestId('now-stream')).toHaveTextContent('youtube');
    expect(screen.getByTestId('play-state')).toHaveTextContent('playing');

    await user.click(screen.getByRole('button', { name: 'Seek 45' }));
    expect(mockAdapter.seekTo).toHaveBeenCalledWith({ positionSec: 45 });

    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(mockAdapter.pause).toHaveBeenCalled();
  });
});
