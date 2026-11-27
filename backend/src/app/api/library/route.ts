import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { authenticateRequest } from '@/lib/auth';
import {
  getAppDb,
  listUserPlaylists,
  loadUserLibrarySnapshot,
  saveUserLibrarySnapshot,
} from '@/lib/db';
import { SyncLibrarySchema } from '@/lib/validation';

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
  const snapshot = loadUserLibrarySnapshot(db, claims.userId);
  const playlists = listUserPlaylists(db, claims.userId);
  return applyCorsHeaders(req, NextResponse.json({ snapshot, playlists }));
}

export async function PUT(req: NextRequest) {
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

  const parsed = SyncLibrarySchema.safeParse(body);
  if (!parsed.success) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid library payload' } }, { status: 422 }),
    );
  }

  const db = getAppDb();
  saveUserLibrarySnapshot(db, claims.userId, parsed.data);
  return applyCorsHeaders(req, NextResponse.json({ ok: true }));
}
