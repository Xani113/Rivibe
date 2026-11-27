import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ArtistSpotlight, LyricsResult, RadioStation, Track } from '../types/music';
import { useLibrary } from './LibraryContext';
import {
  fetchArtistSpotlight,
  fetchLyrics,
  fetchPersonalizedRecommendations,
  searchItunes,
} from '../services/musicApis';
import { buildTrackRadioQueue, rankRecommendations } from '../engine/vibeEngine';
import { SEED_TRACKS } from '../services/seedCatalog';

interface PlayerContextValue {
  currentTrack: Track | null;
  currentRadioStation: RadioStation | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackNotice: string | null;
  infiniteRadio: boolean;
  setInfiniteRadio: (enabled: boolean) => void;
  lyrics: LyricsResult | null;
  isLoadingLyrics: boolean;
  artistSpotlight: ArtistSpotlight | null;
  playTrack: (track: Track, contextTracks?: Track[]) => Promise<void>;
  startTrackRadio: (seedTrack: Track) => Promise<void>;
  playRadioStation: (station: RadioStation) => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: (userSkipped?: boolean) => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  clearNotice: () => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const {
    catalog,
    tasteProfile,
    apiVault,
    activeMood,
    recordPlay,
    recordComplete,
    recordSkip,
    registerTracks,
  } = useLibrary();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => SEED_TRACKS[0] ?? null);
  const [currentRadioStation, setCurrentRadioStation] = useState<RadioStation | null>(null);
  const [queue, setQueue] = useState<Track[]>(() => SEED_TRACKS);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [infiniteRadio, setInfiniteRadio] = useState(true);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [artistSpotlight, setArtistSpotlight] = useState<ArtistSpotlight | null>(null);

  // Refs to avoid stale closures inside native audio event listeners
  const stateRef = useRef({
    currentTrack,
    queue,
    queueIndex,
    infiniteRadio,
    catalog,
    tasteProfile,
    currentRadioStation,
  });
  stateRef.current = {
    currentTrack,
    queue,
    queueIndex,
    infiniteRadio,
    catalog,
    tasteProfile,
    currentRadioStation,
  };

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    return audioRef.current;
  }, [volume]);

  const loadAudioSource = useCallback(
    async (track: Track) => {
      const audio = getAudio();
      let playableTrack = track;

      if (!track.audioUrl) {
        const matches = await searchItunes(`${track.artist} ${track.title}`, 3);
        const found = matches.find((m) => Boolean(m.audioUrl));
        if (found) {
          playableTrack = { ...track, audioUrl: found.audioUrl, streamType: found.streamType };
          registerTracks([playableTrack]);
        }
      }

      setCurrentTrack(playableTrack);
      setCurrentRadioStation(null);
      setCurrentTime(0);
      setDuration(playableTrack.durationSec || 30);

      if (!playableTrack.audioUrl) {
        setIsPlaying(false);
        setPlaybackNotice(`Metadata preview only for "${playableTrack.title}". Connect an API or play a live stream.`);
        return;
      }

      setPlaybackNotice(null);
      audio.src = playableTrack.audioUrl;
      audio.currentTime = 0;
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        setPlaybackNotice('Tap Play to start audio in your browser.');
      }
    },
    [getAudio, registerTracks],
  );

  const playTrack = useCallback(
    async (track: Track, contextTracks?: Track[]) => {
      const baseList =
        contextTracks && contextTracks.length > 0
          ? contextTracks
          : buildTrackRadioQueue(track, catalog, tasteProfile, 16);

      const idx = Math.max(
        0,
        baseList.findIndex((t) => t.id === track.id),
      );
      const nextQueue =
        baseList[idx]?.id === track.id ? baseList : [track, ...baseList];

      setQueue(nextQueue);
      setQueueIndex(baseList[idx]?.id === track.id ? idx : 0);
      recordPlay(track);
      await loadAudioSource(track);
    },
    [catalog, loadAudioSource, recordPlay, tasteProfile],
  );

  const startTrackRadio = useCallback(
    async (seedTrack: Track) => {
      const initialQueue = buildTrackRadioQueue(seedTrack, catalog, tasteProfile, 16);
      setQueue(initialQueue);
      setQueueIndex(0);
      recordPlay(seedTrack);
      await loadAudioSource(seedTrack);

      const fresh = await fetchPersonalizedRecommendations(seedTrack, activeMood, apiVault);
      registerTracks(fresh);
      const enrichedQueue = buildTrackRadioQueue(seedTrack, [...fresh, ...catalog], tasteProfile, 18);
      setQueue(enrichedQueue);
    },
    [activeMood, apiVault, catalog, loadAudioSource, recordPlay, registerTracks, tasteProfile],
  );

  const playRadioStation = useCallback(
    async (station: RadioStation) => {
      const audio = getAudio();
      setCurrentRadioStation(station);
      setPlaybackNotice(null);
      setCurrentTime(0);
      setDuration(0);
      audio.src = station.streamUrl;
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        setPlaybackNotice(`Could not start live stream for ${station.name}. Try another station.`);
      }
    },
    [getAudio],
  );

  const nextTrack = useCallback(
    async (userSkipped = false) => {
      const { currentTrack: active, queue: q, queueIndex: idx, infiniteRadio: radioOn, catalog: cat, tasteProfile: tp } =
        stateRef.current;

      if (userSkipped && active) {
        recordSkip(active);
      }

      if (q.length === 0) return;

      let nextIdx = idx + 1;
      let workingQueue = q;

      if (nextIdx >= q.length) {
        if (radioOn) {
          const existingIds = new Set(q.map((t) => t.id));
          const extra = rankRecommendations(cat, tp, {
            limit: 8,
            excludeIds: existingIds,
            seedTrack: active ?? undefined,
          }).map((s) => s.track);
          if (extra.length > 0) {
            workingQueue = [...q, ...extra];
            setQueue(workingQueue);
          } else {
            nextIdx = 0;
          }
        } else {
          nextIdx = 0;
        }
      }

      const target = workingQueue[nextIdx] ?? workingQueue[0];
      if (!target) return;
      setQueueIndex(nextIdx < workingQueue.length ? nextIdx : 0);
      recordPlay(target);
      await loadAudioSource(target);
    },
    [loadAudioSource, recordPlay, recordSkip],
  );

  const prevTrack = useCallback(async () => {
    const audio = getAudio();
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const { queue: q, queueIndex: idx } = stateRef.current;
    if (q.length === 0) return;
    const prevIdx = idx > 0 ? idx - 1 : q.length - 1;
    const target = q[prevIdx];
    if (!target) return;
    setQueueIndex(prevIdx);
    recordPlay(target);
    await loadAudioSource(target);
  }, [getAudio, loadAudioSource, recordPlay]);

  const togglePlay = useCallback(async () => {
    const audio = getAudio();
    if (!audio.src && stateRef.current.currentTrack) {
      await loadAudioSource(stateRef.current.currentTrack);
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [getAudio, loadAudioSource]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = getAudio();
      const bounded = Math.max(0, Math.min(seconds, duration || 30));
      audio.currentTime = bounded;
      setCurrentTime(bounded);
    },
    [duration, getAudio],
  );

  const setVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      const audio = getAudio();
      audio.volume = clamped;
      setVolumeState(clamped);
      if (clamped > 0 && isMuted) setIsMuted(false);
    },
    [getAudio, isMuted],
  );

  const toggleMute = useCallback(() => {
    const audio = getAudio();
    setIsMuted((prev) => {
      const next = !prev;
      audio.muted = next;
      return next;
    });
  }, [getAudio]);

  const clearNotice = useCallback(() => setPlaybackNotice(null), []);

  // Wire HTML5 Audio lifecycle events once
  useEffect(() => {
    const audio = getAudio();

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const active = stateRef.current.currentTrack;
      if (active) recordComplete(active);
      void nextTrack(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [getAudio, nextTrack, recordComplete]);

  // Web Media Session API for Android Chrome / Desktop lock-screen controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentRadioStation ? currentRadioStation.name : currentTrack.title,
      artist: currentRadioStation ? `Live Radio · ${currentRadioStation.country}` : currentTrack.artist,
      album: currentTrack.album,
      artwork: currentTrack.artworkUrl
        ? [{ src: currentTrack.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => void togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => void togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack', () => void nextTrack(true));
    navigator.mediaSession.setActionHandler('previoustrack', () => void prevTrack());
  }, [currentTrack, currentRadioStation, isPlaying, nextTrack, prevTrack, togglePlay]);

  // Fetch Lyrics & Artist Spotlight when track changes
  useEffect(() => {
    if (!currentTrack || currentRadioStation) {
      setLyrics(null);
      setArtistSpotlight(null);
      return;
    }
    let active = true;
    setIsLoadingLyrics(true);
    Promise.all([
      fetchLyrics(currentTrack.artist, currentTrack.title),
      fetchArtistSpotlight(currentTrack.artist, apiVault),
    ])
      .then(([lyr, spotlight]) => {
        if (!active) return;
        setLyrics(lyr);
        setArtistSpotlight(spotlight);
      })
      .finally(() => {
        if (active) setIsLoadingLyrics(false);
      });

    return () => {
      active = false;
    };
  }, [currentTrack, currentRadioStation, apiVault]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      currentRadioStation,
      queue,
      queueIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      playbackNotice,
      infiniteRadio,
      setInfiniteRadio,
      lyrics,
      isLoadingLyrics,
      artistSpotlight,
      playTrack,
      startTrackRadio,
      playRadioStation,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      clearNotice,
    }),
    [
      currentTrack,
      currentRadioStation,
      queue,
      queueIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      playbackNotice,
      infiniteRadio,
      lyrics,
      isLoadingLyrics,
      artistSpotlight,
      playTrack,
      startTrackRadio,
      playRadioStation,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      clearNotice,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
