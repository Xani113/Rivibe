import type { MoodId, ScoredTrack, TasteProfile, Track } from '../types/music';
import { normalizeText } from '../utils/formatTime';

export type TasteInteraction = 'like' | 'unlike' | 'skip' | 'play' | 'complete';

const WEIGHT_DELTA: Record<TasteInteraction, number> = {
  like: 1.6,
  unlike: -1.4,
  complete: 0.7,
  play: 0.35,
  skip: -1.1,
};

function bumpWeight(map: Record<string, number>, key: string, delta: number): void {
  const k = normalizeText(key);
  if (!k) return;
  const next = Number(((map[k] ?? 0) + delta).toFixed(3));
  map[k] = Math.max(-5, Math.min(20, next));
}

export function applyInteractionToTaste(
  profile: TasteProfile,
  track: Track,
  interaction: TasteInteraction,
): TasteProfile {
  const delta = WEIGHT_DELTA[interaction];
  const genreWeights = { ...profile.genreWeights };
  const artistWeights = { ...profile.artistWeights };
  const moodWeights = { ...profile.moodWeights };
  const playCounts = { ...profile.playCounts };

  for (const genre of track.genres) {
    bumpWeight(genreWeights, genre, delta);
  }
  bumpWeight(artistWeights, track.artist, delta * 1.15);
  for (const mood of track.moods) {
    bumpWeight(moodWeights, mood, delta * 0.85);
  }

  let likedTrackIds = [...profile.likedTrackIds];
  let dislikedTrackIds = [...profile.dislikedTrackIds];
  let recentTrackIds = [...profile.recentTrackIds];
  let seedArtists = [...profile.seedArtists];

  if (interaction === 'like') {
    if (!likedTrackIds.includes(track.id)) {
      likedTrackIds = [track.id, ...likedTrackIds].slice(0, 200);
    }
    dislikedTrackIds = dislikedTrackIds.filter((id) => id !== track.id);
    if (!seedArtists.some((a) => normalizeText(a) === normalizeText(track.artist))) {
      seedArtists = [track.artist, ...seedArtists].slice(0, 12);
    }
  } else if (interaction === 'unlike') {
    likedTrackIds = likedTrackIds.filter((id) => id !== track.id);
  } else if (interaction === 'skip') {
    if (!dislikedTrackIds.includes(track.id)) {
      dislikedTrackIds = [track.id, ...dislikedTrackIds].slice(0, 100);
    }
  } else if (interaction === 'play' || interaction === 'complete') {
    playCounts[track.id] = (playCounts[track.id] ?? 0) + 1;
    recentTrackIds = [track.id, ...recentTrackIds.filter((id) => id !== track.id)].slice(0, 40);
  }

  return {
    ...profile,
    genreWeights,
    artistWeights,
    moodWeights,
    likedTrackIds,
    dislikedTrackIds,
    playCounts,
    recentTrackIds,
    seedArtists,
  };
}

