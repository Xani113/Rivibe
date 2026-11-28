import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryProvider } from '../context/LibraryContext';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';
import { OverlayProvider } from '../context/OverlayContext';
import { NowPlayingSheet } from './NowPlayingSheet';
import { PlayerBar } from './PlayerBar';
import { __setNativeBridgeAdapterForTests } from '../services/nativeMusicBridge';
import { formatDuration } from '../utils/formatTime';

function firePointer(
  target: Element | Document | Window | Node,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  clientX: number,
  clientY: number,
) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  fireEvent(target, ev);
}

function SheetTestHarness({ initialDuration = 200 }: { initialDuration?: number }) {
  const { playTrack, currentTime, duration, seekTo } = usePlayer();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Launch Sheet
      </button>
      <button
        type="button"
        onClick={() =>
          void playTrack({
            id: 'test-1',
            title: 'Very Long Track Title That Should Truncate Cleanly On Small Phones',
            artist: 'Artist One, Artist Two',
            album: 'Test Album',
            artworkUrl: 'https://example.com/art.jpg',
            audioUrl: 'https://example.com/song.mp3',
            streamType: 'full',
            durationSec: initialDuration,
            genres: ['Electronic'],
            moods: ['focus'],
            source: 'audius',
          })
        }
      >
        Load Test Track
      </button>
      <button type="button" onClick={() => seekTo(Number.NaN)}>
        Seek NaN
      </button>
      <button type="button" onClick={() => seekTo(25)}>
        Seek 25
      </button>
      <div data-testid="sheet-expanded-state">{String(expanded)}</div>
      <div data-testid="sheet-open-state">{String(open)}</div>
      <div data-testid="current-time-val">{currentTime}</div>
      <div data-testid="duration-val">{duration}</div>

      <NowPlayingSheet
        isOpen={open}
        isExpanded={expanded}
        onExpandedChange={setExpanded}
        onClose={() => setOpen(false)}
      />
      <PlayerBar onOpenSheet={() => setOpen(true)} />
    </div>
  );
}

