export type StreamType = 'full' | 'preview' | 'youtube' | 'none';

export interface CloudTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  audioUrl: string | null;
  youtubeVideoId?: string;
  streamType: StreamType;
  durationSec: number;
  genres: string[];
  moods: string[];
  releaseYear?: number;
  source: string;
  externalUrl?: string;
  popularity?: number;
}

export interface CloudPlaylist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  tracks: CloudTrack[];
  createdAt: number;
  isSystem?: boolean;
}

export interface UserPublic {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
}

export interface CloudTasteSnapshot {
  displayName: string;
  genreWeights: Record<string, number>;
  artistWeights: Record<string, number>;
  moodWeights: Record<string, number>;
  likedTracks: CloudTrack[];
  dislikedTrackIds: string[];
  recentTrackIds: string[];
  seedArtists: string[];
  preferredMood: string;
}
