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
import type { LyricsResult, RepeatMode, Track } from '../types/music';
import { useLibrary } from './LibraryContext';
import {
  fetchLyrics,
  fetchPersonalizedRecommendations,
  resolveFullSongTrack,
  searchAudius,
  searchItunes,
} from '../services/musicApis';
import { getNativeMusicPlugin } from '../services/nativeMusicBridge';
import { buildTrackRadioQueue, rankRecommendations } from '../engine/vibeEngine';
import { SEED_TRACKS } from '../services/seedCatalog';
import { loadSavedQueue, saveQueueState } from '../services/storage';

interface PlayerContextValue {
  currentTrack: Track | null;
  activeYoutubeVideoId: string | null;
  youtubeSeekTarget: number | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  infiniteRadio: boolean;
  playbackNotice: string | null;
  queueToast: string | null;
  lyrics: LyricsResult | null;
  isLoadingLyrics: boolean;
  setInfiniteRadio: (enabled: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  playTrack: (track: Track, contextTracks?: Track[]) => Promise<void>;
  playQueueIndex: (index: number) => Promise<void>;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearUpcomingQueue: () => void;
  startTrackRadio: (seedTrack: Track) => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: (userSkipped?: boolean) => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  clearNotice: () => void;
  clearQueueToast: () => void;
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
    recordPlay,
    recordComplete,
    recordSkip,
    registerTracks,
  } = useLibrary();

