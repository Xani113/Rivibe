import type { Playlist, Track } from '../types/music';

function makeArtDataUri(title: string, c1: string, c2: string, accent: string): string {
  const safe = title.replace(/[<>&"']/g, '').slice(0, 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="290" cy="110" r="95" fill="${accent}" opacity="0.28"/><circle cx="130" cy="290" r="120" fill="#000" opacity="0.18"/><text x="28" y="348" fill="#f4f5f7" font-family="system-ui,sans-serif" font-size="24" font-weight="700" opacity="0.92">${safe}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SEED_TRACKS: Track[] = [
  {
    id: 'seed-blue-neighbourhood',
    title: 'Youth',
    artist: 'Troye Sivan',
    album: 'Blue Neighbourhood',
    artworkUrl: makeArtDataUri('Blue Neighbourhood', '#18323e', '#0d1017', '#22d3a6'),
    audioUrl: null,
    streamType: 'none',
    durationSec: 185,
    genres: ['Synth-Pop', 'Indie Pop', 'Pop'],
    moods: ['chill', 'late-night', 'for-you'],
    releaseYear: 2015,
    source: 'seed',
    popularity: 92,
  },
  {
    id: 'seed-level-high',
    title: 'Shelter',
    artist: 'Porter Robinson',
    album: 'Worlds Live',
    artworkUrl: makeArtDataUri('Shelter', '#242947', '#0d1017', '#6366f1'),
    audioUrl: null,
    streamType: 'none',
    durationSec: 219,
    genres: ['Electronic', 'Synth-Pop', 'Future Bass'],
    moods: ['for-you', 'workout', 'chill'],
    releaseYear: 2016,
    source: 'seed',
    popularity: 90,
  },
  {
    id: 'seed-bitches-brew',
    title: 'Pharaoh’s Dance',
    artist: 'Miles Davis',
    album: 'Bitches Brew',
    artworkUrl: makeArtDataUri('Bitches Brew', '#1f3636', '#0d1017', '#22d3a6'),
    audioUrl: null,
    streamType: 'none',
    durationSec: 246,
    genres: ['Jazz', 'Jazz Fusion', 'Instrumental'],
    moods: ['jazz', 'focus', 'late-night'],
    releaseYear: 1970,
    source: 'seed',
    popularity: 89,
  },
  {
    id: 'seed-alone',
    title: 'Alone',
    artist: 'Soo Jin',
    album: 'Above the Clouds',
    artworkUrl: makeArtDataUri('Alone', '#1e2c44', '#0d1017', '#38bdf8'),
    audioUrl: null,
    streamType: 'none',
    durationSec: 214,
    genres: ['Lo-Fi', 'Ambient', 'Chillhop'],
    moods: ['chill', 'focus'],
    releaseYear: 2024,
    source: 'seed',
    popularity: 84,
  },
];

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-liked',
    name: 'Liked Songs',
    description: 'Tracks you liked across RiVibe.',
    coverUrl: SEED_TRACKS[0]!.artworkUrl,
    trackIds: [],
    createdAt: 1700000000000,
    isSystem: true,
  },
];
