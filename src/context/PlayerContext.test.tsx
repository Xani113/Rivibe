import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryProvider } from './LibraryContext';
import { PlayerProvider, usePlayer } from './PlayerContext';
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
    isPlaying,
    queue,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
  } = usePlayer();

  return (
    <div>
      <div data-testid="now-title">{currentTrack?.title ?? 'none'}</div>
      <div data-testid="play-state">{isPlaying ? 'playing' : 'paused'}</div>
      <div data-testid="queue-len">{queue.length}</div>
      <button onClick={() => playTrack(testTracks[0]!, testTracks)}>Play First</button>
      <button onClick={togglePlay}>Toggle</button>
      <button onClick={() => void nextTrack()}>Next</button>
      <button onClick={prevTrack}>Prev</button>
    </div>
  );
}

describe('PlayerContext', () => {
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
});
