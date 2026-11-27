import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, PlayCircle } from 'lucide-react';

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (vol: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
            onError?: () => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubeAudioBridgeProps {
  videoId: string | null;
  trackTitle?: string;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  seekTargetSec: number | null;
  onProgress: (currentSec: number, durationSec: number) => void;
  onStateSync: (playing: boolean) => void;
  onEnded: () => void;
  onError: () => void;
}

let ytApiPromise: Promise<void> | null = null;

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return ytApiPromise;
}

export function YouTubeAudioBridge({
  videoId,
  trackTitle,
  isPlaying,
  volume,
  isMuted,
  seekTargetSec,
  onProgress,
  onStateSync,
  onEnded,
  onError,
}: YouTubeAudioBridgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const readyRef = useRef(false);
  const switchingVideoRef = useRef(false);
  const switchStartedAtRef = useRef(0);
  const [minimized, setMinimized] = useState(false);

  const latestRef = useRef({
    isPlaying,
    volume,
    isMuted,
    onProgress,
    onStateSync,
    onEnded,
    onError,
  });
  latestRef.current = {
    isPlaying,
    volume,
    isMuted,
    onProgress,
    onStateSync,
    onEnded,
    onError,
  };

  // Load or switch video ONLY when videoId changes (never on play/pause/volume toggles)
  useEffect(() => {
    if (!videoId) {
      switchingVideoRef.current = false;
      if (readyRef.current && playerRef.current) {
        playerRef.current.pauseVideo();
      }
      return;
    }

    switchingVideoRef.current = true;
    switchStartedAtRef.current = Date.now();
    let cancelled = false;
    void ensureYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      if (playerRef.current && readyRef.current) {
        playerRef.current.loadVideoById(videoId);
        if (latestRef.current.isPlaying) {
          playerRef.current.playVideo();
        }
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '126',
        width: '224',
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            event.target.setVolume(Math.round(latestRef.current.volume * 100));
            if (latestRef.current.isMuted) event.target.mute();
            if (latestRef.current.isPlaying) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              switchingVideoRef.current = false;
              latestRef.current.onEnded();
            } else if (event.data === 1) {
              switchingVideoRef.current = false;
              latestRef.current.onStateSync(true);
            } else if (event.data === 2) {
              // Ignore transient PAUSED frames emitted by YouTube while switching tracks cleanly
              if (
                switchingVideoRef.current &&
                latestRef.current.isPlaying &&
                Date.now() - switchStartedAtRef.current < 3500
              ) {
                event.target.playVideo();
                return;
              }
              switchingVideoRef.current = false;
              latestRef.current.onStateSync(false);
            }
          },
          onError: () => {
            switchingVideoRef.current = false;
            latestRef.current.onError();
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerRef.current || !readyRef.current || !videoId) return;
    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      switchingVideoRef.current = false;
      playerRef.current.pauseVideo();
    }
  }, [isPlaying, videoId]);

  useEffect(() => {
    if (!playerRef.current || !readyRef.current) return;
    playerRef.current.setVolume(Math.round(volume * 100));
    if (isMuted) playerRef.current.mute();
    else playerRef.current.unMute();
  }, [volume, isMuted]);

  useEffect(() => {
    if (seekTargetSec === null || !playerRef.current || !readyRef.current || !videoId) return;
    playerRef.current.seekTo(seekTargetSec, true);
  }, [seekTargetSec, videoId]);

  useEffect(() => {
    if (!videoId || !isPlaying) return;
    const timer = window.setInterval(() => {
      if (!playerRef.current || !readyRef.current) return;
      const cur = playerRef.current.getCurrentTime?.() ?? 0;
      const dur = playerRef.current.getDuration?.() ?? 0;
      if (Number.isFinite(cur) && Number.isFinite(dur) && dur > 0) {
        latestRef.current.onProgress(cur, dur);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [videoId, isPlaying]);

  if (!videoId) return null;

  // Keep player >= 200x112px visible so Chrome & mobile browsers allow full-song YouTube playback
  return (
    <div
      aria-label="YouTube full-song player"
      className="fixed right-3 bottom-36 md:bottom-24 z-30 rounded-xl rv-glass-overlay border overflow-hidden shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[#090b10]/85">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#f4f5f7] truncate max-w-[165px]">
          <PlayCircle className="w-3.5 h-3.5 text-[#22d3a6] shrink-0" aria-hidden="true" />
          <span className="truncate">{trackTitle || 'Full Song'}</span>
        </span>
        <button
          type="button"
          aria-label={minimized ? 'Expand YouTube player' : 'Minimize YouTube player'}
          onClick={() => setMinimized((v) => !v)}
          className="w-6 h-6 rounded-md hover:bg-[rgba(255,255,255,0.12)] flex items-center justify-center text-[#f4f5f7]"
        >
          {minimized ? (
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
      <div className={minimized ? 'w-[224px] h-[2px] overflow-hidden' : 'w-[224px] h-[126px]'}>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
