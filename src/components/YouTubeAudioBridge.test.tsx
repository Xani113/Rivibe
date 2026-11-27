import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YouTubeAudioBridge } from './YouTubeAudioBridge';

describe('YouTubeAudioBridge regression tests', () => {
  const mockPlayer = {
    loadVideoById: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    mute: vi.fn(),
    unMute: vi.fn(),
    getCurrentTime: vi.fn(() => 42),
    getDuration: vi.fn(() => 215),
    destroy: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.YT = {
      Player: vi.fn(function (_el, options) {
        options.events?.onReady?.({ target: mockPlayer });
        return mockPlayer;
      }) as unknown as NonNullable<typeof window.YT>['Player'],
    };
  });

  it('does NOT reload videoId when toggling play/pause or changing volume', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <YouTubeAudioBridge
        videoId="vid-full-1"
        trackTitle="Full Track"
        isPlaying={true}
        volume={0.8}
        isMuted={false}
        seekTargetSec={null}
        onProgress={vi.fn()}
        onStateSync={vi.fn()}
        onEnded={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(window.YT?.Player).toHaveBeenCalledTimes(1);
    });
    expect(mockPlayer.loadVideoById).not.toHaveBeenCalled();

    // Pause, adjust volume, and resume -> must call pauseVideo/playVideo, NEVER reload videoId
    rerender(
      <YouTubeAudioBridge
        videoId="vid-full-1"
        trackTitle="Full Track"
        isPlaying={false}
        volume={0.5}
        isMuted={false}
        seekTargetSec={null}
        onProgress={vi.fn()}
        onStateSync={vi.fn()}
        onEnded={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(mockPlayer.pauseVideo).toHaveBeenCalled();
    expect(mockPlayer.loadVideoById).not.toHaveBeenCalled();

    rerender(
      <YouTubeAudioBridge
        videoId="vid-full-1"
        trackTitle="Full Track"
        isPlaying={true}
        volume={0.5}
        isMuted={false}
        seekTargetSec={null}
        onProgress={vi.fn()}
        onStateSync={vi.fn()}
        onEnded={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(mockPlayer.playVideo).toHaveBeenCalled();
    expect(mockPlayer.loadVideoById).not.toHaveBeenCalled();

    // Switching to a NEW videoId DOES call loadVideoById once
    act(() => {
      rerender(
        <YouTubeAudioBridge
          videoId="vid-full-2"
          trackTitle="Second Full Track"
          isPlaying={true}
          volume={0.5}
          isMuted={false}
          seekTargetSec={null}
          onProgress={vi.fn()}
          onStateSync={vi.fn()}
          onEnded={vi.fn()}
          onError={vi.fn()}
        />,
      );
    });
    await waitFor(() => {
      expect(mockPlayer.loadVideoById).toHaveBeenCalledWith('vid-full-2');
    });

    // Minimize/expand button works accessibly
    await user.click(screen.getByRole('button', { name: /minimize youtube player/i }));
    expect(screen.getByRole('button', { name: /expand youtube player/i })).toBeInTheDocument();
  });
});
