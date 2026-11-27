import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(60),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(128),
});

export const TrackSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(240),
  artist: z.string().min(1).max(200),
  album: z.string().max(240).default('Single'),
  artworkUrl: z.string().max(1000).default(''),
  audioUrl: z.string().max(1000).nullable().default(null),
  youtubeVideoId: z.string().max(40).optional(),
  streamType: z.enum(['full', 'preview', 'youtube', 'none']),
  durationSec: z.number().min(0).max(86400).default(180),
  genres: z.array(z.string().max(60)).max(10).default([]),
  moods: z.array(z.string().max(60)).max(10).default([]),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  source: z.string().max(40).default('seed'),
  externalUrl: z.string().max(1000).optional(),
  popularity: z.number().min(0).max(100).optional(),
});

export const SyncLibrarySchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  genreWeights: z.record(z.string(), z.number()),
  artistWeights: z.record(z.string(), z.number()),
  moodWeights: z.record(z.string(), z.number()),
  likedTracks: z.array(TrackSchema).max(250),
  dislikedTrackIds: z.array(z.string().max(200)).max(200),
  recentTrackIds: z.array(z.string().max(200)).max(60),
  seedArtists: z.array(z.string().max(120)).max(30),
  preferredMood: z.string().max(40).default('all'),
});

export const CreatePlaylistSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(''),
  coverUrl: z.string().max(1000).default(''),
  initialTrack: TrackSchema.optional(),
});

export const UpdatePlaylistSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).optional(),
  addTrack: TrackSchema.optional(),
  removeTrackId: z.string().max(200).optional(),
});
