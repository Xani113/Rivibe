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

const extraTrack: Track = {
  id: 'trk-3',
  title: 'Midnight City',
  artist: 'M83',
  album: 'Hurry Up',
  artworkUrl: 'https://example.com/3.jpg',
  audioUrl: 'https://example.com/3.m4a',
  streamType: 'full',
  durationSec: 244,
  genres: ['Electronic'],
  moods: ['late-night'],
  source: 'audius',
};

const fourthTrack: Track = {
  id: 'trk-4',
  title: 'So What',
  artist: 'Miles Davis',
  album: 'Kind of Blue',
  artworkUrl: 'https://example.com/4.jpg',
  audioUrl: 'https://example.com/4.m4a',
  streamType: 'full',
  durationSec: 260,
  genres: ['Jazz'],
  moods: ['jazz'],
  source: 'audius',
};

function PlayerHarness() {
  const {
    currentTrack,
    activeYoutubeVideoId,
    isPlaying,
    duration,
    queue,
    queueIndex,
    shuffle,
    repeatMode,
    queueToast,
    playTrack,
    addToQueue,
    playNext,
    removeFromQueue,
    moveQueueItem,
    clearUpcomingQueue,
    toggleShuffle,
    cycleRepeatMode,
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
      <div data-testid="queue-idx">{queueIndex}</div>
      <div data-testid="queue-ids">{queue.map((t) => t.id).join(',')}</div>
      <div data-testid="shuffle-state">{String(shuffle)}</div>
      <div data-testid="repeat-state">{repeatMode}</div>
      <div data-testid="queue-toast">{queueToast ?? ''}</div>

      <button onClick={() => void playTrack(testTracks[0]!, testTracks)}>Play First</button>
      <button onClick={() => void playTrack(testTracks[0]!, [testTracks[0]!], { appendSimilar: true })}>
        Play Isolated With Similar
      </button>
      <button onClick={() => addToQueue(extraTrack)}>Add Third To Queue</button>
      <button onClick={() => playNext(fourthTrack)}>Play Fourth Next</button>
      <button onClick={() => removeFromQueue(0)}>Remove Index 0</button>
      <button onClick={() => removeFromQueue(1)}>Remove Index 1</button>
      <button onClick={() => moveQueueItem(2, 1)}>Move 2 To 1</button>
      <button onClick={() => clearUpcomingQueue()}>Clear Queue</button>
      <button onClick={toggleShuffle}>Shuffle</button>
      <button onClick={cycleRepeatMode}>Repeat</button>
      <button onClick={() => void togglePlay()}>Toggle</button>
      <button onClick={() => void nextTrack()}>Next</button>
      <button onClick={() => void prevTrack()}>Prev</button>
      <button onClick={() => seekTo(45)}>Seek 45</button>
    </div>
  );
}