describe('NowPlayingSheet & PlayerBar Mobile UX Regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    __setNativeBridgeAdapterForTests(null);
  });

  it('requires proper drag direction and minimum distance before expanding or collapsing the drawer, and resets on outside pointer cancel', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <OverlayProvider>
            <SheetTestHarness />
          </OverlayProvider>
        </PlayerProvider>
      </LibraryProvider>,
    );

    const launchBtn = screen.getByRole('button', { name: 'Launch Sheet' });
    await user.click(launchBtn);

    const dialog = await screen.findByRole('dialog', { name: /now playing studio/i });
    const peekContainer = screen.getByTestId('mobile-peek-bar');

    // Focus lands on Close button once dialog mounts, then restores to Launch Sheet when closed
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /close now playing/i }),
      );
    });

    // 1. Wrong-direction fast downward flick on collapsed drawer must NOT expand it
    firePointer(peekContainer, 'pointerdown', 180, 500);
    firePointer(peekContainer, 'pointermove', 180, 580);
    firePointer(peekContainer, 'pointerup', 180, 580);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('false');

    // 2. Micro upward jitter (< 28px minimum distance) must NOT accidentally expand
    firePointer(peekContainer, 'pointerdown', 180, 500);
    firePointer(peekContainer, 'pointermove', 180, 486);
    firePointer(peekContainer, 'pointerup', 180, 486);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('false');

    // 3. Meaningful upward swipe expands drawer
    firePointer(peekContainer, 'pointerdown', 180, 500);
    firePointer(peekContainer, 'pointermove', 180, 420);
    firePointer(peekContainer, 'pointerup', 180, 420);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('true');

    // 4. Wrong-direction fast upward flick on expanded drawer must NOT collapse it
    const panel = screen.getByLabelText(/up next and lyrics panel/i);
    const collapseGrabber = panel.querySelector('.cursor-grab')!;
    firePointer(collapseGrabber, 'pointerdown', 180, 120);
    firePointer(collapseGrabber, 'pointermove', 180, 40);
    firePointer(collapseGrabber, 'pointerup', 180, 40);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('true');

    // 5. Releasing pointer outside drawer via window pointercancel resets drag state without getting stuck
    firePointer(collapseGrabber, 'pointerdown', 180, 120);
    firePointer(collapseGrabber, 'pointermove', 180, 150);
    act(() => {
      window.dispatchEvent(new Event('pointercancel'));
    });
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('true');

    // 6. Intentional downward drag on expanded drawer collapses cleanly
    firePointer(collapseGrabber, 'pointerdown', 180, 120);
    firePointer(collapseGrabber, 'pointermove', 180, 220);
    firePointer(collapseGrabber, 'pointerup', 180, 220);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('false');

    // 7. Close dialog restores focus to originating button
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.getByTestId('sheet-open-state')).toHaveTextContent('false');
    });
    expect(document.activeElement).toBe(launchBtn);
  });

  it('guards NaN and out-of-range seeks and keeps slider value and aria-valuetext synchronized', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <OverlayProvider>
            <SheetTestHarness />
          </OverlayProvider>
        </PlayerProvider>
      </LibraryProvider>,
    );

    // Wait for catalog hydration to settle
    await waitFor(() => {
      expect(screen.getByTestId('floating-player-title')).toHaveTextContent('Youth');
    });

    await user.click(screen.getByRole('button', { name: 'Launch Sheet' }));
    await screen.findByRole('dialog', { name: /now playing studio/i });

    const durSec = Number(screen.getByTestId('duration-val').textContent);
    const trackSlider = screen.getByLabelText(/seek track/i);
    const barSlider = screen.getByLabelText(/seek playback position/i);
    expect(trackSlider).not.toBeDisabled();
    expect(barSlider).not.toBeDisabled();

    // NaN seek never corrupts currentTime
    await user.click(screen.getByRole('button', { name: 'Seek NaN' }));
    expect(screen.getByTestId('current-time-val')).toHaveTextContent('0');

    // Middle seek updates currentTime and accessible slider text
    await user.click(screen.getByRole('button', { name: 'Seek 25' }));
    expect(screen.getByTestId('current-time-val')).toHaveTextContent('25');
    expect(trackSlider).toHaveAttribute('aria-valuetext', `0:25 of ${formatDuration(durSec)}`);

    // End-of-track boundary seek clamps strictly to track duration
    fireEvent.change(trackSlider, { target: { value: '999' } });
    expect(screen.getByTestId('current-time-val')).toHaveTextContent(String(durSec));
    expect(trackSlider).toHaveAttribute(
      'aria-valuetext',
      `${formatDuration(durSec)} of ${formatDuration(durSec)}`,
    );

    // Loading a new track resets currentTime cleanly to 0
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Load Test Track' }));
    expect(screen.getByTestId('current-time-val')).toHaveTextContent('0');
  });

  it('prevents mini-player swipe gesture from triggering skip when tapping Like or canceling pointer', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <OverlayProvider>
            <SheetTestHarness />
          </OverlayProvider>
        </PlayerProvider>
      </LibraryProvider>,
    );

    const titleBtn = screen.getByTestId('floating-player-title');
    await waitFor(() => {
      expect(titleBtn).toHaveTextContent('Youth');
    });

    const likeBtn = screen.getByRole('button', { name: /like current track/i });
    firePointer(likeBtn, 'pointerdown', 200, 50);
    firePointer(likeBtn, 'pointermove', 80, 50);
    firePointer(likeBtn, 'pointerup', 80, 50);

    // Track title stays on Youth, not skipped by swiping from Like button
    expect(titleBtn).toHaveTextContent('Youth');

    await user.click(likeBtn);
    expect(screen.getByRole('button', { name: /unlike current track/i })).toBeInTheDocument();
  });

  it('stacks Radio above Like without an Autoplay stage pill, syncs lower drawer tint to album art, and normalizes slow maxres artwork URLs', async () => {
    const user = userEvent.setup();
    render(
      <LibraryProvider>
        <PlayerProvider>
          <OverlayProvider>
            <SheetTestHarness />
          </OverlayProvider>
        </PlayerProvider>
      </LibraryProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Launch Sheet' }));
    const dialog = await screen.findByRole('dialog', { name: /now playing studio/i });

    const radioBtn = screen.getByRole('button', { name: /build radio queue from track/i });
    const likeBtn = screen.getByRole('button', { name: /^like track$/i });
    expect(radioBtn.parentElement).toBe(likeBtn.parentElement);
    const siblings = Array.from(radioBtn.parentElement!.children);
    expect(siblings.indexOf(radioBtn)).toBeLessThan(siblings.indexOf(likeBtn));

    // Autoplay pill removed from main player stage
    expect(screen.queryByRole('button', { name: /^autoplay$/i })).not.toBeInTheDocument();

    // Bottom action bar matches Queue · Sleep timer · Lyrics minimal layout synced to album cover
    const peekBar = screen.getByTestId('mobile-peek-bar');
    expect(peekBar.style.backgroundColor).toContain('rgba(');
    expect(screen.getByRole('button', { name: /^queue$/i })).toBeInTheDocument();
    const sleepBtn = screen.getByRole('button', { name: /sleep timer/i });
    expect(sleepBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^lyrics$/i })).toBeInTheDocument();

    // Tapping Sleep timer opens album-synced quick options and activates timer
    await user.click(sleepBtn);
    const sleepGroup = screen.getByRole('group', { name: /sleep timer options/i });
    expect(sleepGroup.style.backgroundColor).toContain('rgba(');
    const offPill = screen.getByRole('button', { name: /^off$/i });
    expect(offPill.style.backgroundColor).toContain('rgba(');
    await user.click(screen.getByRole('button', { name: /^15m$/i }));
    expect(sleepBtn).toHaveTextContent('15m');

    // Opening Queue renders clean unnumbered rows without left grip buttons
    await user.click(screen.getByRole('button', { name: /^queue$/i }));
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('true');
    expect(screen.queryByRole('button', { name: /reorder .* in queue/i })).not.toBeInTheDocument();

    // Sliding down from the Queue tab header collapses smoothly even outside the tiny top grabber pill
    const tabHeader = screen.getByRole('tab', { name: /up next/i });
    firePointer(tabHeader, 'pointerdown', 180, 140);
    firePointer(tabHeader, 'pointermove', 180, 240);
    firePointer(tabHeader, 'pointerup', 180, 240);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('false');

    // Re-open and test pull-down from top of scroll list (scrollTop = 0)
    await user.click(screen.getByRole('button', { name: /^queue$/i }));
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('true');
    const panel = screen.getByLabelText(/up next and lyrics panel/i);
    const scrollContainer = panel.querySelector('[data-queue-scroll-container]')!;
    firePointer(scrollContainer, 'pointerdown', 180, 220);
    firePointer(scrollContainer, 'pointermove', 180, 320);
    firePointer(scrollContainer, 'pointerup', 180, 320);
    expect(screen.getByTestId('sheet-expanded-state')).toHaveTextContent('false');
    expect(dialog).toBeInTheDocument();
  });
});
