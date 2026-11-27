import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { searchServerCatalog } from '@/lib/musicProxy';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`music-search:${ip}`, 90, 60 * 1000)) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 }),
    );
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length > 160) {
    return applyCorsHeaders(req, NextResponse.json({ tracks: [] }));
  }
  const fullOnly = req.nextUrl.searchParams.get('fullOnly') === 'true';

  const tracks = await searchServerCatalog(
    q,
    {
      youtubeApiKey: req.headers.get('x-youtube-api-key') ?? undefined,
      jamendoClientId: req.headers.get('x-jamendo-client-id') ?? undefined,
    },
    fullOnly,
  );

  return applyCorsHeaders(req, NextResponse.json({ tracks }));
}
