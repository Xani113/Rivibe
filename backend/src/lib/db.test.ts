import { describe, it, expect, beforeEach } from 'vitest';
import {
  addTrackToCloudPlaylist,
  createCloudPlaylist,
  createDb,
  createUser,
  findUserByEmail,
  listUserPlaylists,
  saveUserLibrarySnapshot,
  loadUserLibrarySnapshot,
} from './db';
import type { CloudTrack } from './types';

const sampleTrack: CloudTrack = {
  id: 'yt-abc123',
  title: 'Youth',
  artist: 'Troye Sivan',
  album: 'Blue Neighbourhood',
  artworkUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
  audioUrl: null,
  youtubeVideoId: 'abc123',
  streamType: 'youtube',
  durationSec: 215,
  genres: ['Synth-Pop'],
  moods: ['chill'],
  source: 'youtube',
};

describe('SQLite database repository', () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  it('creates users, rejects duplicate emails, and finds users by email', () => {
    const user = createUser(db, {
      email: 'manoj@rivibe.app',
      passwordHash: 'hashed-pw',
      displayName: 'Manoj',
    });

    expect(user.id).toBeTruthy();
    expect(user.displayName).toBe('Manoj');

    const found = findUserByEmail(db, 'MANOJ@rivibe.app');
    expect(found?.id).toBe(user.id);

    expect(() =>
      createUser(db, {
        email: 'manoj@rivibe.app',
        passwordHash: 'hashed-pw-2',
        displayName: 'Duplicate',
      }),
    ).toThrow();
  });

  it('persists cloud playlists and tracks with parameterized queries', () => {
    const user = createUser(db, {
      email: 'cloud@rivibe.app',
      passwordHash: 'hashed',
      displayName: 'CloudUser',
    });

    const pl = createCloudPlaylist(db, user.id, {
      name: 'Midnight Spatial',
      description: 'Full songs only',
      coverUrl: sampleTrack.artworkUrl,
      initialTrack: sampleTrack,
    });

    expect(pl.tracks).toHaveLength(1);
    expect(pl.tracks[0]?.youtubeVideoId).toBe('abc123');

    const secondTrack: CloudTrack = { ...sampleTrack, id: 'aud-99', title: 'Analog Drift', streamType: 'full' };
    addTrackToCloudPlaylist(db, user.id, pl.id, secondTrack);

    const playlists = listUserPlaylists(db, user.id);
    expect(playlists).toHaveLength(1);
    expect(playlists[0]?.tracks).toHaveLength(2);
  });

  it('saves and restores user taste profile and liked tracks snapshot', () => {
    const user = createUser(db, {
      email: 'taste@rivibe.app',
      passwordHash: 'hashed',
      displayName: 'TasteUser',
    });

    saveUserLibrarySnapshot(db, user.id, {
      displayName: 'Manoj',
      genreWeights: { 'synth-pop': 4.2 },
      artistWeights: { 'troye sivan': 3.5 },
      moodWeights: { chill: 2.1 },
      likedTracks: [sampleTrack],
      dislikedTrackIds: ['bad-1'],
      recentTrackIds: [sampleTrack.id],
      seedArtists: ['Troye Sivan'],
      preferredMood: 'chill',
    });

    const loaded = loadUserLibrarySnapshot(db, user.id);
    expect(loaded?.genreWeights['synth-pop']).toBe(4.2);
    expect(loaded?.likedTracks[0]?.youtubeVideoId).toBe('abc123');
    expect(loaded?.dislikedTrackIds).toContain('bad-1');
  });
});
