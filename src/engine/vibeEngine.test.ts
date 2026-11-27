import { describe, it, expect } from 'vitest';
import {
  applyInteractionToTaste,
  buildCuratedMixes,
  buildTrackRadioQueue,
  rankRecommendations,
  scoreTrack,
} from './vibeEngine';
import type { TasteProfile, Track } from '../types/music';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: overrides.id ?? 't-1',
    title: overrides.title ?? 'Midnight City',
    artist: overrides.artist ?? 'M83',
    album: overrides.album ?? 'Hurry Up',
    artworkUrl: 'https://example.com/art.jpg',
    audioUrl: 'https://example.com/audio.m4a',
    streamType: 'preview',
    durationSec: 210,
    genres: ['Synth-Pop', 'Electronic'],
    moods: ['late-night', 'chill'],
    releaseYear: 2021,
    source: 'itunes',
    popularity: 85,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return {
    version: 1,
    displayName: 'Manoj',
    genreWeights: { 'synth-pop': 3.5, electronic: 2.5, jazz: 0.5 },
    artistWeights: { 'troye sivan': 2.5 },
    moodWeights: { 'late-night': 2, chill: 1.5 },
    likedTrackIds: [],
    dislikedTrackIds: [],
    playCounts: {},
    recentTrackIds: [],
    seedArtists: ['Troye Sivan'],
    preferredMood: 'all',
    ...overrides,
  };
}

describe('VibeEngine recommendation core', () => {
  it('scores tracks matching genre and artist preferences higher than unrelated tracks', () => {
    const profile = makeProfile();
    const matching = makeTrack({
      id: 't-match',
      artist: 'Troye Sivan',
      genres: ['Synth-Pop', 'Electronic'],
      moods: ['late-night'],
    });
    const unrelated = makeTrack({
      id: 't-other',
      artist: 'Unknown Polka Band',
      genres: ['Polka'],
      moods: ['workout'],
      audioUrl: null,
      streamType: 'none',
    });

    const matchScored = scoreTrack(matching, profile, 'all');
    const unrelatedScored = scoreTrack(unrelated, profile, 'all');

    expect(matchScored.score).toBeGreaterThan(unrelatedScored.score);
    expect(matchScored.matchPercent).toBeGreaterThanOrEqual(75);
    expect(matchScored.reasons.length).toBeGreaterThan(0);
  });

  it('penalizes disliked/skipped tracks and lowers affinity on skip', () => {
    const profile = makeProfile();
    const track = makeTrack({ id: 't-skip', artist: 'Skip Artist', genres: ['Pop'] });

    const updated = applyInteractionToTaste(profile, track, 'skip');
    expect(updated.dislikedTrackIds).toContain('t-skip');
    expect(updated.genreWeights['pop'] ?? 0).toBeLessThan(0);

    const scored = scoreTrack(track, updated, 'all');
    expect(scored.score).toBeLessThan(0);
  });

  it('boosts genre, artist, and mood weights when liking a track', () => {
    const profile = makeProfile();
    const track = makeTrack({
      id: 't-love',
      artist: 'Porter Robinson',
      genres: ['Future Bass', 'Electronic'],
      moods: ['focus'],
    });

    const updated = applyInteractionToTaste(profile, track, 'like');
    expect(updated.likedTrackIds).toContain('t-love');
    expect(updated.artistWeights['porter robinson']).toBeGreaterThan(0);
    expect(updated.genreWeights['future bass']).toBeGreaterThan(0);
    expect(updated.moodWeights['focus']).toBeGreaterThan(0);
  });

  it('enforces artist diversity cap so one artist never dominates recommendations', () => {
    const profile = makeProfile();
    const flooded: Track[] = [
      makeTrack({ id: 'a1', artist: 'Troye Sivan', title: 'Track 1' }),
      makeTrack({ id: 'a2', artist: 'Troye Sivan', title: 'Track 2' }),
      makeTrack({ id: 'a3', artist: 'Troye Sivan', title: 'Track 3' }),
      makeTrack({ id: 'a4', artist: 'Troye Sivan', title: 'Track 4' }),
      makeTrack({ id: 'b1', artist: 'Chvrches', title: 'Track 5' }),
      makeTrack({ id: 'c1', artist: 'M83', title: 'Track 6' }),
    ];

    const ranked = rankRecommendations(flooded, profile, {
      limit: 5,
      maxPerArtist: 2,
    });

    const troyeCount = ranked.filter((item) => item.track.artist === 'Troye Sivan').length;
    expect(troyeCount).toBeLessThanOrEqual(2);
    expect(ranked.length).toBe(4);
  });

  it('builds personalized Spotify-style curated mixes and Track Radio queue', () => {
    const profile = makeProfile();
    const catalog = [
      makeTrack({ id: '1', artist: 'Troye Sivan', genres: ['Synth-Pop'], moods: ['chill'] }),
      makeTrack({ id: '2', artist: 'Porter Robinson', genres: ['Electronic'], moods: ['focus'] }),
      makeTrack({ id: '3', artist: 'Miles Davis', genres: ['Jazz'], moods: ['jazz', 'late-night'] }),
      makeTrack({ id: '4', artist: 'Soo Jin', genres: ['Lo-Fi', 'Ambient'], moods: ['chill', 'focus'] }),
      makeTrack({ id: '5', artist: 'Chvrches', genres: ['Synth-Pop'], moods: ['workout'] }),
    ];

    const mixes = buildCuratedMixes(catalog, profile);
    expect(mixes.length).toBeGreaterThanOrEqual(3);
    expect(mixes[0]?.title).toContain('Discover');

    const radio = buildTrackRadioQueue(catalog[0]!, catalog, profile, 4);
    expect(radio[0]?.id).toBe('1');
    expect(radio.length).toBeGreaterThan(1);
    expect(radio.every((t, idx) => idx === 0 || t.id !== '1')).toBe(true);
  });

  it('ranks featured-artist and shared-mood tracks above unrelated songs when seeding Up Next', () => {
    const profile = makeProfile({ genreWeights: {}, artistWeights: {}, moodWeights: {} });
    const seed = makeTrack({
      id: 'seed-rito',
      title: 'Ayanam',
      artist: 'Rito Riba, Harshvardhan',
      genres: ['Indie Acoustic'],
      moods: ['chill', 'late-night'],
    });
    const collab = makeTrack({
      id: 'rel-collab',
      title: 'Heer',
      artist: 'Rito Riba',
      genres: ['Indie Acoustic'],
      moods: ['chill'],
    });
    const unrelated = makeTrack({
      id: 'rel-polka',
      title: 'Fast Polka',
      artist: 'Alpine Brass',
      genres: ['Polka'],
      moods: ['workout'],
    });

    const ranked = rankRecommendations([unrelated, collab], profile, { seedTrack: seed });
    expect(ranked[0]?.track.id).toBe('rel-collab');
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});
