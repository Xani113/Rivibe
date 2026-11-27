import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { authenticateRequest } from '@/lib/auth';
import {
  addTrackToCloudPlaylist,
  deleteCloudPlaylist,
  getAppDb,
  removeTrackFromCloudPlaylist,
} from '@/lib/db';
import { UpdatePlaylistSchema } from '@/lib/validation';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const claims = await authenticateRequest(req);
  if (!claims) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 }),
    );
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Malformed body' } }, { status: 400 }),
    );
  }

  const parsed = UpdatePlaylistSchema.safeParse(body);
  if (!parsed.success) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload' } }, { status: 422 }),
    );
  }

  const db = getAppDb();
  let ok = true;
  if (parsed.data.addTrack) {
    ok = addTrackToCloudPlaylist(db, claims.userId, id, parsed.data.addTrack);
  }
  if (ok && parsed.data.removeTrackId) {
    ok = removeTrackFromCloudPlaylist(db, claims.userId, id, parsed.data.removeTrackId);
  }

  if (!ok) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } }, { status: 404 }),
    );
  }

  return applyCorsHeaders(req, NextResponse.json({ ok: true }));
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const claims = await authenticateRequest(req);
  if (!claims) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 }),
    );
  }
  const { id } = await context.params;
  const db = getAppDb();
  const deleted = deleteCloudPlaylist(db, claims.userId, id);
  if (!deleted) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } }, { status: 404 }),
    );
  }
  return applyCorsHeaders(req, NextResponse.json({ ok: true }));
}
