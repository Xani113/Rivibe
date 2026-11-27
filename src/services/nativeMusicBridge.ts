import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Track } from '../types/music';
import { normalizeText } from '../utils/formatTime';

export interface NativeTrackDTO {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  youtubeVideoId?: string;
  durationSec?: number;
  genres?: string[];
  moods?: string[];
  source?: string;
  externalUrl?: string;
  explicit?: boolean;
}

export interface NativeCapabilities {
  nativeAvailable: boolean;
  engine: string;
  innertube: boolean;
  media3: boolean;
}

export interface NativeStreamInfo {
  streamUrl: string;
  mimeType: string;
  bitrate: number;
  durationSec: number;
  clientName: string;
  expiresAtMs: number;
}

export interface NativePlaybackSnapshot {
  trackId: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
}

export interface NativePlaybackErrorEvent {
  trackId: string;
  message: string;
  code?: string;
}

export interface NativePlayTrackOptions {
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  youtubeVideoId?: string;
  audioUrl?: string;
  isLiveStream?: boolean;
}

export interface NativeMusicPlugin {
  getCapabilities(): Promise<NativeCapabilities>;
  searchCatalog(options: { query: string; limit?: number }): Promise<{ tracks: NativeTrackDTO[] }>;
  getRecommendations(options: {
    videoId?: string;
    artist?: string;
    title?: string;
    mood?: string;
    limit?: number;
  }): Promise<{ tracks: NativeTrackDTO[] }>;
  resolveStream(options: {
    videoId: string;
    quality?: 'LOW' | 'HIGH' | 'HIGHEST' | 'AUTO';
  }): Promise<NativeStreamInfo>;
  playTrack(options: NativePlayTrackOptions): Promise<NativePlaybackSnapshot>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(options: { positionSec: number }): Promise<void>;
  setVolume(options: { volume: number; muted?: boolean }): Promise<void>;
  stop(): Promise<void>;
  getPlaybackState(): Promise<NativePlaybackSnapshot>;
  addListener(
    eventName: 'playbackState',
    listenerFunc: (state: NativePlaybackSnapshot) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackEnded',
    listenerFunc: (event: { trackId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackError',
    listenerFunc: (event: NativePlaybackErrorEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export interface NativeMusicPluginAdapter extends NativeMusicPlugin {
  isNativeAndroid?: () => boolean;
}

const capacitorNativePlugin = registerPlugin<NativeMusicPlugin>('RiVibeNativeMusic');
let testAdapterOverride: NativeMusicPluginAdapter | null = null;

/**
 * Allows Vitest suites to inject a mock native bridge adapter.
 */
export function __setNativeBridgeAdapterForTests(adapter: NativeMusicPluginAdapter | null): void {
  testAdapterOverride = adapter;
}

/**
 * Returns true when running inside the Capacitor Android APK with RiVibeNativeMusic registered.
 */
export function isNativeAndroidPlaybackAvailable(): boolean {
  if (testAdapterOverride) {
    return testAdapterOverride.isNativeAndroid ? testAdapterOverride.isNativeAndroid() : true;
  }
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    Capacitor.isPluginAvailable('RiVibeNativeMusic')
  );
}

/**
 * Returns the active Capacitor Android native plugin instance, or null in web/PWA environments.
 */
export function getNativeMusicPlugin(): NativeMusicPluginAdapter | null {
  if (!isNativeAndroidPlaybackAvailable()) return null;
  return testAdapterOverride ?? capacitorNativePlugin;
}

function inferMoods(seed: string): string[] {
  const n = normalizeText(seed);
  const moods = new Set<string>(['for-you']);
  if (n.includes('chill') || n.includes('lofi') || n.includes('lo-fi') || n.includes('acoustic')) {
    moods.add('chill');
  }
  if (n.includes('focus') || n.includes('study') || n.includes('ambient') || n.includes('piano')) {
    moods.add('focus');
  }
  if (n.includes('jazz') || n.includes('blues')) moods.add('jazz');
  if (n.includes('night') || n.includes('synth') || n.includes('r&b')) moods.add('late-night');
  if (n.includes('workout') || n.includes('dance') || n.includes('edm') || n.includes('pop')) {
    moods.add('workout');
  }
  if (n.includes('indie') || n.includes('alt')) moods.add('indie');
  return Array.from(moods);
}

/**
 * Normalizes a native Android Innertube DTO into a standard RiVibe Track object.
 */
export function normalizeNativeTrack(dto: NativeTrackDTO): Track {
  const rawVideoId = (dto.youtubeVideoId || dto.id || '').replace(/^yt-/, '').trim();
  const artworkUrl =
    dto.artworkUrl?.trim() ||
    (rawVideoId ? `https://i.ytimg.com/vi/${rawVideoId}/hqdefault.jpg` : '');

  return {
    id: `yt-${rawVideoId}`,
    title: dto.title?.trim() || 'Untitled',
    artist: dto.artist?.trim() || 'YouTube Music',
    album: dto.album?.trim() || 'YouTube Music',
    artworkUrl,
    audioUrl: null,
    youtubeVideoId: rawVideoId,
    streamType: 'youtube',
    durationSec: dto.durationSec && dto.durationSec > 0 ? Math.round(dto.durationSec) : 200,
    genres: dto.genres?.length ? dto.genres : ['YouTube Music'],
    moods: dto.moods?.length
      ? dto.moods
      : inferMoods(`${dto.title ?? ''} ${dto.artist ?? ''} ${dto.album ?? ''}`),
    source: 'youtube',
    externalUrl:
      dto.externalUrl || (rawVideoId ? `https://music.youtube.com/watch?v=${rawVideoId}` : undefined),
    explicit: dto.explicit,
    popularity: 92,
  };
}

/**
 * Queries Android's native Innertube client directly with zero API keys.
 */
export async function searchNativeCatalog(query: string, limit = 12): Promise<Track[]> {
  const plugin = getNativeMusicPlugin();
  if (!plugin || !query.trim()) return [];
  try {
    const res = await plugin.searchCatalog({ query: query.trim(), limit });
    return (res?.tracks ?? [])
      .filter((t) => Boolean((t.youtubeVideoId || t.id) && t.title))
      .map(normalizeNativeTrack);
  } catch {
    return [];
  }
}

/**
 * Queries Android's native YouTube Music next/related recommendation engine.
 */
export async function fetchNativeRecommendations(options: {
  videoId?: string;
  artist?: string;
  title?: string;
  mood?: string;
  limit?: number;
}): Promise<Track[]> {
  const plugin = getNativeMusicPlugin();
  if (!plugin) return [];
  try {
    const res = await plugin.getRecommendations(options);
    return (res?.tracks ?? [])
      .filter((t) => Boolean((t.youtubeVideoId || t.id) && t.title))
      .map(normalizeNativeTrack);
  } catch {
    return [];
  }
}

/**
 * Resolves a direct audio stream URL natively on Android via Innertube + NewPipeExtractor.
 */
export async function resolveNativeStream(
  videoId: string,
  quality: 'LOW' | 'HIGH' | 'HIGHEST' | 'AUTO' = 'HIGHEST',
): Promise<NativeStreamInfo | null> {
  const plugin = getNativeMusicPlugin();
  const cleanId = videoId.replace(/^yt-/, '').trim();
  if (!plugin || !cleanId) return null;
  try {
    const info = await plugin.resolveStream({ videoId: cleanId, quality });
    return info?.streamUrl ? info : null;
  } catch {
    return null;
  }
}
