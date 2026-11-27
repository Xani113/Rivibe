import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, corsPreflight } from '@/lib/cors';
import { LoginSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { findUserByEmail, getAppDb } from '@/lib/db';
import { isHttpsRequest, SESSION_COOKIE_NAME, signSessionToken, verifyPassword } from '@/lib/auth';

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts' } }, { status: 429 }),
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

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password required' } }, { status: 422 }),
    );
  }

  const db = getAppDb();
  const row = findUserByEmail(db, parsed.data.email);
  if (!row || !(await verifyPassword(parsed.data.password, row.password_hash))) {
    return applyCorsHeaders(
      req,
      NextResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, { status: 401 }),
    );
  }

  const user = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };

  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  });

  const res = NextResponse.json({ user, token });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsRequest(req),
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return applyCorsHeaders(req, res);
}
