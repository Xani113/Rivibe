import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { resolveFullSongViaYouTube } from '@/lib/musicProxy';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`music-resolve:${ip}`, 90, 60 * 1000)) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 }),
    );
  }

  const artist = req.nextUrl.searchParams.get('artist')?.trim() ?? '';
  const title = req.nextUrl.searchParams.get('title')?.trim() ?? '';
  const youtubeKey = req.headers.get('x-youtube-api-key') || process.env.YOUTUBE_API_KEY || '';

  if (!artist || !title || !youtubeKey) {
    return applyCorsHeaders(req, NextResponse.json({ resolved: null }));
  }

  const resolved = await resolveFullSongViaYouTube(artist, title, youtubeKey);
  return applyCorsHeaders(req, NextResponse.json({ resolved }));
}