export function scoreTrack(
  track: Track,
  profile: TasteProfile,
  moodFilter: MoodId,
  seedTrack?: Track,
): ScoredTrack {
  if (profile.dislikedTrackIds.includes(track.id)) {
    return {
      track,
      score: -10,
      matchPercent: 12,
      reasons: ['Skipped recently'],
    };
  }

  let score = 1.0;
  const reasons: string[] = [];

  for (const g of track.genres) {
    const w = profile.genreWeights[normalizeText(g)] ?? 0;
    score += w * 0.85;
    if (w >= 1.2 && reasons.length === 0) {
      reasons.push(`Matches your ${g} taste`);
    }
  }

  const artistWeight = profile.artistWeights[normalizeText(track.artist)] ?? 0;
  score += artistWeight * 1.1;
  if (artistWeight >= 1.2) {
    reasons.push(`From ${track.artist}`);
  }

  if (moodFilter !== 'all' && moodFilter !== 'for-you') {
    if (track.moods.some((m) => normalizeText(m) === moodFilter)) {
      score += 2.2;
      reasons.push(`Fits ${moodFilter.replace('-', ' ')} mood`);
    }
  } else {
    for (const m of track.moods) {
      score += (profile.moodWeights[normalizeText(m)] ?? 0) * 0.45;
    }
  }

  if (seedTrack) {
    const seedGenres = new Set(seedTrack.genres.map(normalizeText));
    const sharedGenres = track.genres.filter((g) => seedGenres.has(normalizeText(g)));
    if (sharedGenres.length > 0) {
      score += sharedGenres.length * 1.8;
      reasons.unshift(`Similar to ${seedTrack.title}`);
    }

    const seedMoods = new Set(seedTrack.moods.map(normalizeText));
    const sharedMoods = track.moods.filter(
      (m) => m !== 'for-you' && seedMoods.has(normalizeText(m)),
    );
    if (sharedMoods.length > 0) {
      score += Math.min(2.2, sharedMoods.length * 1.1);
    }

    const splitArtists = (name: string) =>
      name
        .split(/[,&]|\s+(?:feat|ft)\.?\s+/i)
        .map((s) => normalizeText(s))
        .filter(Boolean);
    const seedArtists = new Set(splitArtists(seedTrack.artist));
    const trackArtists = splitArtists(track.artist);
    const sharesArtist = trackArtists.some((a) => seedArtists.has(a));
    if (normalizeText(track.artist) === normalizeText(seedTrack.artist) || sharesArtist) {
      score += 2.6;
      if (!reasons.some((r) => r.includes(track.artist))) {
        reasons.unshift(`Same vibe as ${track.artist}`);
      }
    }

    if (sharedGenres.length === 0 && sharedMoods.length === 0 && !sharesArtist) {
      score -= 1.2;
    }
  }

  if (track.streamType === 'full' || track.streamType === 'youtube') score += 1.4;
  else if (track.streamType === 'preview') score += 0.9;

  if (typeof track.popularity === 'number') {
    score += Math.min(1.2, track.popularity / 100);
  }

  if ((profile.playCounts[track.id] ?? 0) === 0 && !profile.likedTrackIds.includes(track.id)) {
    score += 0.45;
  }

  const normalizedPercent = Math.round(Math.max(52, Math.min(99, 54 + score * 4.8)));

  return {
    track,
    score: Number(score.toFixed(3)),
    matchPercent: normalizedPercent,
    reasons: reasons.slice(0, 2),
  };
}

interface RankOptions {
  limit?: number;
  maxPerArtist?: number;
  moodFilter?: MoodId;
  seedTrack?: Track;
  excludeIds?: Set<string>;
}

export function rankRecommendations(
  candidates: Track[],
  profile: TasteProfile,
  options: RankOptions = {},
): ScoredTrack[] {
  const {
    limit = 24,
    maxPerArtist = 2,
    moodFilter = profile.preferredMood,
    seedTrack,
    excludeIds = new Set<string>(),
  } = options;

  const deduped = new Map<string, Track>();
  for (const track of candidates) {
    if (excludeIds.has(track.id)) continue;
    if (profile.dislikedTrackIds.includes(track.id)) continue;
    const dedupeKey = `${normalizeText(track.title)}::${normalizeText(track.artist)}`;
    const existing = deduped.get(dedupeKey);
    if (!existing || (!existing.audioUrl && track.audioUrl)) {
      deduped.set(dedupeKey, track);
    }
  }

  const scored = Array.from(deduped.values())
    .map((track) => scoreTrack(track, profile, moodFilter, seedTrack))
    .sort((a, b) => b.score - a.score);

  const artistCounts = new Map<string, number>();
  const diversified: ScoredTrack[] = [];

  for (const item of scored) {
    const artistKey = normalizeText(item.track.artist);
    const count = artistCounts.get(artistKey) ?? 0;
    if (count >= maxPerArtist) continue;
    artistCounts.set(artistKey, count + 1);
    diversified.push(item);
    if (diversified.length >= limit) break;
  }

  return diversified;
}

export function buildTrackRadioQueue(
  seedTrack: Track,
  catalog: Track[],
  profile: TasteProfile,
  limit = 42,
): Track[] {
  const ranked = rankRecommendations(catalog, profile, {
    limit: Math.max(1, limit - 1),
    maxPerArtist: 3,
    seedTrack,
    excludeIds: new Set([seedTrack.id]),
  });

  return [seedTrack, ...ranked.map((item) => item.track)];
}
