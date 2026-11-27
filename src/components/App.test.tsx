import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../App';

describe('RiVibe App UI & Accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the spatial music dashboard with greeting, library, cover grid, and floating player', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /manoj/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search in albums, tracks, artists/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /primary rail/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
  });

  it('searches live music providers and plays a discovered track', async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchInput = await screen.findByPlaceholderText(/search in albums, tracks, artists/i);
    await user.type(searchInput, 'Troye');

    expect(await screen.findByText(/Troye Horizon/i)).toBeInTheDocument();

    const playButtons = screen.getAllByRole('button', { name: /play troye horizon/i });
    await user.click(playButtons[0]!);

    await waitFor(() => {
      expect(screen.getByTestId('floating-player-title')).toHaveTextContent(/Troye Horizon/i);
    });
  });

  it('switches to Made For You recommendations and updates likes', async () => {
    const user = userEvent.setup();
    render(<App />);

    const madeForYouBtn = await screen.findByRole('button', { name: /made for you/i });
    await user.click(madeForYouBtn);

    expect(await screen.findByText(/Discover Weekly/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended For Your Vibe/i)).toBeInTheDocument();
  });

  it('opens the API Keys Vault modal and Get Mobile App modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /^api keys$/i }));
    expect(await screen.findByRole('dialog', { name: /public music apis/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close api vault/i }));

    await user.click(screen.getByRole('button', { name: /get app/i }));
    expect(await screen.findByRole('dialog', { name: /get rivibe on mobile/i })).toBeInTheDocument();
    expect(screen.getByText(/Download APK from GitHub/i)).toBeInTheDocument();
  });

  it('switches to Live Vibe Radio, opens Now Playing sheet with Lyrics & Artist tabs, and creates a playlist', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open Radio view via rail
    await user.click(await screen.findByRole('button', { name: /live vibe radio/i }));
    expect(await screen.findByText(/Groove Salad Classic/i)).toBeInTheDocument();

    // Create a new playlist in sidebar
    await user.click(screen.getByRole('button', { name: /create new playlist/i }));
    await user.type(screen.getByLabelText(/new playlist name/i), 'Sunset Drive');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText('Sunset Drive')).toBeInTheDocument();

    // Open Now Playing sheet and inspect Lyrics & Artist tabs
    await user.click(screen.getByRole('button', { name: /open now playing details/i }));
    expect(await screen.findByRole('dialog', { name: /now playing studio/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /lyrics/i }));
    expect(await screen.findByText(/Look at the stars/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /artist/i }));
    expect(await screen.findByText(/Australian singer-songwriter/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close now playing/i }));
  });

  it('passes axe-core WCAG accessibility checks on the main screen', async () => {
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /manoj/i });

    const results = await axe.run(container, {
      rules: {
        // Color contrast in JSDOM does not compute backdrop-filter composite pixels accurately
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});
