export type MusicProviderId =
  | 'itunes'
  | 'audius'
  | 'theaudiodb'
  | 'listenbrainz'
  | 'radiobrowser'
  | 'lyricsovh'
  | 'lastfm'
  | 'tastedive'
  | 'jamendo'
  | 'genius'
  | 'spotify'
  | 'seed';

export type RailSection =
  | 'now-playing'
  | 'browse'
  | 'songs'
  | 'radio'
  | 'albums'
  | 'search';

export type LibrarySection =
  | 'recently-added'
  | 'artists'
  | 'albums'
  | 'songs'
  | 'made-for-you'
  | 'all-playlists';

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
  streamType: 'full' | 'preview' | 'none';
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

export interface CuratedMix {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  accentColor: string;
  coverUrl: string;
  tracks: ScoredTrack[];
  seedLabel?: string;
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

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  favicon: string;
  country: string;
  tags: string[];
  bitrate: number;
  votes: number;
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
  lastfmApiKey: string;
  tastediveApiKey: string;
  jamendoClientId: string;
  theAudioDbApiKey: string;
  geniusAccessToken: string;
  spotifyClientId: string;
  githubRepoUrl: string;
}

export interface ArtistSpotlight {
  name: string;
  genre: string;
  mood: string;
  style: string;
  biography: string;
  bannerUrl: string;
  thumbUrl: string;
  formedYear?: string;
  country?: string;
}

export interface LyricsResult {
  artist: string;
  title: string;
  lyrics: string;
  source: 'lyricsovh' | 'unavailable';
}
