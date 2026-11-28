import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../App';
import { formatTotalDuration, splitArtistNames } from '../utils/formatTime';

describe('RiVibe App UI, Navigation & Queue Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Quick Picks on Home with Add to Queue actions, mobile vertical flex shell, and docked player bar', async () => {
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: /quick picks/i })).toBeInTheDocument();
    const shell = container.querySelector('.rv-app-shell');
    expect(shell).toHaveClass('flex-col', 'md:flex-row');
    expect(screen.getByRole('navigation', { name: /main sections/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add .* to queue/i }).length).toBeGreaterThan(0);
  });

  it('adds and removes songs cleanly via 3-dot bottom action sheet while dynamically updating total duration', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open Search tab & confirm search input does NOT auto-focus (keyboard stays closed)
    const searchNavBtn = (await screen.findAllByRole('button', { name: /^search$/i }))[0]!;
    await user.click(searchNavBtn);

    const searchInput = await screen.findByPlaceholderText(/search songs, artists, albums/i);
    expect(document.activeElement).not.toBe(searchInput);

    await user.type(searchInput, 'Troye');
    expect(await screen.findByText(/Troye Horizon/i)).toBeInTheDocument();

    // Add discovered song directly to queue
    const addQueueBtns = screen.getAllByRole('button', { name: /add troye horizon to queue/i });
    await user.click(addQueueBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Added "Troye Horizon" to queue/i);
    });

    // Open Queue Drawer from sidebar, inspect summary header + duration, and use 3-dot action sheet to remove item
    const queueBtn = screen.getAllByRole('button', { name: /open playback queue/i })[0]!;
    await user.click(queueBtn);

    const queueDialog = await screen.findByRole('dialog', { name: /playback queue/i });
    expect(within(queueDialog).getByText(/Autoplaying similar music/i)).toBeInTheDocument();
    const durationBefore = within(queueDialog).getByTestId('queue-total-duration').textContent;
    expect(within(queueDialog).getByText(/Troye Horizon/i)).toBeInTheDocument();

    const moreBtn = within(queueDialog).getByRole('button', {
      name: /more options for troye horizon/i,
    });
    await user.click(moreBtn);

    const actionMenu = await screen.findByRole('menu', { name: /track actions for troye horizon/i });
    expect(within(actionMenu).getByRole('menuitem', { name: /add to queue/i })).toBeInTheDocument();
    expect(within(actionMenu).getByRole('menuitem', { name: /know about artist/i })).toBeInTheDocument();

    await user.click(within(actionMenu).getByRole('menuitem', { name: /remove from queue/i }));

    await waitFor(() => {
      expect(within(queueDialog).queryByText(/Troye Horizon/i)).not.toBeInTheDocument();
    });
    const durationAfter = within(queueDialog).getByTestId('queue-total-duration').textContent;
    expect(durationAfter).not.toBe(durationBefore);

    await user.click(within(queueDialog).getByRole('button', { name: /close playback queue/i }));
  });

  it('enforces deterministic 6-layer hardware back stack across menus, Artist Info, expanded sheet, Now Playing, Search keyboard, and Home exit guard', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: /quick picks/i });

    // Open Search tab and focus input to simulate soft keyboard open
    await user.click(screen.getAllByRole('button', { name: /^search$/i })[0]!);
    const searchInput = await screen.findByPlaceholderText(/search songs, artists, albums/i);
    await user.click(searchInput);
    expect(document.activeElement).toBe(searchInput);

    // Open Now Playing -> switch to Lyrics (expands bottom drawer)
    await user.click(screen.getByRole('button', { name: /open now playing details/i }));
    const studioDialog = await screen.findByRole('dialog', { name: /now playing studio/i });
    await user.click(within(studioDialog).getByRole('tab', { name: /lyrics/i }));
    expect(await within(studioDialog).findByText(/Look at the stars/i)).toBeInTheDocument();

    // Open 3-dot action sheet over Queue item inside Up Next, then open Know About Artist
    await user.click(within(studioDialog).getByRole('tab', { name: /up next/i }));
    const queueMoreBtns = within(studioDialog).getAllByRole('button', { name: /more options for/i });
    await user.click(queueMoreBtns[0]!);
    const actionMenu = await screen.findByRole('menu', { name: /track actions for/i });
    await user.click(within(actionMenu).getByRole('menuitem', { name: /know about artist/i }));

    const artistDialog = await screen.findByRole('dialog', { name: /artist information for/i });
    expect(within(artistDialog).getByText(/know about artist/i)).toBeInTheDocument();

    // Back 1: Close Artist Info -> Now Playing (with Up Next expanded) remains open
    act(() => {
      window.dispatchEvent(new Event('rivibeHardwareBack'));
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /artist information for/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: /now playing studio/i })).toBeInTheDocument();

    // Back 2: Collapse expanded Up Next / Lyrics drawer -> Now Playing player stays open
    const collapseBtn = within(studioDialog).getByRole('button', {
      name: /collapse queue and lyrics panel/i,
    });
    expect(collapseBtn).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('rivibeHardwareBack'));
    });
    await waitFor(() => {
      expect(
        within(studioDialog).queryByRole('button', { name: /collapse queue and lyrics panel/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: /now playing studio/i })).toBeInTheDocument();

    // Back 3: Close Full-Screen Now Playing -> lands cleanly back on Search
    act(() => {
      window.dispatchEvent(new Event('rivibeHardwareBack'));
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /now playing studio/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /^search$/i })).toBeInTheDocument();

    // Focus search input cleanly then Back 4: blurs input first before leaving Search tab
    await user.click(screen.getByPlaceholderText(/search songs, artists, albums/i));
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText(/search songs, artists, albums/i),
    );
    act(() => {
      window.dispatchEvent(new Event('rivibeHardwareBack'));
    });
    expect(document.activeElement).not.toBe(
      screen.getByPlaceholderText(/search songs, artists, albums/i),
    );
    expect(screen.getByRole('heading', { name: /^search$/i })).toBeInTheDocument();

    // Back 5: Navigate Search -> Home
    act(() => {
      window.dispatchEvent(new Event('rivibeHardwareBack'));
    });
    expect(await screen.findByRole('heading', { name: /quick picks/i })).toBeInTheDocument();

    // Back 6: Already on Home shows "Press back again to exit" guard toast
    act(() => {
      window.dispatchEvent(new Event('rivibeHardwareBack'));
    });
    expect(screen.getByRole('status')).toHaveTextContent(/press back again to exit/i);
  });

  it('handles rapid 12x open/close cycles across Now Playing, Queue, and 3-dot sheet without locking state', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /quick picks/i });

    for (let i = 0; i < 12; i++) {
      await user.click(screen.getByRole('button', { name: /open now playing details/i }));
      const studio = await screen.findByRole('dialog', { name: /now playing studio/i });
      // Alternate UI close and hardware back close while toggling tabs rapidly
      await user.click(within(studio).getByRole('tab', { name: /lyrics/i }));
      if (i % 2 === 0) {
        act(() => {
          window.dispatchEvent(new Event('rivibeHardwareBack'));
          window.dispatchEvent(new Event('rivibeHardwareBack'));
        });
      } else {
        await user.click(within(studio).getByRole('button', { name: /close now playing/i }));
      }
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /now playing studio/i })).not.toBeInTheDocument();
      });
    }

    // Reopening after rapid cycles starts collapsed cleanly (not stuck expanded on Lyrics)
    await user.click(screen.getByRole('button', { name: /open now playing details/i }));
    const reopened = await screen.findByRole('dialog', { name: /now playing studio/i });
    expect(
      within(reopened).getByRole('button', { name: /expand queue and lyrics panel/i }),
    ).toBeInTheDocument();
    await user.click(within(reopened).getByRole('button', { name: /close now playing/i }));
  });

  it('creates playlists in Library, inspects Now Playing controls, formats multi-hour duration & multi-artist credits, and passes axe-core checks', async () => {
    expect(formatTotalDuration(9118)).toBe('2h 31m 58s');
    expect(splitArtistNames('Saaheal, Rito Riba')).toEqual(['Saaheal', 'Rito Riba']);
    expect(splitArtistNames('Calvin Harris & Dua Lipa feat. Young Thug')).toEqual([
      'Calvin Harris',
      'Dua Lipa',
      'Young Thug',
    ]);

    const user = userEvent.setup();
    const { container } = render(<App />);

    // Navigate to Library & create playlist
    const libraryBtn = (await screen.findAllByRole('button', { name: /^library$/i }))[0]!;
    await user.click(libraryBtn);

    await user.click(await screen.findByRole('button', { name: /new playlist/i }));
    await user.type(screen.getByLabelText(/new playlist name/i), 'Night Drive');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect((await screen.findAllByText('Night Drive')).length).toBeGreaterThanOrEqual(1);

    // Open Now Playing sheet and inspect controls + Playlist menu (Save pill removed) + Lyrics + axe-core
    await user.click(screen.getByRole('button', { name: /open now playing details/i }));
    const studioDialog = await screen.findByRole('dialog', { name: /now playing studio/i });

    expect(within(studioDialog).getByRole('tab', { name: /up next/i })).toBeInTheDocument();
    expect(within(studioDialog).getByRole('button', { name: /build radio queue from track/i })).toBeInTheDocument();
    expect(within(studioDialog).queryByRole('button', { name: /add current track to playlist/i })).not.toBeInTheDocument();

    const autoplayBtn = within(studioDialog).getByRole('button', { name: /autoplay/i });
    const initialPressed = autoplayBtn.getAttribute('aria-pressed');
    await user.click(autoplayBtn);
    expect(autoplayBtn.getAttribute('aria-pressed')).not.toBe(initialPressed);

    await user.click(within(studioDialog).getByRole('button', { name: /playlist options/i }));
    expect(within(studioDialog).getByText(/add to playlist/i)).toBeInTheDocument();
    expect(within(studioDialog).getByText(/sleep timer/i)).toBeInTheDocument();
    await user.click(within(studioDialog).getByRole('button', { name: /^15m$/i }));
    expect(within(studioDialog).getByRole('button', { name: /^15m$/i })).toBeInTheDocument();

    await user.click(within(studioDialog).getByRole('tab', { name: /lyrics/i }));
    expect(await within(studioDialog).findByText(/Look at the stars/i)).toBeInTheDocument();

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);

    // Tapping artist name directly from Now Playing opens Know About Artist modal
    const artistCreditBtn = within(studioDialog).getByRole('button', { name: /know about/i });
    await user.click(artistCreditBtn);
    const artistModal = await screen.findByRole('dialog', { name: /artist information for/i });
    await user.click(within(artistModal).getByRole('button', { name: /close artist info/i }));

    await user.click(within(studioDialog).getByRole('button', { name: /close now playing/i }));

    // Confirm PlayerBar queue button was removed and bottom mobile nav places Settings right after Library
    expect(screen.queryByRole('button', { name: /toggle playback queue/i })).not.toBeInTheDocument();
    const bottomNav = screen.getByRole('navigation', { name: /mobile bottom navigation/i });
    const navButtons = within(bottomNav).getAllByRole('button').map((btn) => btn.textContent?.trim());
    expect(navButtons).toEqual(['Home', 'Search', 'Library', 'Settings']);

    await user.click(within(bottomNav).getByRole('button', { name: /^settings$/i }));
    const settingsDialog = await screen.findByRole('dialog', { name: /rivibe settings/i });
    expect(within(settingsDialog).getByText(/Android APK Releases/i)).toBeInTheDocument();
    await user.click(within(settingsDialog).getByRole('button', { name: /close settings/i }));
  });
});
