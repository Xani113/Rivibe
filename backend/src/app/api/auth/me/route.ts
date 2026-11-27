import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { authenticateRequest } from '@/lib/auth';
import { findUserById, getAppDb } from '@/lib/db';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const claims = await authenticateRequest(req);
  if (!claims) {
    return applyCorsHeaders(req, NextResponse.json({ user: null }, { status: 200 }));
  }
  const db = getAppDb();
  const user = findUserById(db, claims.userId);
  return applyCorsHeaders(req, NextResponse.json({ user }));
}
