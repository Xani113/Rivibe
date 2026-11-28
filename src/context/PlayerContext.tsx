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

export type SleepTimerMode = 'off' | '15m' | '30m' | '60m';

function shuffleUpcomingList(items: Track[]): Track[] {
  if (items.length <= 1) return items;
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  if (copy.length >= 2 && copy.every((t, idx) => t.id === items[idx]?.id)) {
    [copy[0], copy[1]] = [copy[1]!, copy[0]!];
  }
  return copy;
}

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
  sleepTimerMode: SleepTimerMode;
  playbackNotice: string | null;
  queueToast: string | null;
  lyrics: LyricsResult | null;
  isLoadingLyrics: boolean;
  setInfiniteRadio: (enabled: boolean) => void;
  setSleepTimer: (mode: SleepTimerMode) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  playTrack: (
    track: Track,
    contextTracks?: Track[],
    options?: { appendSimilar?: boolean },
  ) => Promise<void>;
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
  showToast: (message: string) => void;
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
  const switchingTrackRef = useRef(false);
  const playRequestSeqRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const isRadioSessionRef = useRef(true);
  const topUpLockRef = useRef<{ trackId: string; ts: number }>({ trackId: '', ts: 0 });
  const unshuffledQueueRef = useRef<Track[] | null>(null);
  const preloadedArtUrlsRef = useRef<Set<string>>(new Set());

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
  const [sleepTimerMode, setSleepTimerMode] = useState<SleepTimerMode>('off');
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [queueToast, setQueueToast] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [nativePlaybackEpoch, setNativePlaybackEpoch] = useState(0);

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
      stateRef.current.currentTrack = firstFull;
      stateRef.current.queue = livePool.slice(0, 42);
      stateRef.current.queueIndex = Math.min(idx, Math.max(0, Math.min(livePool.length, 42) - 1));
      setCurrentTrack(firstFull);
      setDuration(firstFull.durationSec || 180);
      setQueue(livePool.slice(0, 42));
      setQueueIndex(Math.min(idx, Math.max(0, Math.min(livePool.length, 42) - 1)));
    }
  }, [catalog, currentTrack, isPlaying]);

  const stopAllPlaybackHardware = useCallback(() => {
    playRequestSeqRef.current += 1;
    switchingTrackRef.current = false;
    const audio = getAudio();
    audio.pause();
    if (activeNativeRef.current) {
      const nativePlugin = getNativeMusicPlugin();
      if (nativePlugin) void nativePlugin.stop();
      activeNativeRef.current = false;
    }
    stateRef.current.activeYoutubeVideoId = null;
    setActiveYoutubeVideoId(null);
    setYoutubeSeekTarget(null);
  }, [getAudio]);

  const loadAudioSource = useCallback(
    async (track: Track): Promise<Track> => {
      userInitiatedRef.current = true;
      const reqId = ++playRequestSeqRef.current;
      switchingTrackRef.current = true;
      const audio = getAudio();
      const nativePlugin = getNativeMusicPlugin();

      setPlaybackNotice(null);
      stateRef.current.currentTrack = track;
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.durationSec || (track.streamType === 'preview' ? 30 : 200));
      stateRef.current.isPlaying = true;
      setIsPlaying(true);

      let playableTrack = await resolveFullSongTrack(track, apiVault);
      if (playRequestSeqRef.current !== reqId) return playableTrack;

      if (nativePlugin) {
        if (!playableTrack.youtubeVideoId && !playableTrack.audioUrl) {
          const audiusMatches = await searchAudius(`${playableTrack.artist} ${playableTrack.title}`, 3);
          if (playRequestSeqRef.current !== reqId) return playableTrack;
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
            if (playRequestSeqRef.current !== reqId) return playableTrack;
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

        if (!audio.paused) audio.pause();
        registerTracks([playableTrack]);
        stateRef.current.activeYoutubeVideoId = null;
        setActiveYoutubeVideoId(null);
        setYoutubeSeekTarget(null);
        stateRef.current.currentTrack = playableTrack;
        setCurrentTrack(playableTrack);
        setCurrentTime(0);
        setDuration(playableTrack.durationSec || 200);
        setPlaybackNotice(null);

        if (!playableTrack.youtubeVideoId && !playableTrack.audioUrl) {
          activeNativeRef.current = false;
          switchingTrackRef.current = false;
          stateRef.current.isPlaying = false;
          setIsPlaying(false);
          setPlaybackNotice(`No playable stream found for "${playableTrack.title}".`);
          return playableTrack;
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
          if (playRequestSeqRef.current !== reqId) return playableTrack;
          if (snap?.isPlaying) switchingTrackRef.current = false;
          const playingNow = snap?.isPlaying ?? true;
          stateRef.current.isPlaying = playingNow;
          setIsPlaying(playingNow);
          if (snap?.duration && snap.duration > 0) setDuration(snap.duration);
          setNativePlaybackEpoch((n) => n + 1);
          return playableTrack;
        } catch (err) {
          if (playRequestSeqRef.current !== reqId) return playableTrack;
          if (playableTrack.audioUrl) {
            activeNativeRef.current = false;
            audio.src = playableTrack.audioUrl;
            audio.currentTime = 0;
            try {
              await audio.play();
              if (playRequestSeqRef.current !== reqId) return playableTrack;
              switchingTrackRef.current = false;
              stateRef.current.isPlaying = true;
              setIsPlaying(true);
              return playableTrack;
            } catch {
              // fall through to notice
            }
          }
          activeNativeRef.current = false;
          switchingTrackRef.current = false;
          stateRef.current.isPlaying = false;
          setIsPlaying(false);
          setPlaybackNotice(
            err instanceof Error && err.message
              ? err.message
              : `Could not start native stream for "${playableTrack.title}".`,
          );
          return playableTrack;
        }
      }

      activeNativeRef.current = false;

      if (playableTrack.streamType === 'youtube' && playableTrack.youtubeVideoId) {
        stateRef.current.activeYoutubeVideoId = playableTrack.youtubeVideoId;
        setActiveYoutubeVideoId(playableTrack.youtubeVideoId);
        if (!audio.paused) audio.pause();
        registerTracks([playableTrack]);
        stateRef.current.currentTrack = playableTrack;
        setCurrentTrack(playableTrack);
        setYoutubeSeekTarget(null);
        setCurrentTime(0);
        setDuration(playableTrack.durationSec || 200);
        setPlaybackNotice(null);
        switchingTrackRef.current = false;
        stateRef.current.isPlaying = true;
        setIsPlaying(true);
        return playableTrack;
      }

      if (!playableTrack.audioUrl) {
        const audiusMatches = await searchAudius(`${playableTrack.artist} ${playableTrack.title}`, 3);
        if (playRequestSeqRef.current !== reqId) return playableTrack;
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
          if (playRequestSeqRef.current !== reqId) return playableTrack;
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

      stateRef.current.activeYoutubeVideoId = null;
      setActiveYoutubeVideoId(null);
      setYoutubeSeekTarget(null);
      stateRef.current.currentTrack = playableTrack;
      setCurrentTrack(playableTrack);
      setCurrentTime(0);
      setDuration(playableTrack.durationSec || 30);

      if (!playableTrack.audioUrl) {
        switchingTrackRef.current = false;
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
        setPlaybackNotice(
          `Add a YouTube key in Settings to unlock "${playableTrack.title}" in browser, or use the Android APK.`,
        );
        return playableTrack;
      }

      setPlaybackNotice(null);
      audio.src = playableTrack.audioUrl;
      audio.currentTime = 0;
      try {
        await audio.play();
        if (playRequestSeqRef.current !== reqId) return playableTrack;
        switchingTrackRef.current = false;
        stateRef.current.isPlaying = true;
        setIsPlaying(true);
      } catch (err) {
        if (playRequestSeqRef.current !== reqId) return playableTrack;
        switchingTrackRef.current = false;
        if (err instanceof DOMException && err.name === 'AbortError') {
          return playableTrack;
        }
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
        setPlaybackNotice('Tap Play to start audio.');
      }
      return playableTrack;
    },
    [apiVault, getAudio, registerTracks],
  );

  const appendSimilarRecommendations = useCallback(
    (seedTrack: Track, allowAppendOnTail = false) => {
      void fetchPersonalizedRecommendations(seedTrack, activeMood, apiVault, false).then((fresh) => {
        if (fresh.length === 0) return;
        registerTracks(fresh);
        setQueue((curr) => {
          const activeId = stateRef.current.currentTrack?.id;
          if (!allowAppendOnTail && activeId !== seedTrack.id) return curr;
          const existingIds = new Set(curr.map((t) => t.id));
          const remainingCount = Math.max(0, curr.length - 1 - stateRef.current.queueIndex);
          const desiredAdditions = Math.max(15, 45 - remainingCount);
          const additions = fresh.filter((f) => !existingIds.has(f.id)).slice(0, desiredAdditions);
          if (additions.length === 0) return curr;
          if (unshuffledQueueRef.current) {
            const unshuffledIds = new Set(unshuffledQueueRef.current.map((t) => t.id));
            unshuffledQueueRef.current = [
              ...unshuffledQueueRef.current,
              ...additions.filter((a) => !unshuffledIds.has(a.id)),
            ];
          }
          const orderedAdditions = stateRef.current.shuffle
            ? shuffleUpcomingList(additions)
            : additions;
          const updated = [...curr, ...orderedAdditions];
          stateRef.current.queue = updated;
          return updated;
        });
      });
    },
    [activeMood, apiVault, registerTracks],
  );

  const playTrack = useCallback(
    async (
      track: Track,
      contextTracks?: Track[],
      options?: { appendSimilar?: boolean },
    ) => {
      userInitiatedRef.current = true;
      const shouldAppendSimilar =
        Boolean(options?.appendSimilar) || !contextTracks || contextTracks.length <= 1;
      isRadioSessionRef.current = shouldAppendSimilar;

      const baseList = options?.appendSimilar
        ? [track]
        : contextTracks && contextTracks.length > 0
          ? contextTracks
          : buildTrackRadioQueue(track, catalog, tasteProfile, 40);

      const idx = baseList.findIndex((t) => t.id === track.id);
      const rawQueue = idx >= 0 ? baseList : [track, ...baseList];
      const nextIdx = idx >= 0 ? idx : 0;

      let nextQueue = rawQueue;
      if (stateRef.current.shuffle && rawQueue.length - 1 - nextIdx > 1) {
        unshuffledQueueRef.current = [...rawQueue];
        nextQueue = [
          ...rawQueue.slice(0, nextIdx + 1),
          ...shuffleUpcomingList(rawQueue.slice(nextIdx + 1)),
        ];
      } else {
        unshuffledQueueRef.current = null;
      }

      stateRef.current.currentTrack = track;
      stateRef.current.queue = nextQueue;
      stateRef.current.queueIndex = nextIdx;
      setQueue(nextQueue);
      setQueueIndex(nextIdx);
      recordPlay(track);
      const resolvedTrack = await loadAudioSource(track);

      if (shouldAppendSimilar) {
        appendSimilarRecommendations(resolvedTrack);
      }
    },
    [appendSimilarRecommendations, catalog, loadAudioSource, recordPlay, tasteProfile],
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
        stateRef.current.currentTrack = nextTarget;
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
    isRadioSessionRef.current = false;
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
      isRadioSessionRef.current = true;
      const initialQueue = buildTrackRadioQueue(seedTrack, catalog, tasteProfile, 40);
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
        45,
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
      if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) return;
      const bounded = Math.max(0, Math.min(seconds, duration));
      const nativePlugin = activeNativeRef.current ? getNativeMusicPlugin() : null;
      if (nativePlugin) {
        void nativePlugin.seekTo({ positionSec: bounded });
        setCurrentTime(bounded);
        return;
      }
      if (stateRef.current.activeYoutubeVideoId) {
        setYoutubeSeekTarget((prev) => (bounded === 0 && prev === 0 ? 0.001 : bounded));
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

      if (nextIdx >= q.length) {
        if (rep === 'all') {
          nextIdx = 0;
          if (isShuffled && q.length > 1) {
            workingQueue = shuffleUpcomingList(q);
            stateRef.current.queue = workingQueue;
            setQueue(workingQueue);
          }
        } else if (radioOn) {
          const existingIds = new Set(q.map((t) => t.id));
          const extra = rankRecommendations(cat, tp, {
            limit: 25,
            maxPerArtist: 3,
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
      const resolvedTarget = await loadAudioSource(target);

      const remainingUpcoming = workingQueue.length - 1 - finalIdx;
      const now = Date.now();
      if (
        radioOn &&
        isRadioSessionRef.current &&
        rep === 'off' &&
        remainingUpcoming < 8 &&
        (topUpLockRef.current.trackId !== resolvedTarget.id || now - topUpLockRef.current.ts > 8000)
      ) {
        topUpLockRef.current = { trackId: resolvedTarget.id, ts: now };
        appendSimilarRecommendations(resolvedTarget, true);
      }
    },
    [appendSimilarRecommendations, getAudio, loadAudioSource, recordPlay, recordSkip, seekTo],
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
    switchingTrackRef.current = false;
    const nativePlugin = getNativeMusicPlugin();
    if (activeNativeRef.current && nativePlugin) {
      if (stateRef.current.isPlaying) {
        await nativePlugin.pause();
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
      } else {
        await nativePlugin.resume();
        stateRef.current.isPlaying = true;
        setIsPlaying(true);
      }
      return;
    }

    if (stateRef.current.activeYoutubeVideoId) {
      setIsPlaying((prev) => {
        const next = !prev;
        stateRef.current.isPlaying = next;
        return next;
      });
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
        stateRef.current.isPlaying = true;
        setIsPlaying(true);
      } catch {
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      stateRef.current.isPlaying = false;
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
    const q = stateRef.current.queue;
    const idx = stateRef.current.queueIndex;
    const nextShuffled = !stateRef.current.shuffle;
    stateRef.current.shuffle = nextShuffled;
    setShuffle(nextShuffled);

    if (q.length <= 1 || idx < 0 || idx >= q.length) {
      if (!nextShuffled) unshuffledQueueRef.current = null;
      return;
    }

    const prefix = q.slice(0, idx + 1);
    const upcoming = q.slice(idx + 1);

    if (nextShuffled) {
      unshuffledQueueRef.current = [...q];
      if (upcoming.length > 1) {
        const shuffledTail = shuffleUpcomingList(upcoming);
        const nextQ = [...prefix, ...shuffledTail];
        stateRef.current.queue = nextQ;
        setQueue(nextQ);
        showQueueToast('Shuffle on — Up Next reordered');
      }
      return;
    }

    const saved = unshuffledQueueRef.current;
    unshuffledQueueRef.current = null;
    if (saved && upcoming.length > 1) {
      const rankById = new Map<string, number>();
      saved.forEach((t, i) => {
        if (!rankById.has(t.id)) rankById.set(t.id, i);
      });
      const restoredUpcoming = [...upcoming].sort((a, b) => {
        const ra = rankById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const rb = rankById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ra - rb;
      });
      const nextQ = [...prefix, ...restoredUpcoming];
      stateRef.current.queue = nextQ;
      setQueue(nextQ);
    }
  }, [showQueueToast]);

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
      if (!stateRef.current.activeYoutubeVideoId && !activeNativeRef.current) {
        setCurrentTime(audio.currentTime || 0);
      }
    };
    const onLoadedMetadata = () => {
      if (
        !stateRef.current.activeYoutubeVideoId &&
        !activeNativeRef.current &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => {
      if (!stateRef.current.activeYoutubeVideoId && !activeNativeRef.current) {
        switchingTrackRef.current = false;
        stateRef.current.isPlaying = true;
        setIsPlaying(true);
      }
    };
    const onPause = () => {
      if (
        !stateRef.current.activeYoutubeVideoId &&
        !activeNativeRef.current &&
        !switchingTrackRef.current
      ) {
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      if (stateRef.current.activeYoutubeVideoId || activeNativeRef.current) return;
      const active = stateRef.current.currentTrack;
      if (active) recordComplete(active);
      void nextTrack(false);
    };
    const onAudioError = () => {
      if (stateRef.current.activeYoutubeVideoId || activeNativeRef.current) return;
      switchingTrackRef.current = false;
      stateRef.current.isPlaying = false;
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
  const prevTrackRef = useRef(prevTrack);
  prevTrackRef.current = prevTrack;
  const recordCompleteRef = useRef(recordComplete);
  recordCompleteRef.current = recordComplete;
  const recordPlayRef = useRef(recordPlay);
  recordPlayRef.current = recordPlay;
  const appendSimilarRef = useRef(appendSimilarRecommendations);
  appendSimilarRef.current = appendSimilarRecommendations;

  useEffect(() => {
    const nativePlugin = getNativeMusicPlugin();
    if (!nativePlugin) return;
    let active = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const syncNativeTrackAdvance = (nextTrackId: string, prevTrackId?: string) => {
      const {
        queue: q,
        queueIndex: idx,
        currentTrack: currTrack,
        infiniteRadio: radioOn,
        repeatMode: rep,
      } = stateRef.current;
      let targetIdx = q.findIndex((t, i) => i > idx && t.id === nextTrackId);
      if (targetIdx < 0) {
        targetIdx = q.findIndex((t) => t.id === nextTrackId);
      }
      if (targetIdx < 0) return;

      const matched = q[targetIdx]!;
      const completed =
        (prevTrackId ? q.find((t) => t.id === prevTrackId) : null) ?? currTrack;
      if (completed && completed.id !== matched.id) {
        recordCompleteRef.current(completed);
      }

      switchingTrackRef.current = false;
      stateRef.current.queueIndex = targetIdx;
      stateRef.current.currentTrack = matched;
      stateRef.current.isPlaying = true;
      setQueueIndex(targetIdx);
      setCurrentTrack(matched);
      setCurrentTime(0);
      setDuration(matched.durationSec || 200);
      setIsPlaying(true);
      recordPlayRef.current(matched);

      const remainingUpcoming = q.length - 1 - targetIdx;
      const now = Date.now();
      if (
        radioOn &&
        isRadioSessionRef.current &&
        rep === 'off' &&
        remainingUpcoming < 8 &&
        (topUpLockRef.current.trackId !== matched.id || now - topUpLockRef.current.ts > 8000)
      ) {
        topUpLockRef.current = { trackId: matched.id, ts: now };
        appendSimilarRef.current(matched, true);
      }
    };

    const handleVisibilityCatchup = () => {
      if (!active || document.visibilityState !== 'visible' || !activeNativeRef.current) return;
      void nativePlugin.getPlaybackState().then((snap) => {
        if (!active || !activeNativeRef.current) return;
        const activeId = stateRef.current.currentTrack?.id;
        if (snap.trackId && activeId && snap.trackId !== activeId && !switchingTrackRef.current) {
          syncNativeTrackAdvance(snap.trackId, activeId);
        }
        const safeTime =
          snap.duration > 0 ? Math.min(snap.currentTime || 0, snap.duration) : snap.currentTime || 0;
        setCurrentTime(Math.max(0, safeTime));
        if (snap.duration > 0) setDuration(snap.duration);
        if (!switchingTrackRef.current || snap.isPlaying) {
          if (snap.isPlaying) switchingTrackRef.current = false;
          stateRef.current.isPlaying = Boolean(snap.isPlaying);
          setIsPlaying(Boolean(snap.isPlaying));
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityCatchup);

    void Promise.all([
      nativePlugin.addListener('playbackState', (snap) => {
        if (!active || !activeNativeRef.current) return;
        const activeId = stateRef.current.currentTrack?.id;
        if (snap.trackId && activeId && snap.trackId !== activeId) {
          if (!switchingTrackRef.current && snap.isPlaying) {
            syncNativeTrackAdvance(snap.trackId, activeId);
          } else {
            return;
          }
        }
        const safeTime =
          snap.duration > 0 ? Math.min(snap.currentTime || 0, snap.duration) : snap.currentTime || 0;
        setCurrentTime(Math.max(0, safeTime));
        if (snap.duration > 0) setDuration(snap.duration);
        if (switchingTrackRef.current && !snap.isPlaying) return;
        if (snap.isPlaying) switchingTrackRef.current = false;
        const playingNow = Boolean(snap.isPlaying);
        stateRef.current.isPlaying = playingNow;
        setIsPlaying(playingNow);
      }),
      nativePlugin.addListener('trackAutoAdvanced', (event) => {
        if (!active || !activeNativeRef.current || !event?.trackId) return;
        syncNativeTrackAdvance(event.trackId, event.previousTrackId);
      }),
      nativePlugin.addListener('playbackEnded', (payload?: { trackId?: string }) => {
        if (!active || !activeNativeRef.current) return;
        const activeTrack = stateRef.current.currentTrack;
        if (payload?.trackId && activeTrack && payload.trackId !== activeTrack.id) return;
        if (activeTrack) recordCompleteRef.current(activeTrack);
        void nextTrackRef.current(false);
      }),
      nativePlugin.addListener('playbackError', (err) => {
        if (!active || !activeNativeRef.current) return;
        const activeTrack = stateRef.current.currentTrack;
        if (err.trackId && activeTrack && err.trackId !== activeTrack.id) return;
        switchingTrackRef.current = false;
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
        setPlaybackNotice(err.message || 'Native stream unavailable — try another track.');
      }),
      nativePlugin.addListener('mediaNext', () => {
        if (!active) return;
        void nextTrackRef.current(true);
      }),
      nativePlugin.addListener('mediaPrevious', () => {
        if (!active) return;
        void prevTrackRef.current();
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
      document.removeEventListener('visibilitychange', handleVisibilityCatchup);
      for (const h of handles) {
        void h.remove();
      }
    };
  }, []);

  // Pre-resolve upcoming song and sync upcoming playlist to native ExoPlayer for zero-gap auto-advance
  useEffect(() => {
    if (!currentTrack || (!isPlaying && !activeNativeRef.current)) return;

    const nativePlugin = getNativeMusicPlugin();
    if (nativePlugin && activeNativeRef.current) {
      void nativePlugin.setRepeatMode?.({ mode: repeatMode });
    }

    if (repeatMode === 'one' || queue.length <= 1) {
      if (nativePlugin && activeNativeRef.current) {
        void nativePlugin.setUpcomingQueue?.({ anchorTrackId: currentTrack.id, tracks: [] });
      }
      return;
    }

    let cancelled = false;
    const lookahead: Array<{ idx: number; track: Track }> = [];
    for (let offset = 1; offset <= Math.min(8, queue.length - 1); offset++) {
      const candidateIdx = queueIndex + offset;
      if (candidateIdx < queue.length) {
        lookahead.push({ idx: candidateIdx, track: queue[candidateIdx]! });
      } else if (repeatMode === 'all') {
        const wrappedIdx = candidateIdx % queue.length;
        if (wrappedIdx !== queueIndex) {
          lookahead.push({ idx: wrappedIdx, track: queue[wrappedIdx]! });
        }
      }
    }

    const syncUpcomingToNative = (items: Array<{ idx: number; track: Track }>) => {
      if (!nativePlugin || !activeNativeRef.current) return;
      const playablePayload = items
        .map((entry) => entry.track)
        .filter((t) => Boolean(t.youtubeVideoId || t.audioUrl))
        .map((t) => ({
          trackId: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkUrl: t.artworkUrl,
          youtubeVideoId: t.youtubeVideoId,
          audioUrl: t.audioUrl ?? undefined,
          isLiveStream: false,
        }));
      void nativePlugin.setUpcomingQueue?.({
        anchorTrackId: currentTrack.id,
        tracks: playablePayload,
      });
    };

    syncUpcomingToNative(lookahead);

    const firstNext = lookahead[0];
    if (
      firstNext &&
      firstNext.track.streamType !== 'full' &&
      !(firstNext.track.streamType === 'youtube' && firstNext.track.youtubeVideoId)
    ) {
      void resolveFullSongTrack(firstNext.track, apiVault).then((resolved) => {
        if (cancelled) return;
        const changed =
          resolved.youtubeVideoId !== firstNext.track.youtubeVideoId ||
          resolved.audioUrl !== firstNext.track.audioUrl ||
          resolved.streamType !== firstNext.track.streamType;
        if (!changed) return;

        registerTracks([resolved]);
        setQueue((curr) => {
          const existing = curr[firstNext.idx];
          if (!existing || existing.id !== firstNext.track.id) return curr;
          const nextQ = curr.map((item, i) => (i === firstNext.idx ? resolved : item));
          stateRef.current.queue = nextQ;
          return nextQ;
        });

        const updatedLookahead = lookahead.map((entry, i) =>
          i === 0 ? { ...entry, track: resolved } : entry,
        );
        syncUpcomingToNative(updatedLookahead);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    apiVault,
    currentTrack,
    isPlaying,
    nativePlaybackEpoch,
    queue,
    queueIndex,
    registerTracks,
    repeatMode,
    shuffle,
  ]);

  // Preload active and next 3 upcoming album covers into browser cache for instant display
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;
    const candidates = [currentTrack, ...queue.slice(Math.max(0, queueIndex + 1), queueIndex + 4)];
    for (const item of candidates) {
      const rawUrl = item?.artworkUrl?.trim();
      if (!rawUrl) continue;
      const cleanUrl = rawUrl.includes('maxresdefault.jpg')
        ? rawUrl.replace('maxresdefault.jpg', 'hqdefault.jpg')
        : rawUrl;
      if (preloadedArtUrlsRef.current.has(cleanUrl)) continue;
      if (preloadedArtUrlsRef.current.size > 120) {
        preloadedArtUrlsRef.current.clear();
      }
      preloadedArtUrlsRef.current.add(cleanUrl);
      const img = new Image();
      img.decoding = 'async';
      img.src = cleanUrl;
    }
  }, [currentTrack, queue, queueIndex]);

  useEffect(() => {
    // Native Android runs Media3 MediaSessionService; skip WebView MediaSession to prevent AudioFocus collisions
    if (getNativeMusicPlugin() || !('mediaSession' in navigator) || !currentTrack) return;
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
      setIsLoadingLyrics(false);
      return;
    }
    let active = true;
    setLyrics(null);
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

  const setSleepTimer = useCallback(
    (mode: SleepTimerMode) => {
      if (sleepTimerRef.current) {
        window.clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      setSleepTimerMode(mode);
      if (mode === 'off') {
        showQueueToast('Sleep timer turned off');
        return;
      }
      const minutes = mode === '15m' ? 15 : mode === '30m' ? 30 : 60;
      showQueueToast(`Sleep timer set for ${minutes} minutes`);
      sleepTimerRef.current = window.setTimeout(() => {
        sleepTimerRef.current = null;
        setSleepTimerMode('off');
        const nativePlugin = getNativeMusicPlugin();
        if (activeNativeRef.current && nativePlugin) {
          void nativePlugin.pause();
        } else if (!stateRef.current.activeYoutubeVideoId) {
          getAudio().pause();
        }
        switchingTrackRef.current = false;
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
        showQueueToast('Sleep timer finished — playback paused');
      }, minutes * 60 * 1000);
    },
    [getAudio, showQueueToast],
  );

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    };
  }, []);

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
      sleepTimerMode,
      playbackNotice,
      queueToast,
      lyrics,
      isLoadingLyrics,
      setInfiniteRadio,
      setSleepTimer,
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
      showToast: showQueueToast,
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
      sleepTimerMode,
      playbackNotice,
      queueToast,
      lyrics,
      isLoadingLyrics,
      setSleepTimer,
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
      showQueueToast,
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
