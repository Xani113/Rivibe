import { useEffect, useState } from 'react';
import type { Track } from '../types/music';

export interface TrackTintPalette {
  cardBg: string;
  cardBorder: string;
  subtextColor: string;
  accentHex: string;
  deepSurface: string;
  drawerSurface: string;
  glowRgba: string;
}

const FALLBACK_PALETTES: Array<[number, number, number]> = [
  [148, 58, 66],   // Deep rose / burgundy
  [38, 128, 118],  // Obsidian teal
  [68, 88, 162],   // Cobalt sapphire
  [142, 92, 48],   // Warm amber bronze
  [108, 68, 148],  // Twilight plum
  [52, 118, 86],   // Emerald slate
];

const tintCache = new Map<string, TrackTintPalette>();

function buildPaletteFromRgb(r: number, g: number, b: number): TrackTintPalette {
  // Keep card background saturated yet dark enough for crisp WCAG white title contrast
  const maxC = Math.max(r, g, b, 1);
  const boost = maxC < 110 ? 135 / maxC : maxC > 195 ? 180 / maxC : 1;
  const br = Math.min(200, Math.max(42, Math.round(r * boost)));
  const bg = Math.min(200, Math.max(38, Math.round(g * boost)));
  const bb = Math.min(200, Math.max(44, Math.round(b * boost)));

  // Lightened warm tint for subtitle readability
  const sr = Math.min(248, Math.round(br + (255 - br) * 0.56));
  const sg = Math.min(248, Math.round(bg + (255 - bg) * 0.56));
  const sb = Math.min(248, Math.round(bb + (255 - bb) * 0.56));

  // Deep album-synced backdrops for lower Now Playing region & collapsed bottom sheet
  const dr = Math.max(10, Math.round(br * 0.25));
  const dg = Math.max(10, Math.round(bg * 0.25));
  const db = Math.max(14, Math.round(bb * 0.27));

  const shr = Math.max(12, Math.round(br * 0.3));
  const shg = Math.max(12, Math.round(bg * 0.3));
  const shb = Math.max(16, Math.round(bb * 0.32));

  return {
    cardBg: `rgba(${br}, ${bg}, ${bb}, 0.42)`,
    cardBorder: `rgba(${sr}, ${sg}, ${sb}, 0.24)`,
    subtextColor: `rgb(${sr}, ${sg}, ${sb})`,
    accentHex: `rgb(${sr}, ${sg}, ${sb})`,
    deepSurface: `rgba(${dr}, ${dg}, ${db}, 0.96)`,
    drawerSurface: `rgba(${shr}, ${shg}, ${shb}, 0.94)`,
    glowRgba: `rgba(${br}, ${bg}, ${bb}, 0.55)`,
  };
}

function hashSeed(input: string): [number, number, number] {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return FALLBACK_PALETTES[Math.abs(h) % FALLBACK_PALETTES.length]!;
}

export function getTrackFallbackTint(track: Track | null | undefined): TrackTintPalette {
  const key = track?.artworkUrl || track?.id || 'rivibe';
  const cached = tintCache.get(key);
  if (cached) return cached;
  const [r, g, b] = hashSeed(`${track?.id ?? ''}:${track?.title ?? ''}:${track?.artworkUrl ?? ''}`);
  return buildPaletteFromRgb(r, g, b);
}

function supportsAnonymousCorsSampling(url: string): boolean {
  if (!url.startsWith('http')) return false;
  // i.ytimg.com thumbnails do not send Access-Control-Allow-Origin headers; avoid duplicate CORS-failed downloads
  return !url.includes('i.ytimg.com');
}

/**
 * Extracts a dark-harmonized album-art tint with immediate deterministic fallback
 * and safe offscreen canvas sampling when CORS allows pixel inspection.
 */
export function useTrackTint(track: Track | null | undefined): TrackTintPalette {
  const artworkUrl = track?.artworkUrl?.trim() ?? '';
  const [palette, setPalette] = useState<TrackTintPalette>(() => getTrackFallbackTint(track));

  useEffect(() => {
    setPalette(getTrackFallbackTint(track));
    if (!artworkUrl || typeof window === 'undefined' || typeof document === 'undefined') return;
    if (tintCache.has(artworkUrl)) {
      setPalette(tintCache.get(artworkUrl)!);
      return;
    }
    if (!supportsAnonymousCorsSampling(artworkUrl)) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const weight = 0.35 + sat * 1.65;
          rSum += r * weight;
          gSum += g * weight;
          bSum += b * weight;
          weightSum += weight;
        }

        if (weightSum > 0) {
          const sampled = buildPaletteFromRgb(rSum / weightSum, gSum / weightSum, bSum / weightSum);
          tintCache.set(artworkUrl, sampled);
          if (!cancelled) setPalette(sampled);
        }
      } catch {
        // Cross-origin canvas taint fallback handled gracefully by deterministic palette
      }
    };
    img.onerror = () => {
      // Preserve immediate deterministic palette without throwing
    };
    img.src = artworkUrl;

    return () => {
      cancelled = true;
    };
  }, [artworkUrl, track]);

  return palette;
}
