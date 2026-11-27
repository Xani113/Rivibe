import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { RegisterSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { createCloudPlaylist, createUser, findUserByEmail, getAppDb } from '@/lib/db';
import { hashPassword, isHttpsRequest, SESSION_COOKIE_NAME, signSessionToken } from '@/lib/auth';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`register:${ip}`, 15, 15 * 60 * 1000)) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many signup attempts' } }, { status: 429 }),
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Malformed request body' } }, { status: 400 }),
    );
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return applyCorsHeaders(
      req,
      NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Check email, display name, and 8+ char password' } },
        { status: 422 },
      ),
    );
  }

  const db = getAppDb();
  const existing = findUserByEmail(db, parsed.data.email);
  if (existing) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'EMAIL_EXISTS', message: 'Account already exists' } }, { status: 409 }),
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = createUser(db, {
    email: parsed.data.email,
    passwordHash,
    displayName: parsed.data.displayName,
  });

  createCloudPlaylist(db, user.id, {
    name: 'Cloud Favorites',
    description: 'Synced across Chrome PWA, Desktop & Mobile',
  });

  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  });

  const res = NextResponse.json({ user, token }, { status: 201 });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsRequest(req),
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return applyCorsHeaders(req, res);
}
