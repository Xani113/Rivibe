import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'rivibe_session';
const SALT_ROUNDS = 12;

export interface SessionClaims {
  userId: string;
  email: string;
  displayName: string;
}

let cachedSecretBytes: Uint8Array | null = null;

function getJwtSecretBytes(): Uint8Array {
  if (cachedSecretBytes) return cachedSecretBytes;

  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) {
    cachedSecretBytes = new TextEncoder().encode(envSecret);
    return cachedSecretBytes;
  }

  // Generate and persist a random per-install secret when JWT_SECRET is omitted locally
  try {
    const secretFile = path.join(process.cwd(), 'data', '.jwt-secret');
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 32) {
        cachedSecretBytes = new TextEncoder().encode(existing);
        return cachedSecretBytes;
      }
    }
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    const generated = randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    cachedSecretBytes = new TextEncoder().encode(generated);
    return cachedSecretBytes;
  } catch {
    const ephemeral = randomBytes(32).toString('hex');
    cachedSecretBytes = new TextEncoder().encode(ephemeral);
    return cachedSecretBytes;
  }
}

export function isHttpsRequest(req: NextRequest): boolean {
  return req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    email: claims.email,
    displayName: claims.displayName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecretBytes());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      userId: payload.sub,
      email: payload.email,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : 'Listener',
    };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: NextRequest): Promise<SessionClaims | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const claims = await verifySessionToken(token);
      if (claims) return claims;
    }
  }
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieToken) return null;
  return verifySessionToken(cookieToken);
}
