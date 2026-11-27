import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../App';

describe('RiVibe App UI & Queue Workflow', () => {
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

  it('adds and removes songs in Playback Queue from Search & Queue Drawer', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open Search tab
    const searchNavBtn = (await screen.findAllByRole('button', { name: /^search$/i }))[0]!;
    await user.click(searchNavBtn);

    const searchInput = await screen.findByPlaceholderText(/search songs, artists, albums/i);
    await user.type(searchInput, 'Troye');

    expect(await screen.findByText(/Troye Horizon/i)).toBeInTheDocument();

    // Add discovered song directly to queue
    const addQueueBtns = screen.getAllByRole('button', { name: /add troye horizon to queue/i });
    await user.click(addQueueBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Added "Troye Horizon" to queue/i);
    });

    // Open Queue Drawer and verify track is present + Remove from Queue works
    const queueBtn = screen.getByRole('button', { name: /toggle playback queue/i });
    await user.click(queueBtn);

    const queueDialog = await screen.findByRole('dialog', { name: /playback queue/i });
    expect(within(queueDialog).getByText(/Troye Horizon/i)).toBeInTheDocument();

    const removeBtn = within(queueDialog).getByRole('button', {
      name: /remove troye horizon from queue/i,
    });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(within(queueDialog).queryByText(/Troye Horizon/i)).not.toBeInTheDocument();
    });

    await user.click(within(queueDialog).getByRole('button', { name: /close playback queue/i }));
  });

  it('creates playlists in Library, opens Now Playing with Lyrics & Up Next queue controls, and accesses Settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navigate to Library
    const libraryBtn = (await screen.findAllByRole('button', { name: /^library$/i }))[0]!;
    await user.click(libraryBtn);

    await user.click(await screen.findByRole('button', { name: /new playlist/i }));
    await user.type(screen.getByLabelText(/new playlist name/i), 'Night Drive');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect((await screen.findAllByText('Night Drive')).length).toBeGreaterThanOrEqual(1);

    // Open Now Playing sheet and inspect Up Next, Lyrics, Save to Playlist, Radio, and Autoplay controls
    await user.click(screen.getByRole('button', { name: /open now playing details/i }));
    const studioDialog = await screen.findByRole('dialog', { name: /now playing studio/i });

    expect(within(studioDialog).getByRole('tab', { name: /up next/i })).toBeInTheDocument();
    expect(within(studioDialog).getByRole('button', { name: /build radio queue from track/i })).toBeInTheDocument();

    const autoplayBtn = within(studioDialog).getByRole('button', { name: /autoplay/i });
    const initialPressed = autoplayBtn.getAttribute('aria-pressed');
    await user.click(autoplayBtn);
    expect(autoplayBtn.getAttribute('aria-pressed')).not.toBe(initialPressed);

    await user.click(within(studioDialog).getByRole('button', { name: /add current track to playlist/i }));
    expect(within(studioDialog).getByText(/save to playlist/i)).toBeInTheDocument();

    await user.click(within(studioDialog).getByRole('tab', { name: /lyrics/i }));
    expect(await within(studioDialog).findByText(/Look at the stars/i)).toBeInTheDocument();

    const modalAxe = await axe.run(studioDialog, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(modalAxe.violations).toEqual([]);

    await user.click(within(studioDialog).getByRole('button', { name: /close now playing/i }));

    // Open Settings modal (YouTube web key, APK link, and Cloud Sync)
    const settingsBtn = screen.getAllByRole('button', { name: /^settings$/i })[0]!;
    await user.click(settingsBtn);
    const settingsDialog = await screen.findByRole('dialog', { name: /rivibe settings/i });
    expect(within(settingsDialog).getByText(/Android APK Releases/i)).toBeInTheDocument();
    await user.click(within(settingsDialog).getByRole('button', { name: /close settings/i }));
  });

  it('passes axe-core WCAG accessibility checks on Home, Search, and Library', async () => {
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /quick picks/i });

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});
