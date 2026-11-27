import { useEffect, useRef } from 'react';

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
            onStateChange?: (e: { data: number }) => void;
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
  const callbacksRef = useRef({ onProgress, onStateSync, onEnded, onError });
  callbacksRef.current = { onProgress, onStateSync, onEnded, onError };

  useEffect(() => {
    if (!videoId) {
      if (readyRef.current && playerRef.current) {
        playerRef.current.pauseVideo();
      }
      return;
    }

    let cancelled = false;
    void ensureYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      if (playerRef.current && readyRef.current) {
        playerRef.current.loadVideoById(videoId);
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '1',
        width: '1',
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            event.target.setVolume(Math.round(volume * 100));
            if (isMuted) event.target.mute();
            if (isPlaying) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              callbacksRef.current.onEnded();
            } else if (event.data === 1) {
              callbacksRef.current.onStateSync(true);
            } else if (event.data === 2) {
              callbacksRef.current.onStateSync(false);
            }
          },
          onError: () => {
            callbacksRef.current.onError();
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [videoId, isMuted, isPlaying, volume]);

  useEffect(() => {
    if (!playerRef.current || !readyRef.current || !videoId) return;
    if (isPlaying) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
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
        callbacksRef.current.onProgress(cur, dur);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [videoId, isPlaying]);

  return (
    <div
      aria-hidden="true"
      className="fixed w-px h-px opacity-0 pointer-events-none overflow-hidden -left-10 -top-10"
    >
      <div ref={containerRef} />
    </div>
  );
}
