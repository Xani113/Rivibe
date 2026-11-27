# Changelog

## [1.1.0] - 2026-11-27
### Added
- **Next.js Cloud Backend (`backend/`):** Added Next.js App Router backend with `node:sqlite` database, `bcryptjs` + `jose` JWT user accounts, cloud playlist & taste sync (`/api/auth/*`, `/api/library/*`), and server-side music catalog proxy (`/api/music/*`).
- **Full-Length Song Playback:** Integrated official **YouTube Data API v3** catalog search + **YouTube IFrame Player Bridge** (`YT FULL` playback synced to the floating player) alongside Audius/Jamendo full streams, plus a **Full Songs Only** filter toggle.
- **Cloud Account UI:** Added `AuthModal` and top-bar cloud sync indicator with seamless offline fallback when running static PWA/APK standalone.

## [1.0.0] - 2026-11-27
### Added
- **Warm Spatial Glass UI:** Floating left navigation rail, collapsible `Library` sidebar, time-aware personalized greeting, frosted search capsule, mood chips, 4-column cover grid, and floating bottom playback pill with amber progress filament.
- **Mobile Side-Wise & Portrait Adaptive Layout:** Dedicated landscape side-wise rail mode (`max-height: 560px`) alongside portrait thumb dock and slide-over library drawer.
- **Spotify-Style `VibeEngine`:** Taste vector tracking across likes, plays, completions, skips, and moods; `Discover Weekly`, `Daily Mixes`, `Because You Liked...`, `Track Radio`, and infinite queue continuation with artist diversity caps.
- **Public Music APIs Integration (`public-apis#music`):** Out-of-the-box keyless connectors (`iTunes Search`, `Audius`, `ListenBrainz`, `Radio Browser`, `Lyrics.ovh`, `TheAudioDB`, `Genrenator`) plus local API Key Vault for `Last.fm`, `TasteDive`, and `Jamendo`.
- **Chrome PWA & GitHub Android APK:** Web App Manifest, Workbox offline service worker, PNG & SVG icons, Media Session lock-screen controls, Capacitor Android project (`android/`), and GitHub Actions CI/CD release pipeline.
