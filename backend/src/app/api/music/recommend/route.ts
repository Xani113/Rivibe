import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { fetchServerRecommendations } from '@/lib/musicProxy';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`music-rec:${ip}`, 90, 60 * 1000)) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 }),
    );
  }

  const artist = req.nextUrl.searchParams.get('artist')?.trim() ?? 'Troye Sivan';
  const title = req.nextUrl.searchParams.get('title')?.trim() ?? 'Youth';

  const tracks = await fetchServerRecommendations(artist, title, {
    youtubeApiKey: req.headers.get('x-youtube-api-key') ?? undefined,
    lastfmApiKey: req.headers.get('x-lastfm-api-key') ?? undefined,
    tastediveApiKey: req.headers.get('x-tastedive-api-key') ?? undefined,
    jamendoClientId: req.headers.get('x-jamendo-client-id') ?? undefined,
  });

  return applyCorsHeaders(req, NextResponse.json({ tracks }));
}
