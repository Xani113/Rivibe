import { useEffect, useState } from 'react';
import { SEED_TRACKS } from '../services/seedCatalog';

const DEFAULT_FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

function normalizeInitialArtwork(src?: string, youtubeVideoId?: string): string {
  const clean = src?.trim() ?? '';
  if (clean.includes('maxresdefault.jpg')) {
    return clean.replace('maxresdefault.jpg', 'hqdefault.jpg');
  }
  if (clean) return clean;
  if (youtubeVideoId) {
    return `https://i.ytimg.com/vi/${youtubeVideoId.replace(/^yt-/, '')}/hqdefault.jpg`;
  }
  return DEFAULT_FALLBACK_ART;
}

interface ArtworkImageProps {
  src?: string;
  youtubeVideoId?: string;
  alt?: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  priority?: 'high' | 'low' | 'auto';
}

/**
 * Renders track/album cover artwork with automatic YouTube thumbnail downgrade recovery
 * before falling back to local vector art, preventing 404 maxresdefault stalls.
 */
export function ArtworkImage({
  src,
  youtubeVideoId,
  alt = '',
  className = '',
  loading = 'eager',
  priority,
}: ArtworkImageProps) {
  const initialSrc = normalizeInitialArtwork(src, youtubeVideoId);
  const [resolvedSrc, setResolvedSrc] = useState(initialSrc);

  useEffect(() => {
    setResolvedSrc(normalizeInitialArtwork(src, youtubeVideoId));
  }, [src, youtubeVideoId]);

  const handleError = () => {
    const cleanYtId = youtubeVideoId?.replace(/^yt-/, '').trim();
    const ytFallback = cleanYtId ? `https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg` : '';
    if (resolvedSrc.includes('=w540-h540')) {
      setResolvedSrc(resolvedSrc.replace('=w540-h540-l90-rj', '=w226-h226-l90-rj'));
      return;
    }
    if (ytFallback && resolvedSrc !== ytFallback) {
      setResolvedSrc(ytFallback);
      return;
    }
    if (resolvedSrc !== DEFAULT_FALLBACK_ART) {
      setResolvedSrc(DEFAULT_FALLBACK_ART);
    }
  };

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchPriority={priority}
      onError={handleError}
      className={className}
    />
  );
}
