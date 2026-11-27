export type MusicProviderId =
  | 'itunes'
  | 'audius'
  | 'youtube'
  | 'lyricsovh'
  | 'seed';

export type AppTab = 'home' | 'search' | 'library';

export type RepeatMode = 'off' | 'all' | 'one';

export type MoodId =
  | 'all'
  | 'for-you'
  | 'chill'
  | 'focus'
  | 'late-night'
  | 'workout'
  | 'indie'
  | 'jazz';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  audioUrl: string | null;
  youtubeVideoId?: string;
  streamType: 'full' | 'preview' | 'youtube' | 'none';
  durationSec: number;
  genres: string[];
  moods: string[];
  releaseYear?: number;
  source: MusicProviderId;
  externalUrl?: string;
  explicit?: boolean;
  bpm?: number;
  popularity?: number;
}

export interface ScoredTrack {
  track: Track;
  score: number;
  matchPercent: number;
  reasons: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  createdAt: number;
  isSystem?: boolean;
}

export interface TasteProfile {
  version: number;
  displayName: string;
  genreWeights: Record<string, number>;
  artistWeights: Record<string, number>;
  moodWeights: Record<string, number>;
  likedTrackIds: string[];
  dislikedTrackIds: string[];
  playCounts: Record<string, number>;
  recentTrackIds: string[];
  seedArtists: string[];
  preferredMood: MoodId;
}

export interface ApiVault {
  version: number;
  youtubeApiKey: string;
  githubRepoUrl: string;
  backendUrl: string;
}

export interface LyricLine {
  timeSec: number;
  text: string;
}

export interface LyricsResult {
  artist: string;
  title: string;
  lyrics: string;
  syncedLines?: LyricLine[];
  source: 'lyricsovh' | 'lrclib' | 'unavailable';
}
