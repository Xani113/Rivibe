import { useId } from 'react';
import type { Playlist } from '../types/music';
import { ArtworkImage } from './ArtworkImage';

interface PlaylistCoverProps {
  playlist: Playlist;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Renders a heart-shaped vector emblem for the Liked Songs playlist
 * and standard album cover imagery for user-created playlists.
 */
export function PlaylistCover({ playlist, size = 'lg', className = '' }: PlaylistCoverProps) {
  const gradId = useId();
  const isLikedPlaylist =
    playlist.id === 'pl-liked' ||
    (playlist.isSystem && playlist.name.trim().toLowerCase() === 'liked songs');

  if (isLikedPlaylist) {
    const svgSizeClass =
      size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-12 h-12' : 'w-3/5 h-3/5';
    return (
      <div
        aria-hidden="true"
        className={`relative flex items-center justify-center bg-[radial-gradient(circle_at_30%_25%,rgba(167,139,250,0.28),rgba(236,72,153,0.16)_52%,rgba(16,19,27,0.96)_100%)] ${className}`}
      >
        <svg
          viewBox="0 0 64 64"
          className={`${svgSizeClass} drop-shadow-[0_6px_16px_rgba(124,92,255,0.45)]`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="52%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path
            d="M32 55.2C31.1 55.2 30.3 54.9 29.6 54.3C14.7 42.1 7 32.7 7 21.8C7 13.7 13.4 7.5 21.4 7.5C25.8 7.5 29.9 9.5 32 12.6C34.1 9.5 38.2 7.5 42.6 7.5C50.6 7.5 57 13.7 57 21.8C57 32.7 49.3 42.1 34.4 54.3C33.7 54.9 32.9 55.2 32 55.2Z"
            fill={`url(#${gradId})`}
          />
        </svg>
      </div>
    );
  }

  return (
    <ArtworkImage
      src={playlist.coverUrl}
      className={`object-cover bg-[#181d29] ${className}`}
    />
  );
}
