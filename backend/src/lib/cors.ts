import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'capacitor://localhost',
  'https://localhost',
];

function getAllowedOrigins(): Set<string> {
  const envList = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED, ...envList]);
}

export function applyCorsHeaders(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get('origin');
  const allowed = getAllowedOrigins();
  if (origin && allowed.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-youtube-api-key, x-lastfm-api-key, x-tastedive-api-key, x-jamendo-client-id',
    );
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  return res;
}

export function corsPreflight(req: NextRequest): NextResponse {
  return applyCorsHeaders(req, new NextResponse(null, { status: 204 }));
}
