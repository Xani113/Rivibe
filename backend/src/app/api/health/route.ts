import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { getAppDb } from '@/lib/db';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  getAppDb();
  return applyCorsHeaders(
    req,
    NextResponse.json({
      ok: true,
      service: 'rivibe-nextjs-backend',
      capabilities: {
        youtubeFullSongs: Boolean(process.env.YOUTUBE_API_KEY),
        lastfm: Boolean(process.env.LASTFM_API_KEY),
        tastedive: Boolean(process.env.TASTEDIVE_API_KEY),
        jamendo: Boolean(process.env.JAMENDO_CLIENT_ID),
        audius: true,
        deezerProxy: true,
        itunes: true,
      },
    }),
  );
}
