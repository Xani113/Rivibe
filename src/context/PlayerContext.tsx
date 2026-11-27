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
  resolveFullSongTrack,
  searchAudius,
  searchItunes,
} from '../services/musicApis';
import { getNativeMusicPlugin } from '../services/nativeMusicBridge';
import { buildTrackRadioQueue, rankRecommendations } from '../engine/vibeEngine';
import { SEED_TRACKS } from '../services/seedCatalog';

interface PlayerContextValue {
  currentTrack: Track | null;
  currentRadioStation: RadioStation | null;
  activeYoutubeVideoId: string | null;
  youtubeSeekTarget: number | null;
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
  handleYoutubeProgress: (curSec: number, durSec: number) => void;
  handleYoutubeStateSync: (playing: boolean) => void;
  handleYoutubeEnded: () => void;
  handleYoutubeError: () => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const {
    catalog,
    tasteProfile,
    apiVault,
    activeMood,
    fullOnly,
    recordPlay,
    recordComplete,
    recordSkip,
    registerTracks,
  } = useLibrary();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userInitiatedRef = useRef(false);
  const activeNativeRef = useRef(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => SEED_TRACKS[0] ?? null);
  const [currentRadioStation, setCurrentRadioStation] = useState<RadioStation | null>(null);
  const [activeYoutubeVideoId, setActiveYoutubeVideoId] = useState<string | null>(null);
  const [youtubeSeekTarget, setYoutubeSeekTarget] = useState<number | null>(null);
  const [queue, setQueue] = useState<Track[]>(() => SEED_TRACKS);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => SEED_TRACKS[0]?.durationSec ?? 185);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [infiniteRadio, setInfiniteRadio] = useState(true);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [artistSpotlight, setArtistSpotlight] = useState<ArtistSpotlight | null>(null);

  const stateRef = useRef({
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    infiniteRadio,
    catalog,
    tasteProfile,
    currentRadioStation,
    activeYoutubeVideoId,
  });
  stateRef.current = {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    infiniteRadio,
    catalog,
    tasteProfile,
    currentRadioStation,
    activeYoutubeVideoId,
  };

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    return audioRef.current;
  }, [volume]);

  // Promote default track to the first live FULL stream once catalog loads (before user plays)
  useEffect(() => {
    if (userInitiatedRef.current || isPlaying) return;
    if (currentTrack && currentTrack.source !== 'seed' && currentTrack.streamType !== 'none') return;
    const firstFull = catalog.find(
      (t) => t.source !== 'seed' && (t.streamType === 'full' || t.streamType === 'youtube'),
    );
    if (firstFull) {
      setCurrentTrack(firstFull);
      setDuration(firstFull.durationSec || 180);
      setQueue(catalog);
      setQueueIndex(Math.max(0, catalog.findIndex((t) => t.id === firstFull.id)));
    }
  }, [catalog, currentTrack, isPlaying]);

  const loadAudioSource = useCallback(
    async (track: Track) => {
      userInitiatedRef.current = true;
      const audio = getAudio();
      const nativePlugin = getNativeMusicPlugin();
      let playableTrack = await resolveFullSongTrack(track, apiVault);

      if (nativePlugin) {
        if (!playableTrack.youtubeVideoId && !playableTrack.audioUrl) {
          const audiusMatches = await searchAudius(`${playableTrack.artist} ${playableTrack.title}`, 3);
          const fullMatch = audiusMatches.find((m) => Boolean(m.audioUrl));
          if (fullMatch) {
            playableTrack = {
              ...playableTrack,
              audioUrl: fullMatch.audioUrl,
              streamType: 'full',
              durationSec: fullMatch.durationSec || playableTrack.durationSec,
            };
          } else {
            const matches = await searchItunes(`${playableTrack.artist} ${playableTrack.title}`, 3);
            const found = matches.find((m) => Boolean(m.audioUrl));
            if (found) {
              playableTrack = {
                ...playableTrack,
                audioUrl: found.audioUrl,
                streamType: found.streamType,
              };
            }
          }
        }

        audio.pause();
        registerTracks([playableTrack]);
        setActiveYoutubeVideoId(null);
        setYoutubeSeekTarget(null);
        setCurrentTrack(playableTrack);
        setCurrentRadioStation(null);
        setCurrentTime(0);
        setDuration(playableTrack.durationSec || 200);
        setPlaybackNotice(null);

        if (!playableTrack.youtubeVideoId && !playableTrack.audioUrl) {
          activeNativeRef.current = false;
          setIsPlaying(false);
          setPlaybackNotice(`No playable stream found for "${playableTrack.title}" right now.`);
          return;
        }

        activeNativeRef.current = true;
        try {
          const snap = await nativePlugin.playTrack({
            trackId: playableTrack.id,
            title: playableTrack.title,
            artist: playableTrack.artist,
            album: playableTrack.album,
            artworkUrl: playableTrack.artworkUrl,
            youtubeVideoId: playableTrack.youtubeVideoId,
            audioUrl: playableTrack.audioUrl ?? undefined,
            isLiveStream: false,
          });
          setIsPlaying(snap?.isPlaying ?? true);
          if (snap?.duration && snap.duration > 0) setDuration(snap.duration);
          return;
        } catch (err) {
          if (playableTrack.audioUrl) {
            activeNativeRef.current = false;
            audio.src = playableTrack.audioUrl;
            audio.currentTime = 0;
            try {
              await audio.play();
              setIsPlaying(true);
              return;
            } catch {
              // fall through to notice
            }
          }
          activeNativeRef.current = false;
          setIsPlaying(false);
          setPlaybackNotice(
            err instanceof Error && err.message
              ? err.message
              : `Could not start native stream for "${playableTrack.title}".`,
          );
          return;
        }
      }

      activeNativeRef.current = false;

      if (playableTrack.streamType === 'youtube' && playableTrack.youtubeVideoId) {
        audio.pause();
        registerTracks([playableTrack]);
        setCurrentTrack(playableTrack);
        setCurrentRadioStation(null);
        setActiveYoutubeVideoId(playableTrack.youtubeVideoId);
        setYoutubeSeekTarget(null);
        setCurrentTime(0);
        setDuration(playableTrack.durationSec || 200);
        setPlaybackNotice(null);
        setIsPlaying(true);
        return;
      }

      if (!playableTrack.audioUrl) {
        // Prefer full-length Audius match first, only falling back to 30s iTunes preview
        const audiusMatches = await searchAudius(`${playableTrack.artist} ${playableTrack.title}`, 3);
        const fullMatch = audiusMatches.find((m) => Boolean(m.audioUrl));
        if (fullMatch) {
          playableTrack = {
            ...playableTrack,
            audioUrl: fullMatch.audioUrl,
            streamType: 'full',
            durationSec: fullMatch.durationSec || playableTrack.durationSec,
          };
          registerTracks([playableTrack]);
        } else {
          const matches = await searchItunes(`${playableTrack.artist} ${playableTrack.title}`, 3);
          const found = matches.find((m) => Boolean(m.audioUrl));
          if (found) {
            playableTrack = {
              ...playableTrack,
              audioUrl: found.audioUrl,
              streamType: found.streamType,
            };
            registerTracks([playableTrack]);
          }
        }
      }

      setActiveYoutubeVideoId(null);
      setYoutubeSeekTarget(null);
      setCurrentTrack(playableTrack);
      setCurrentRadioStation(null);
      setCurrentTime(0);
      setDuration(playableTrack.durationSec || 30);

      if (!playableTrack.audioUrl) {
        setIsPlaying(false);
        setPlaybackNotice(
          `Add a YouTube Data API v3 key in API Keys to play "${playableTrack.title}" in full, or play any FULL Audius track.`,
        );
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
    [apiVault, getAudio, registerTracks],
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
      const nextQueue = baseList[idx]?.id === track.id ? baseList : [track, ...baseList];

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

      const fresh = await fetchPersonalizedRecommendations(seedTrack, activeMood, apiVault, fullOnly);
      registerTracks(fresh);
      const enrichedQueue = buildTrackRadioQueue(seedTrack, [...fresh, ...catalog], tasteProfile, 18);
      setQueue(enrichedQueue);
    },
    [activeMood, apiVault, catalog, fullOnly, loadAudioSource, recordPlay, registerTracks, tasteProfile],
  );

  const playRadioStation = useCallback(
    async (station: RadioStation) => {
      const audio = getAudio();
      const nativePlugin = getNativeMusicPlugin();
      setActiveYoutubeVideoId(null);
      setCurrentRadioStation(station);
      setPlaybackNotice(null);
      setCurrentTime(0);
      setDuration(0);

      if (nativePlugin) {
        audio.pause();
        activeNativeRef.current = true;
        try {
          const snap = await nativePlugin.playTrack({
            trackId: station.id,
            title: station.name,
            artist: `Live Radio · ${station.country}`,
            album: 'Live Vibe Radio',
            artworkUrl: station.favicon || undefined,
            audioUrl: station.streamUrl,
            isLiveStream: true,
          });
          setIsPlaying(snap?.isPlaying ?? true);
        } catch {
          activeNativeRef.current = false;
          setIsPlaying(false);
          setPlaybackNotice(`Could not start live stream for ${station.name}. Try another station.`);
        }
        return;
      }

      activeNativeRef.current = false;
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
      const {
        currentTrack: active,
        queue: q,
        queueIndex: idx,
        infiniteRadio: radioOn,
        catalog: cat,
        tasteProfile: tp,
      } = stateRef.current;

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
    const nativePlugin = activeNativeRef.current ? getNativeMusicPlugin() : null;
    if (nativePlugin && currentTime > 3) {
      await nativePlugin.seekTo({ positionSec: 0 });
      setCurrentTime(0);
      return;
    }
    if (stateRef.current.activeYoutubeVideoId && currentTime > 3) {
      setYoutubeSeekTarget(0);
      setCurrentTime(0);
      return;
    }
    const audio = getAudio();
    if (!nativePlugin && !stateRef.current.activeYoutubeVideoId && audio.currentTime > 3) {
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
  }, [currentTime, getAudio, loadAudioSource, recordPlay]);

  const togglePlay = useCallback(async () => {
    const nativePlugin = getNativeMusicPlugin();
    if (activeNativeRef.current && nativePlugin) {
      if (stateRef.current.isPlaying) {
        await nativePlugin.pause();
        setIsPlaying(false);
      } else {
        await nativePlugin.resume();
        setIsPlaying(true);
      }
      return;
    }

    if (stateRef.current.activeYoutubeVideoId) {
      setIsPlaying((prev) => !prev);
      return;
    }

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
      const bounded = Math.max(0, Math.min(seconds, duration || 30));
      const nativePlugin = activeNativeRef.current ? getNativeMusicPlugin() : null;
      if (nativePlugin) {
        void nativePlugin.seekTo({ positionSec: bounded });
        setCurrentTime(bounded);
        return;
      }
      if (stateRef.current.activeYoutubeVideoId) {
        setYoutubeSeekTarget(bounded);
        setCurrentTime(bounded);
        return;
      }
      const audio = getAudio();
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
      const nextMuted = clamped > 0 && isMuted ? false : isMuted;
      const nativePlugin = getNativeMusicPlugin();
      if (nativePlugin && activeNativeRef.current) {
        void nativePlugin.setVolume({ volume: clamped, muted: nextMuted });
      }
      setVolumeState(clamped);
      if (clamped > 0 && isMuted) setIsMuted(false);
    },
    [getAudio, isMuted],
  );

  const toggleMute = useCallback(() => {
    const audio = getAudio();
    const nativePlugin = getNativeMusicPlugin();
    setIsMuted((prev) => {
      const next = !prev;
      audio.muted = next;
      if (nativePlugin && activeNativeRef.current) {
        void nativePlugin.setVolume({ volume, muted: next });
      }
      return next;
    });
  }, [getAudio, volume]);

  const clearNotice = useCallback(() => setPlaybackNotice(null), []);

  const handleYoutubeProgress = useCallback((curSec: number, durSec: number) => {
    setCurrentTime(curSec);
    if (durSec > 0) setDuration(durSec);
  }, []);

  const handleYoutubeStateSync = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleYoutubeEnded = useCallback(() => {
    const active = stateRef.current.currentTrack;
    if (active) recordComplete(active);
    void nextTrack(false);
  }, [nextTrack, recordComplete]);

  const handleYoutubeError = useCallback(() => {
    const active = stateRef.current.currentTrack;
    if (active?.audioUrl) {
      setActiveYoutubeVideoId(null);
      const audio = getAudio();
      audio.src = active.audioUrl;
      void audio.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false),
      );
      return;
    }
    setPlaybackNotice('YouTube embed restricted by uploader — skipping to next recommended track.');
    void nextTrack(false);
  }, [getAudio, nextTrack]);

  useEffect(() => {
    const audio = getAudio();

    const onTimeUpdate = () => {
      if (!stateRef.current.activeYoutubeVideoId) setCurrentTime(audio.currentTime || 0);
    };
    const onLoadedMetadata = () => {
      if (!stateRef.current.activeYoutubeVideoId && Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => {
      if (!stateRef.current.activeYoutubeVideoId) setIsPlaying(true);
    };
    const onPause = () => {
      if (!stateRef.current.activeYoutubeVideoId) setIsPlaying(false);
    };
    const onEnded = () => {
      if (stateRef.current.activeYoutubeVideoId) return;
      const active = stateRef.current.currentTrack;
      if (active) recordComplete(active);
      void nextTrack(false);
    };
    const onAudioError = () => {
      if (stateRef.current.activeYoutubeVideoId || activeNativeRef.current) return;
      setIsPlaying(false);
      setPlaybackNotice('Audio stream unavailable on current source — try another track or add YouTube API key.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onAudioError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onAudioError);
    };
  }, [getAudio, nextTrack, recordComplete]);

  const nextTrackRef = useRef(nextTrack);
  nextTrackRef.current = nextTrack;
  const recordCompleteRef = useRef(recordComplete);
  recordCompleteRef.current = recordComplete;

  useEffect(() => {
    const nativePlugin = getNativeMusicPlugin();
    if (!nativePlugin) return;
    let active = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void Promise.all([
      nativePlugin.addListener('playbackState', (snap) => {
        if (!active || !activeNativeRef.current) return;
        setCurrentTime(snap.currentTime || 0);
        if (snap.duration > 0) setDuration(snap.duration);
        setIsPlaying(Boolean(snap.isPlaying));
      }),
      nativePlugin.addListener('playbackEnded', () => {
        if (!active || !activeNativeRef.current) return;
        const activeTrack = stateRef.current.currentTrack;
        if (activeTrack) recordCompleteRef.current(activeTrack);
        void nextTrackRef.current(false);
      }),
      nativePlugin.addListener('playbackError', (err) => {
        if (!active || !activeNativeRef.current) return;
        setIsPlaying(false);
        setPlaybackNotice(err.message || 'Native stream unavailable — try another track.');
      }),
    ]).then((list) => {
      if (!active) {
        for (const h of list) void h.remove();
      } else {
        handles.push(...list);
      }
    });

    return () => {
      active = false;
      for (const h of handles) {
        void h.remove();
      }
    };
  }, []);

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
      activeYoutubeVideoId,
      youtubeSeekTarget,
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
      handleYoutubeProgress,
      handleYoutubeStateSync,
      handleYoutubeEnded,
      handleYoutubeError,
    }),
    [
      currentTrack,
      currentRadioStation,
      activeYoutubeVideoId,
      youtubeSeekTarget,
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
      handleYoutubeProgress,
      handleYoutubeStateSync,
      handleYoutubeEnded,
      handleYoutubeError,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