  const initialSavedQueue = useMemo(() => loadSavedQueue(), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userInitiatedRef = useRef(false);
  const activeNativeRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  const [queue, setQueue] = useState<Track[]>(
    () => initialSavedQueue?.queue ?? SEED_TRACKS.slice(0, 6),
  );
  const [queueIndex, setQueueIndex] = useState(() => initialSavedQueue?.queueIndex ?? 0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    if (initialSavedQueue) {
      return initialSavedQueue.queue[initialSavedQueue.queueIndex] ?? initialSavedQueue.queue[0] ?? null;
    }
    return SEED_TRACKS[0] ?? null;
  });
  const [activeYoutubeVideoId, setActiveYoutubeVideoId] = useState<string | null>(null);
  const [youtubeSeekTarget, setYoutubeSeekTarget] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => {
    const initialTrack = initialSavedQueue
      ? initialSavedQueue.queue[initialSavedQueue.queueIndex]
      : SEED_TRACKS[0];
    return initialTrack?.durationSec ?? 185;
  });
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [infiniteRadio, setInfiniteRadio] = useState(true);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [queueToast, setQueueToast] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const stateRef = useRef({
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    shuffle,
    repeatMode,
    infiniteRadio,
    catalog,
    tasteProfile,
    activeYoutubeVideoId,
  });
  stateRef.current = {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    shuffle,
    repeatMode,
    infiniteRadio,
    catalog,
    tasteProfile,
    activeYoutubeVideoId,
  };

  const showQueueToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setQueueToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setQueueToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  const clearQueueToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setQueueToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Persist active queue cleanly across app restarts
  useEffect(() => {
    if (queue.length > 0) {
      saveQueueState(queue, queueIndex);
    } else {
      saveQueueState([], 0);
    }
  }, [queue, queueIndex]);

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    return audioRef.current;
  }, [volume]);

  // Promote placeholder seed track to first live full stream when catalog hydrates
  useEffect(() => {
    if (userInitiatedRef.current || isPlaying) return;
    if (currentTrack && currentTrack.source !== 'seed' && currentTrack.streamType !== 'none') return;
    const livePool = catalog.filter((t) => t.source !== 'seed' && t.streamType !== 'none');
    const firstFull =
      livePool.find((t) => t.streamType === 'full' || t.streamType === 'youtube') ?? livePool[0];
    if (firstFull) {
      const idx = Math.max(0, livePool.findIndex((t) => t.id === firstFull.id));
      setCurrentTrack(firstFull);
      setDuration(firstFull.durationSec || 180);
      setQueue(livePool.slice(0, 18));
      setQueueIndex(Math.min(idx, Math.max(0, Math.min(livePool.length, 18) - 1)));
    }
  }, [catalog, currentTrack, isPlaying]);

  const stopAllPlaybackHardware = useCallback(() => {
    const audio = getAudio();
    audio.pause();
    if (activeNativeRef.current) {
      const nativePlugin = getNativeMusicPlugin();
      if (nativePlugin) void nativePlugin.stop();
      activeNativeRef.current = false;
    }
    setActiveYoutubeVideoId(null);
    setYoutubeSeekTarget(null);
  }, [getAudio]);

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
        setCurrentTime(0);
        setDuration(playableTrack.durationSec || 200);
        setPlaybackNotice(null);

        if (!playableTrack.youtubeVideoId && !playableTrack.audioUrl) {
          activeNativeRef.current = false;
          setIsPlaying(false);
          setPlaybackNotice(`No playable stream found for "${playableTrack.title}".`);
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
        setActiveYoutubeVideoId(playableTrack.youtubeVideoId);
        setYoutubeSeekTarget(null);
        setCurrentTime(0);
        setDuration(playableTrack.durationSec || 200);
        setPlaybackNotice(null);
        setIsPlaying(true);
        return;
      }

      if (!playableTrack.audioUrl) {
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
      setCurrentTime(0);
      setDuration(playableTrack.durationSec || 30);

      if (!playableTrack.audioUrl) {
        setIsPlaying(false);
        setPlaybackNotice(
          `Add a YouTube key in Settings to unlock "${playableTrack.title}" in browser, or use the Android APK.`,
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
        setPlaybackNotice('Tap Play to start audio.');
      }
    },
    [apiVault, getAudio, registerTracks],
  );

  const playTrack = useCallback(
    async (track: Track, contextTracks?: Track[]) => {
      userInitiatedRef.current = true;
      const baseList =
        contextTracks && contextTracks.length > 0
          ? contextTracks
          : buildTrackRadioQueue(track, catalog, tasteProfile, 16);

      const idx = baseList.findIndex((t) => t.id === track.id);
      const nextQueue = idx >= 0 ? baseList : [track, ...baseList];
      const nextIdx = idx >= 0 ? idx : 0;

      stateRef.current.queue = nextQueue;
      stateRef.current.queueIndex = nextIdx;
      setQueue(nextQueue);
      setQueueIndex(nextIdx);
      recordPlay(track);
      await loadAudioSource(track);

      // Background Velune-style Up Next enrichment when launched without fixed context
      if (!contextTracks || contextTracks.length <= 1) {
        void fetchPersonalizedRecommendations(track, activeMood, apiVault, false).then((fresh) => {
          if (fresh.length === 0) return;
          registerTracks(fresh);
          setQueue((curr) => {
            if (curr.length > 12 || curr[stateRef.current.queueIndex]?.id !== track.id) return curr;
            const existingIds = new Set(curr.map((t) => t.id));
            const additions = fresh.filter((f) => !existingIds.has(f.id)).slice(0, 12);
            const updated = [...curr, ...additions];
            stateRef.current.queue = updated;
            return updated;
          });
        });
      }
    },
    [activeMood, apiVault, catalog, loadAudioSource, recordPlay, registerTracks, tasteProfile],
  );

  const playQueueIndex = useCallback(
    async (index: number) => {
      userInitiatedRef.current = true;
      const q = stateRef.current.queue;
      const target = q[index];
      if (!target) return;
      stateRef.current.queueIndex = index;
      setQueueIndex(index);
      recordPlay(target);
      await loadAudioSource(target);
    },
    [loadAudioSource, recordPlay],
  );

  const addToQueue = useCallback(
    (track: Track) => {
      userInitiatedRef.current = true;
      registerTracks([track]);
      const currQ = stateRef.current.queue;
      if (currQ.length === 0 || !stateRef.current.currentTrack) {
        const nextQ = [track];
        stateRef.current.queue = nextQ;
        stateRef.current.queueIndex = 0;
        setQueue(nextQ);
        setQueueIndex(0);
        setCurrentTrack(track);
        setDuration(track.durationSec || 180);
      } else {
        const nextQ = [...currQ, track];
        stateRef.current.queue = nextQ;
        setQueue(nextQ);
      }
      showQueueToast(`Added "${track.title}" to queue`);
    },
    [registerTracks, showQueueToast],
  );

  const playNext = useCallback(
    (track: Track) => {
      userInitiatedRef.current = true;
      registerTracks([track]);
      const currQ = stateRef.current.queue;
      const idx = stateRef.current.queueIndex;
      if (currQ.length === 0 || !stateRef.current.currentTrack) {
        const nextQ = [track];
        stateRef.current.queue = nextQ;
        stateRef.current.queueIndex = 0;
        setQueue(nextQ);
        setQueueIndex(0);
        setCurrentTrack(track);
        setDuration(track.durationSec || 180);
      } else {
        const insertAt = Math.min(currQ.length, idx + 1);
        const nextQ = [...currQ.slice(0, insertAt), track, ...currQ.slice(insertAt)];
        stateRef.current.queue = nextQ;
        setQueue(nextQ);
      }
      showQueueToast(`"${track.title}" will play next`);
    },
    [registerTracks, showQueueToast],
  );

  const removeFromQueue = useCallback(
    (index: number) => {
      userInitiatedRef.current = true;
      const q = stateRef.current.queue;
      const idx = stateRef.current.queueIndex;
      if (index < 0 || index >= q.length) return;

      const removed = q[index]!;
      const nextQ = q.filter((_, i) => i !== index);

      if (nextQ.length === 0) {
        stopAllPlaybackHardware();
        stateRef.current.queue = [];
        stateRef.current.queueIndex = 0;
        stateRef.current.currentTrack = null;
        setQueue([]);
        setQueueIndex(0);
        setCurrentTrack(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        showQueueToast(`Removed "${removed.title}" from queue`);
        return;
      }

      if (index < idx) {
        const nextIdx = idx - 1;
        stateRef.current.queue = nextQ;
        stateRef.current.queueIndex = nextIdx;
        setQueue(nextQ);
        setQueueIndex(nextIdx);
        showQueueToast(`Removed "${removed.title}" from queue`);
        return;
      }

      if (index > idx) {
        stateRef.current.queue = nextQ;
        setQueue(nextQ);
        showQueueToast(`Removed "${removed.title}" from queue`);
        return;
      }

      // Removing currently active item at idx
      const nextIdx = Math.min(idx, nextQ.length - 1);
      const nextTarget = nextQ[nextIdx]!;
      const wasPlaying = stateRef.current.isPlaying;
      stateRef.current.queue = nextQ;
      stateRef.current.queueIndex = nextIdx;
      setQueue(nextQ);
      setQueueIndex(nextIdx);
      showQueueToast(`Removed "${removed.title}" from queue`);

      if (wasPlaying) {
        recordPlay(nextTarget);
        void loadAudioSource(nextTarget);
      } else {
        setCurrentTrack(nextTarget);
        setCurrentTime(0);
        setDuration(nextTarget.durationSec || 180);
      }
    },
    [loadAudioSource, recordPlay, showQueueToast, stopAllPlaybackHardware],
  );

  const moveQueueItem = useCallback((fromIndex: number, toIndex: number) => {
    const q = stateRef.current.queue;
    const idx = stateRef.current.queueIndex;
    if (
      fromIndex < 0 ||
      fromIndex >= q.length ||
      toIndex < 0 ||
      toIndex >= q.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const copy = [...q];
    const [moved] = copy.splice(fromIndex, 1);
    if (!moved) return;
    copy.splice(toIndex, 0, moved);

    let nextIdx = idx;
    if (fromIndex === idx) {
      nextIdx = toIndex;
    } else if (fromIndex < idx && toIndex >= idx) {
      nextIdx = idx - 1;
    } else if (fromIndex > idx && toIndex <= idx) {
      nextIdx = idx + 1;
    }

    stateRef.current.queue = copy;
    stateRef.current.queueIndex = nextIdx;
    setQueue(copy);
    setQueueIndex(nextIdx);
  }, []);

  const clearUpcomingQueue = useCallback(() => {
    const active = stateRef.current.queue[stateRef.current.queueIndex] ?? stateRef.current.currentTrack;
    const nextQ = active ? [active] : [];
    stateRef.current.queue = nextQ;
    stateRef.current.queueIndex = 0;
    setQueue(nextQ);
    setQueueIndex(0);
    showQueueToast('Cleared upcoming queue');
  }, [showQueueToast]);

  const startTrackRadio = useCallback(
    async (seedTrack: Track) => {
      userInitiatedRef.current = true;
      const initialQueue = buildTrackRadioQueue(seedTrack, catalog, tasteProfile, 16);
      stateRef.current.queue = initialQueue;
      stateRef.current.queueIndex = 0;
      setQueue(initialQueue);
      setQueueIndex(0);
      recordPlay(seedTrack);
      showQueueToast(`Starting radio from "${seedTrack.title}"`);
      await loadAudioSource(seedTrack);

      const fresh = await fetchPersonalizedRecommendations(seedTrack, activeMood, apiVault, false);
      registerTracks(fresh);
      const enrichedQueue = buildTrackRadioQueue(
        seedTrack,
        [...fresh, ...catalog],
        tasteProfile,
        18,
      );
      stateRef.current.queue = enrichedQueue;
      setQueue(enrichedQueue);
    },
    [
      activeMood,
      apiVault,
      catalog,
      loadAudioSource,
      recordPlay,
      registerTracks,
      showQueueToast,
      tasteProfile,
    ],
  );

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

  const nextTrack = useCallback(
    async (userSkipped = false) => {
      const {
        currentTrack: active,
        queue: q,
        queueIndex: idx,
        shuffle: isShuffled,
        repeatMode: rep,
        infiniteRadio: radioOn,
        catalog: cat,
        tasteProfile: tp,
      } = stateRef.current;

      if (userSkipped && active) {
        recordSkip(active);
      }

      if (!userSkipped && rep === 'one' && active) {
        seekTo(0);
        const nativePlugin = activeNativeRef.current ? getNativeMusicPlugin() : null;
        if (nativePlugin) {
          void nativePlugin.resume();
        } else if (!stateRef.current.activeYoutubeVideoId) {
          void getAudio().play();
        }
        setIsPlaying(true);
        return;
      }

      if (q.length === 0) return;

      let nextIdx = idx + 1;
      let workingQueue = q;

      if (isShuffled && q.length > 1) {
        let candidate = Math.floor(Math.random() * q.length);
        if (candidate === idx) candidate = (idx + 1) % q.length;
        nextIdx = candidate;
      } else if (nextIdx >= q.length) {
        if (rep === 'all') {
          nextIdx = 0;
        } else if (radioOn) {
          const existingIds = new Set(q.map((t) => t.id));
          const extra = rankRecommendations(cat, tp, {
            limit: 8,
            excludeIds: existingIds,
            seedTrack: active ?? undefined,
          }).map((s) => s.track);
          if (extra.length > 0) {
            workingQueue = [...q, ...extra];
            stateRef.current.queue = workingQueue;
            setQueue(workingQueue);
          } else {
            nextIdx = 0;
          }
        } else if (!userSkipped) {
          setIsPlaying(false);
          return;
        } else {
          nextIdx = 0;
        }
      }

      const target = workingQueue[nextIdx] ?? workingQueue[0];
      if (!target) return;
      const finalIdx = nextIdx < workingQueue.length ? nextIdx : 0;
      stateRef.current.queueIndex = finalIdx;
      setQueueIndex(finalIdx);
      recordPlay(target);
      await loadAudioSource(target);
    },
    [getAudio, loadAudioSource, recordPlay, recordSkip, seekTo],
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
    stateRef.current.queueIndex = prevIdx;
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

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

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
    setPlaybackNotice('YouTube embed restricted — skipping to next track.');
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
      setPlaybackNotice('Audio stream unavailable on current source — try another track.');
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
      title: currentTrack.title,
      artist: currentTrack.artist,
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
  }, [currentTrack, isPlaying, nextTrack, prevTrack, togglePlay]);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics(null);
      return;
    }
    let active = true;
    setIsLoadingLyrics(true);
    fetchLyrics(currentTrack.artist, currentTrack.title)
      .then((lyr) => {
        if (!active) return;
        setLyrics(lyr);
      })
      .finally(() => {
        if (active) setIsLoadingLyrics(false);
      });

    return () => {
      active = false;
    };
  }, [currentTrack]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      activeYoutubeVideoId,
      youtubeSeekTarget,
      queue,
      queueIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      shuffle,
      repeatMode,
      infiniteRadio,
      playbackNotice,
      queueToast,
      lyrics,
      isLoadingLyrics,
      setInfiniteRadio,
      toggleShuffle,
      cycleRepeatMode,
      playTrack,
      playQueueIndex,
      addToQueue,
      playNext,
      removeFromQueue,
      moveQueueItem,
      clearUpcomingQueue,
      startTrackRadio,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      clearNotice,
      clearQueueToast,
      handleYoutubeProgress,
      handleYoutubeStateSync,
      handleYoutubeEnded,
      handleYoutubeError,
    }),
    [
      currentTrack,
      activeYoutubeVideoId,
      youtubeSeekTarget,
      queue,
      queueIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      shuffle,
      repeatMode,
      infiniteRadio,
      playbackNotice,
      queueToast,
      lyrics,
      isLoadingLyrics,
      toggleShuffle,
      cycleRepeatMode,
      playTrack,
      playQueueIndex,
      addToQueue,
      playNext,
      removeFromQueue,
      moveQueueItem,
      clearUpcomingQueue,
      startTrackRadio,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      clearNotice,
      clearQueueToast,
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
