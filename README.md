# RiVibe

> Fast, distraction-free music player with keyless native YouTube Music streaming (Android), browser YouTube/Audius fallback, full queue management, synced lyrics, and playlists.

## Key Features
- **Velune-Grade Core Workflow (Home · Search · Library · Queue):**
  - **Home:** Mood filter chips, Quick Picks, Keep Listening strip, and Ready to Stream cards.
  - **Search:** Instant search across native YouTube Music Innertube (Android APK), YouTube IFrame / Audius / iTunes (Web/PWA), plus saved Recent Searches.
  - **Library:** Playlists (create, delete, add/remove tracks, Play All / Queue All), Liked Songs, and Play History.
  - **Playback Queue & Up Next:** **Add to Queue**, **Play Next**, **Remove from Queue**, reorder items, **Clear Queue**, **Shuffle**, **Repeat (`Off` / `All` / `One`)**, and Autoplay Radio.
  - **Now Playing Studio:** Ambient cover backdrop, time-synced LRC lyrics (LRCLIB) with tap-to-seek + Lyrics.ovh fallback, and inline Up Next management.
- **Native Android Streaming (`android/`):**
  - Keyless YouTube Music Innertube + NewPipeExtractor + Media3 ExoPlayer foreground playback service with lock-screen MediaSession controls.
- **Obsidian Slate & Electric Mint UI:**
  - Full-bleed desktop sidebar + docked player bar, portrait mobile 3-tab shell, and side-wise landscape rail adaptation.
- **Installable PWA & GitHub APK Releases:**
  - Automated CI builds and publishes the Chrome-installable PWA to GitHub Pages and builds `rivibe-android.apk`.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   npm --prefix backend install
   ```
2. Start **both** Vite frontend (`:5173`) and optional Next.js backend (`:3001`):
   ```bash
   npm run dev
   ```

## Verification Commands
```bash
npm run lint       # ESLint check
npm run typecheck  # Strict TypeScript check (frontend + Next.js backend)
npm test           # Vitest frontend (RTL + MSW + axe-core) & backend tests
npm run build      # Production Vite + PWA bundle
npm run build:all  # Production PWA + Next.js backend build
```
