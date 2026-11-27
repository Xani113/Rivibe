# RiVibe

> Warm spatial glass music discovery, live internet radio, and Spotify-style personalized recommendations — powered by a Next.js + SQLite Cloud Backend, YouTube Data API v3 / public music APIs, installable Chrome PWA, and downloadable Android APK.

## Features
- **Full-Length Song Playback:**
  - **Audius & Jamendo (`FULL`):** Native HTML5 full-length streaming out of the box.
  - **YouTube Data API v3 (`YT FULL`):** Add your Google Cloud `YOUTUBE_API_KEY` (in `backend/.env.local` or API Vault) to unlock full-length official songs via the embedded YouTube IFrame Player synced directly into the floating glass player.
  - **Full Songs Only Toggle:** Filter the home grid and search results to full-length streams with one tap.
  - **iTunes Search (`30s`):** Instant fallback previews when no full-length source is configured.
- **Next.js Backend & SQLite Cloud Sync (`backend/`):**
  - User registration & sign-in (`bcryptjs` + `jose` HS256 JWT via `httpOnly` cookie & Bearer token for Capacitor Android).
  - Persistent cloud playlists, liked tracks, and taste-vector sync stored in Node's built-in `node:sqlite`.
  - Server-side music catalog proxy (`/api/music/search`, `/api/music/recommend`, `/api/music/resolve-full`) keeping `YOUTUBE_API_KEY`, `LASTFM_API_KEY`, `TASTEDIVE_API_KEY`, and `JAMENDO_CLIENT_ID` off the client and bypassing browser CORS restrictions (e.g. Deezer).
- **Warm Spatial Glass UI & Mobile "Side-Wise" UX:**
  - Floating vertical rail, collapsible `Library` sidebar, frosted search capsule, mood chips, and floating amber playback pill.
  - Dedicated mobile side-wise landscape rail (`max-height: 560px`) + mobile portrait bottom dock.
- **Installable from Chrome (PWA) & Downloadable Android APK from GitHub:**
  - PWA `manifest.webmanifest` + Workbox offline service worker + Media Session lock-screen controls.
  - Capacitor Android (`android/`) + GitHub Actions CI/CD workflow (`.github/workflows/ci-and-release.yml`) releasing `rivibe-android.apk`.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   npm --prefix backend install
   ```
2. Optional: copy `backend/.env.example` to `backend/.env.local` and add your `YOUTUBE_API_KEY` (from Google Cloud Console -> YouTube Data API v3) and optional `LASTFM_API_KEY` / `TASTEDIVE_API_KEY` / `JAMENDO_CLIENT_ID`.
3. Start **both** Vite frontend (`:5173`) and Next.js backend (`:3001`) together:
   ```bash
   npm run dev
   ```

## Verification Commands
```bash
npm run lint       # ESLint check
npm run typecheck  # Strict TypeScript check (frontend + Next.js backend)
npm test           # Vitest frontend (RTL + MSW + axe-core) & backend (SQLite + Auth + YouTube proxy)
npm run build      # Production Vite + PWA bundle
npm run build:all  # Production PWA + Next.js backend build
```
