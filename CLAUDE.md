# CLAUDE.md — RiVibe Engineering Guide (ECC)

## Project Overview
**RiVibe** is an installable spatial-glass music streaming, discovery, and Spotify-style recommendation PWA + Android mobile app powered by public music APIs (`https://github.com/public-apis/public-apis#music`).

## Architecture & Conventions
- **UI/Design Direction:** Follow `DESIGN.md` strictly (warm espresso/champagne glassmorphism, amber-gold progress accents, concentric radii, neutral image outlines, `tabular-nums`, explicit CSS transitions, >=40px hit areas).
- **State Separation:**
  - `src/engine/` — pure recommendation, scoring, and mix-building logic (no DOM/React imports).
  - `src/services/` — external API adapters with schema validation, caching, and versioned `localStorage`.
  - `src/context/` — `LibraryContext` (taste profile, playlists, API vault) and `PlayerContext` (HTML5 Audio, queue, Media Session).
  - `src/components/` — accessible, responsive React components.
- **Security & Secrets:** Never hardcode API keys. All optional API keys (`Last.fm`, `TasteDive`, `Jamendo`, `TheAudioDB`, `Genius`, `Spotify`) are read from `import.meta.env` or the user's local browser API Vault.
- **Verification Gate:** Before committing, run:
  1. `npm run lint`
  2. `npm run typecheck`
  3. `npm test`
  4. `npm run build`
