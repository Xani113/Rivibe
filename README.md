# RiVibe

> Warm spatial glass music discovery, live internet radio, and Spotify-style personalized recommendations — installable from Chrome (PWA) and downloadable as an Android APK from GitHub.

## Features
- **Warm Spatial Glass UI:** Inspired by spatial translucent acoustic glass — left floating navigation rail, collapsible `Library` sidebar, frosted search capsule, luminous album grid, and floating bottom playback pill with warm amber-gold progress filament.
- **Mobile "Side-Wise" & Portrait Adaptive UX:**
  - **Mobile Side-Wise Landscape:** Compact left floating glass rail + dense grid + slim floating capsule tailored for landscape grip.
  - **Mobile Portrait:** Thumb-friendly bottom glass dock + slide-over Library drawer + expandable Now Playing sheet (lyrics, scrubber, up-next & similar recommendations).
  - **Installable Anywhere:**
    - **From Chrome:** One-click PWA install (`Add to Home Screen` / Chrome Omnibox Install) with offline caching and Media Session lock-screen controls.
    - **From GitHub:** Automated Capacitor Android APK build via GitHub Actions (`.github/workflows/ci-and-release.yml`) + GitHub Pages PWA deploy.
- **Spotify-Style `VibeEngine` Recommendations:**
  - **Out-of-the-box Keyless Discovery:** Powered by `iTunes Search`, `Audius Discovery`, `TheAudioDB`, `ListenBrainz`, `Radio Browser`, `Lyrics.ovh`, and `Genrenator`.
  - **Taste Vector & Feedback Loop:** Learns dynamically from Likes, Plays, Completions, Skips, Mood filters, and Seed Artists.
  - **Explainable Mixes:** `Discover Weekly`, `Daily Mixes`, `Because You Liked...`, `Track Radio`, and `Up Next Infinite Radio` with match scores and artist-diversity caps.
- **API Keys Vault (`public-apis#music`):** Zero setup required by default, plus built-in Settings API Vault and `.env` support for optional keys from [`public-apis/public-apis#music`](https://github.com/public-apis/public-apis#music):
  - Last.fm (`track.getSimilar`, `artist.getSimilar`, `tag.getTopTracks`)
  - TasteDive (similar artist graph)
  - Jamendo (full-length Creative Commons streams)
  - TheAudioDB (rich artist bios & moods)
  - Genius & Spotify client metadata links

## Quick Start
```bash
npm install
npm run dev
```

## Verification Commands
```bash
npm run lint       # ESLint check
npm run typecheck  # Strict TypeScript check
npm test           # Vitest unit, integration, and axe accessibility tests
npm run build      # Production Vite + PWA bundle
```

## Mobile Distribution
### 1. Install from Chrome (PWA)
Open the deployed GitHub Pages URL (or `http://localhost:5173` / `http://<LAN-IP>:5173` on mobile Chrome) and tap **Install RiVibe** in the top bar or Chrome's **Install App / Add to Home Screen** menu.

### 2. Download Android APK from GitHub
Push to `main` or tag a release (`git tag v1.0.0 && git push origin v1.0.0`) on GitHub. The **Build Android APK (Capacitor)** workflow compiles `rivibe-android.apk` and attaches it to the workflow artifacts / GitHub Release so Android users can download and sideload directly.

To sync locally:
```bash
npm run cap:sync
```
