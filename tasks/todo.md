# RiVibe Task Checklist (`tasks/todo.md`)

## Phase 1: Foundation & Contracts
- [x] Task 1: Scaffold Vite + React 19 + TypeScript + Tailwind + Vitest + PWA + Capacitor config
- [x] Task 2: Define domain types & warm spatial glass design tokens

## Checkpoint: Foundation
- [x] Foundation builds cleanly and initial setup verified

## Phase 2: Music Services & Recommendation Engine (TDD)
- [x] Task 3: Implement versioned storage & API Key Vault (`src/services/storage.ts`)
- [x] Task 4: Implement `public-apis#music` adapters & aggregator (`src/services/musicApis.ts`)
- [x] Task 5: Implement Spotify-style `VibeEngine` (`src/engine/vibeEngine.ts`)

## Checkpoint: Engine & Services
- [x] `npx vitest run` passes all engine and service tests

## Phase 3: Spatial Glass UI, Player & Mobile Side-Wise UX
- [x] Task 6: Implement `PlayerContext` & `LibraryContext` with audio playback, Media Session, and reactive recommendation feedback
- [x] Task 7: Build Spatial Window Shell (Left Floating Rail, Library Sidebar / Mobile Drawer, Header, Search & Mood Chips)
- [x] Task 8: Build Discovery & Catalog Views (All Playlists/Explore Grid, Made For You Mixes, Songs & Track Radio, Live Radio, Albums, Artists)
- [x] Task 9: Build Bottom Floating Playback Pill, Expanded Now Playing Sheet (Lyrics + Up Next), API Vault Modal, and Get Mobile App Modal

## Checkpoint: Full App & Accessibility
- [x] All component & `axe-core` tests pass

## Phase 4: Mobile Packaging, CI/CD & Final Verification
- [x] Task 10: Configure PWA icons, Capacitor Android project, and GitHub Actions APK + Pages release workflows
- [x] Task 11: Final verification (lint, typecheck, tests, production build, Chrome headless visual verification across Desktop, Mobile Portrait, and Mobile Side-Wise Landscape)
