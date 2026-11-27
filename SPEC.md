# RiVibe — Specification (`SPEC.md`)

## 1. Objective
**RiVibe** is an installable cross-platform music discovery, streaming preview, internet radio, and Spotify-style personalized recommendation application built with a warm spatial frosted-glass aesthetic. Users can run RiVibe in any browser, install it directly from Chrome as a Progressive Web App (PWA), or download/sideload the Android `.apk` packaged via Capacitor and GitHub Releases.

## 2. Tech Stack
- **Frontend:** React 19, TypeScript (strict), Vite 6, Tailwind CSS v4 + CSS custom property design tokens, Lucide React icons
- **Audio & Media:** HTML5 Audio Engine + Web Media Session API (lock-screen/notification controls)
- **PWA / Chrome Install:** `vite-plugin-pwa` (Web App Manifest, Workbox offline caching, `beforeinstallprompt` install UX)
- **Mobile Packaging / GitHub APK:** Capacitor (`@capacitor/core`, `@capacitor/android`) + GitHub Actions APK Release Workflow
- **Music APIs (`https://github.com/public-apis/public-apis#music`):**
  - **Out-of-the-box Keyless APIs (CORS-enabled):**
    - iTunes Search API (`search`, `lookup`) — songs, albums, artists, high-res artwork, 30s AAC audio previews
    - Audius Discovery API — full-length indie/electronic/pop audio streams, trending & mood discovery
    - TheAudioDB (`apiKey=123` public test key or user key) — artist bios, moods, styles, genres, fanart
    - ListenBrainz API — fresh releases radar & open discovery data
    - Radio Browser API — live internet radio stations by genre/country
    - Lyrics.ovh API — song lyrics lookup
    - Genrenator API — serendipitous genre/vibe seeds
  - **Optional User-Supplied API Keys (API Vault + `.env`):**
    - Last.fm (`apiKey`) — `track.getSimilar`, `artist.getSimilar`, `tag.getTopTracks`
    - TasteDive (`apiKey`) — cross-artist recommendation graph
    - Jamendo (`client_id`) — full-length Creative Commons streams & mood tags
    - TheAudioDB (`apiKey`) — dedicated personal quota key
    - Genius (`token`) / Spotify (`clientId`) — optional metadata & external link integration
- **Testing & Quality:** Vitest, React Testing Library, `vitest-axe`, MSW (Mock Service Worker), ESLint, TypeScript (`tsc --noEmit`)

## 3. Commands
```bash
npm run dev          # Start local Vite dev server (accessible on localhost & LAN for mobile testing)
npm run build        # Typecheck + production Vite + PWA bundle
npm test             # Run Vitest unit, integration, and accessibility test suite
npm run test:cov     # Run Vitest with V8 coverage report
npm run lint         # Run ESLint across src/ and tests/
npm run typecheck    # Run tsc --noEmit
npm run cap:sync     # Sync web build into native Android Capacitor project
```

## 4. Project Structure
```text
rivibe/
├── .github/workflows/       # CI tests, GitHub Pages PWA deploy, Android APK release build
├── android/                 # Capacitor Android project for GitHub APK builds
├── public/                  # PWA icons, maskable icons, offline fallback assets
├── src/
│   ├── components/          # UI modules (Rail, Sidebar, MainStage, PlayerPill, Drawers, Modals)
│   ├── context/             # PlayerContext, LibraryContext, SettingsContext
│   ├── engine/              # VibeEngine (Spotify-style scoring, taste profile, mixes, radio)
│   ├── hooks/               # Custom hooks (useDebounce, useInstallPrompt, useMediaSession)
│   ├── services/            # public-apis#music adapters, normalizer, cache, API vault
│   ├── styles/              # Design tokens, spatial warm-glass CSS utilities
│   ├── types/               # Strict TypeScript domain contracts
│   └── test/                # MSW handlers, test setup, test utilities
├── tasks/                   # Implementation plan (plan.md) & checklist (todo.md)
├── CLAUDE.md                # ECC workflow & architecture guide for this repo
├── DESIGN.md                # Design system & token rationale
└── SPEC.md                  # This specification
```

## 5. Code Style & Architecture Principles
- Pure functional domain logic in `src/engine/` with zero UI imports, 90%+ unit test coverage.
- Normalized `Track`, `Artist`, `Album`, `Playlist`, and `RadioStation` models at the service boundary; untrusted API responses parsed defensively.
- All interactive elements meet WCAG 2.2 AA (44x44px hit areas where layout permits, keyboard navigable, `aria-label` on icon buttons, `prefers-reduced-motion` support).
- Zero secrets in source or version control; user API keys stored locally in browser `localStorage` via versioned vault or local `.env` (never committed).

## 6. Testing Strategy
- **Unit (`src/engine/`, `src/services/`):** Recommendation scoring, diversity caps, taste-vector updates, API normalizers, cache/storage versioning.
- **Integration (`src/components/`):** MSW-mocked API responses, search, liking/skipping feedback updating recommendations, playlist creation, player playback controls, API Key Vault modal, PWA/APK download drawer.
- **Accessibility:** `vitest-axe` assertions on core views and dialogs.
- **Runtime Verification:** Production preview tested in headless Chromium across Desktop (`1440x900`), Mobile Portrait (`390x844`), and Mobile Side-Wise Landscape (`844x390`) with zero console errors.

## 7. Boundaries
- **Always do:** Validate external API payloads, handle loading/empty/error states cleanly, run tests + typecheck + build before commits.
- **Ask first:** Changing storage schema breaking user playlists without migration, adding paid-only API dependencies.
- **Never do:** Hardcode or commit real API keys/secrets, use `transition: all` or `will-change: all`, bypass CORS errors silently without user feedback.

## 8. Success Criteria
1. App opens immediately to the Warm Spatial Glass Music UI matching the user's design direction, with zero setup or forced sign-in.
2. Live music search, audio playback, lyrics, and live radio stations work out of the box via keyless `public-apis#music` providers.
3. Spotify-style recommendation engine (`Made For You`, `Daily Mixes`, `Discover Weekly`, `Because You Listened`, `Track Radio`, `Infinite Queue`) updates dynamically from likes, skips, plays, and mood filters—and upgrades seamlessly when user adds Last.fm / TasteDive / Jamendo / AudioDB keys in API Vault.
4. Responsive across Desktop (`1440px`), Tablet (`768px`), Mobile Portrait (`390px`), and Mobile Side-Wise Landscape (`844x390`).
5. Installable via Chrome PWA (`manifest.webmanifest` + Service Worker + in-app Install CTA) and packaged with Capacitor Android + GitHub Actions `.apk` release pipeline.
6. All unit, integration, and accessibility tests pass (`npm test`), `npm run typecheck` and `npm run build` pass cleanly.
