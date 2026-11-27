# Implementation Plan: RiVibe

## Overview
Build **RiVibe**, a spatial warm-glass music discovery, audio streaming, and Spotify-style recommendation app installable from Chrome (PWA) and downloadable from GitHub (Capacitor Android APK + Pages). Follow ECC spec-driven, TDD, and UI/UX engineering workflows.

## Architecture Decisions
1. **PWA + Capacitor Hybrid ("Option C"):** Single TypeScript + React 19 + Vite codebase serving both Chrome installable PWA (manifest, offline service worker, Media Session API) and native Android APK packaging (`capacitor.config.ts` + `android/` + GitHub Actions workflow).
2. **Zero-Key Default + Optional Key Vault (`public-apis#music`):** Default experience uses CORS-enabled keyless providers (`iTunes Search`, `Audius`, `ListenBrainz`, `Radio Browser`, `Lyrics.ovh`, `TheAudioDB`, `Genrenator`) while allowing users to plug in `Last.fm`, `TasteDive`, `Jamendo`, `TheAudioDB`, `Genius`, or `Spotify` keys in the local API Vault or `.env`.
3. **Client-Side Spotify-Style `VibeEngine`:** Pure, deterministic taste-vector and multi-factor scoring engine supporting `Made For You` mixes, `Discover Weekly`, `Because You Listened To`, `Track Radio`, mood filters, diversity caps, and skip learning.

## Task List

### Phase 1: Foundation & Contracts
- [ ] Task 1: Scaffold Vite + React 19 + TypeScript + Tailwind + Vitest + PWA + Capacitor config
- [ ] Task 2: Define domain types (`Track`, `Mix`, `Playlist`, `RadioStation`, `TasteProfile`, `ApiVault`) and design tokens CSS

### Checkpoint: Foundation
- [ ] TypeScript compiles cleanly, test runner executes, git baseline committed

### Phase 2: Music Services & Recommendation Engine (TDD)
- [ ] Task 3: Implement versioned storage & API Key Vault service (`src/services/storage.ts`) with tests
- [ ] Task 4: Implement `public-apis#music` provider adapters (`itunes`, `audius`, `audiodb`, `listenbrainz`, `radiobrowser`, `lyrics`, `lastfm`, `tastedive`, `jamendo`) with MSW-mocked tests
- [ ] Task 5: Implement `VibeEngine` Spotify-style taste vector, scoring, diversity cap, mixes, and infinite track radio (`src/engine/vibeEngine.ts`) with unit tests

### Checkpoint: Core Engine
- [ ] All engine & service tests pass with high coverage

### Phase 3: Spatial Glass UI, Player & Mobile Side-Wise UX
- [ ] Task 6: Implement audio engine (`PlayerContext`), Media Session API, and `LibraryContext` with tests
- [ ] Task 7: Implement Spatial Window Shell: Floating Left Vertical Rail, Library Sidebar / Mobile Drawer, Greeting + Search + Mood Chips
- [ ] Task 8: Implement Views: Discover / All Playlists Grid, Made For You Mixes, Songs & Track Radio, Live Radio Stations, Albums, Artists
- [ ] Task 9: Implement Bottom Floating Glass Playback Pill, Expanded Now Playing Sheet (Lyrics + Up Next + Recommendations), API Vault Modal, and Get Mobile App Modal (Chrome PWA + GitHub APK)

### Checkpoint: UI & Accessibility
- [ ] Component & `vitest-axe` accessibility tests pass

### Phase 4: Mobile Packaging, CI/CD & Verification
- [ ] Task 10: Add Capacitor Android project / scripts and GitHub Actions workflows (CI tests + Pages PWA + Android APK release)
- [ ] Task 11: Run full suite (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`), visually verify Desktop, Mobile Portrait, and Mobile Side-Wise Landscape in headless browser, and commit clean atomic history

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Rate limiting or network failure on a single public music API | High | Multi-provider fallback + in-memory response caching + seeded offline fallback catalog so UI never stalls |
| Audio preview vs full-length mismatch | Medium | Merge Audius full streams with iTunes 30s previews; display clear `FULL` vs `30s PREVIEW` subtle badge |
| Local Windows lacking Android SDK for APK compile | Medium | Scaffold valid Capacitor Android project locally and provide automated GitHub Actions Linux build workflow that compiles & publishes `rivibe-android.apk` on release/push |