describe('PlayerContext & Queue Engine', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('supports addToQueue, playNext, reordering, removing before/at/after current index, and clearing queue', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <PlayerHarness />
        </PlayerProvider>
      </LibraryProvider>,
    );

    // Start 2-track queue at index 0: [trk-1, trk-2]
    await user.click(screen.getByRole('button', { name: 'Play First' }));
    expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-1,trk-2');

    // Add trk-3 to end -> [trk-1, trk-2, trk-3]
    await user.click(screen.getByRole('button', { name: 'Add Third To Queue' }));
    expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-1,trk-2,trk-3');
    expect(screen.getByTestId('queue-toast')).toHaveTextContent(/Midnight City/i);

    // Play Next trk-4 -> inserts after index 0 -> [trk-1, trk-4, trk-2, trk-3]
    await user.click(screen.getByRole('button', { name: 'Play Fourth Next' }));
    expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-1,trk-4,trk-2,trk-3');

    // Advance to index 1 (trk-4)
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('now-title')).toHaveTextContent('So What');
    expect(screen.getByTestId('queue-idx')).toHaveTextContent('1');

    // Remove index 0 (before current): queueIndex decrements to 0, still playing trk-4!
    await user.click(screen.getByRole('button', { name: 'Remove Index 0' }));
    expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-4,trk-2,trk-3');
    expect(screen.getByTestId('queue-idx')).toHaveTextContent('0');
    expect(screen.getByTestId('now-title')).toHaveTextContent('So What');

    // Reorder index 2 -> 1 -> [trk-4, trk-3, trk-2]
    await user.click(screen.getByRole('button', { name: 'Move 2 To 1' }));
    expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-4,trk-3,trk-2');

    // Remove currently playing index 0 -> advances cleanly to trk-3!
    await user.click(screen.getByRole('button', { name: 'Remove Index 0' }));
    await waitFor(() => {
      expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-3,trk-2');
      expect(screen.getByTestId('now-title')).toHaveTextContent('Midnight City');
    });

    // Clear upcoming leaves active song
    await user.click(screen.getByRole('button', { name: 'Clear Queue' }));
    expect(screen.getByTestId('queue-ids')).toHaveTextContent('trk-3');

    // Remove last item empties queue
    await user.click(screen.getByRole('button', { name: 'Remove Index 0' }));
    expect(screen.getByTestId('queue-len')).toHaveTextContent('0');
    expect(screen.getByTestId('now-title')).toHaveTextContent('none');

    // Shuffle and Repeat cycling
    await user.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(screen.getByTestId('shuffle-state')).toHaveTextContent('true');

    await user.click(screen.getByRole('button', { name: 'Repeat' }));
    expect(screen.getByTestId('repeat-state')).toHaveTextContent('all');
    await user.click(screen.getByRole('button', { name: 'Repeat' }));
    expect(screen.getByTestId('repeat-state')).toHaveTextContent('one');
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

  it('handles native Media3 notification Next/Previous transport events cleanly', async () => {
    const listeners = new Map<string, () => void>();
    const mockAdapter: NativeMusicPluginAdapter = {
      isNativeAndroid: () => true,
      getCapabilities: vi.fn().mockResolvedValue({
        nativeAvailable: true,
        engine: 'media3-exoplayer+innertube',
        innertube: true,
        media3: true,
      }),
      searchCatalog: vi.fn().mockResolvedValue({ tracks: [] }),
      getRecommendations: vi.fn().mockResolvedValue({ tracks: [] }),
      resolveStream: vi.fn(),
      playTrack: vi.fn().mockResolvedValue({
        trackId: 'trk-1',
        isPlaying: true,
        currentTime: 0,
        duration: 185,
        isBuffering: false,
      }),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      seekTo: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getPlaybackState: vi.fn().mockResolvedValue({
        trackId: 'trk-1',
        isPlaying: true,
        currentTime: 0,
        duration: 185,
        isBuffering: false,
      }),
      addListener: vi.fn().mockImplementation((name: string, cb: () => void) => {
        listeners.set(name, cb);
        return Promise.resolve({ remove: vi.fn() });
      }),
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
    expect(screen.getByTestId('now-title')).toHaveTextContent('Blue Neighbourhood');

    act(() => {
      listeners.get('mediaNext')?.();
    });
    await waitFor(() => {
      expect(screen.getByTestId('now-title')).toHaveTextContent('Shelter');
    });

    act(() => {
      listeners.get('mediaPrevious')?.();
    });
    await waitFor(() => {
      expect(screen.getByTestId('now-title')).toHaveTextContent('Blue Neighbourhood');
    });
  });

  it('auto-populates Up Next queue with similar recommendations when playing an isolated search track', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <PlayerHarness />
        </PlayerProvider>
      </LibraryProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play Isolated With Similar' }));

    await waitFor(() => {
      expect(Number(screen.getByTestId('queue-len').textContent)).toBeGreaterThan(1);
    });
    expect(screen.getByTestId('now-title')).toHaveTextContent('Blue Neighbourhood');
  });
});
