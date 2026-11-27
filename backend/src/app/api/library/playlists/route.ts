import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { authenticateRequest } from '@/lib/auth';
import { createCloudPlaylist, getAppDb, listUserPlaylists } from '@/lib/db';
import { CreatePlaylistSchema } from '@/lib/validation';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const claims = await authenticateRequest(req);
  if (!claims) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 }),
    );
  }
  const db = getAppDb();
  return applyCorsHeaders(req, NextResponse.json({ playlists: listUserPlaylists(db, claims.userId) }));
}

export async function POST(req: NextRequest) {
  const claims = await authenticateRequest(req);
  if (!claims) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 }),
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Malformed body' } }, { status: 400 }),
    );
  }

  const parsed = CreatePlaylistSchema.safeParse(body);
  if (!parsed.success) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid playlist input' } }, { status: 422 }),
    );
  }

  const db = getAppDb();
  const playlist = createCloudPlaylist(db, claims.userId, parsed.data);
  return applyCorsHeaders(req, NextResponse.json({ playlist }, { status: 201 }));
}
