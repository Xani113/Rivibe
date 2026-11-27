# RiVibe Design System (`DESIGN.md`)

## 1. Design Direction
- **Purpose:** Daily-use spatial music discovery, recommendation, and streaming player built for instant scanning, calm focus, and effortless playback on desktop, mobile portrait, and mobile landscape ("side-wise").
- **Audience:** Listeners who want Spotify-level discovery and mixes with a warm, tactile, distraction-free glass aesthetic instead of neon purple gradients or cluttered tables.
- **Tone:** Warm Spatial Acoustic Glass — smoked espresso, champagne taupe, frosted alabaster translucency, and warm amber-gold playback highlights.
- **Memorable Detail:** A luminous warm-amber progress filament inside a floating glass playback capsule, paired with a floating vertical glass rail that adapts cleanly into a mobile side-wise dock or portrait bottom dock.

## 2. Color Tokens
| Token | Value | Role |
|---|---|---|
| `--rv-bg-canvas` | `#120e0b` | Deep espresso canvas behind spatial window |
| `--rv-glass-window` | `rgba(62, 52, 43, 0.56)` | Main spatial glass container (`blur(36px) saturate(135%)`) |
| `--rv-glass-sidebar` | `rgba(26, 21, 17, 0.38)` | Library sidebar smoked depth |
| `--rv-glass-pill` | `rgba(255, 248, 240, 0.14)` | Floating nav rail & bottom playback capsule |
| `--rv-glass-hover` | `rgba(255, 248, 240, 0.18)` | Hover / active pill fill |
| `--rv-border-luminous` | `rgba(255, 244, 230, 0.20)` | Top/outer glass edge reflection |
| `--rv-border-subtle` | `rgba(255, 244, 230, 0.10)` | Inner dividers & card outlines |
| `--rv-text-primary` | `#fbf7f2` | Primary headings & track titles (>12:1 on dark glass) |
| `--rv-text-secondary` | `rgba(247, 239, 230, 0.72)` | Artist names, subtitles, metadata |
| `--rv-text-muted` | `rgba(247, 239, 230, 0.52)` | Secondary captions & timestamps |
| `--rv-accent-amber` | `#f0c46c` | Active progress filament, match badges, live wave |
| `--rv-accent-amber-soft` | `rgba(240, 196, 108, 0.20)` | Active badge tint |
| `--rv-accent-coral` | `#e87a64` | Liked heart active indicator |

## 3. Typography & Rhythm
- **Font Family:** `'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif` (loaded cleanly with system fallback).
- **Hierarchy:** `h1` greeting (`clamp(1.375rem, 2.5vw, 1.875rem)`, `text-wrap: balance`), `h2` section headers (`1.125rem`, semibold), `body` (`0.9375rem`), `caption` (`0.8125rem`, `text-wrap: pretty`).
- **Numeric Alignment:** `font-variant-numeric: tabular-nums` on all playback timers, durations, BPM/track counts, and recommendation match scores.
- **Spacing Scale:** Strict 4px/8px grid (`4, 8, 12, 16, 20, 24, 32px`).

## 4. Radii & Optical Polish
- **Concentric Radius:** Main window `28px` -> sidebar / search bar `18px` -> album card frame `18px` (padding `6px`) -> album artwork `12px`.
- **Image Outlines:** Every album cover uses `outline: 1px solid rgba(255, 255, 255, 0.10); outline-offset: -1px;` so dark/light album edges never bleed into the glass.
- **Motion:** Transitions target explicit properties (`transform`, `opacity`, `background-color`, `box-shadow`, `border-color`) at `150ms–220ms ease-out` — zero `transition: all`. Tactile button press uses `scale(0.96)` (disabled under `prefers-reduced-motion`).
- **Hit Areas:** All icon controls maintain `>= 40x40px` (`44x44px` on mobile touch targets).

## 5. Responsive / Mobile "Side-Wise" Adaptation
1. **Desktop / Tablet (`>= 900px`):** Floating left vertical glass rail + full `Library` sidebar + 4-column content grid + centered floating bottom glass playback capsule.
2. **Mobile Side-Wise Landscape (`orientation: landscape` and `max-height: 560px`):** Compact `52px` left floating glass rail + collapsible Library drawer + horizontally dense 3–4 column grid + slim bottom floating capsule so the player remains unobstructed in side-wise grip.
3. **Mobile Portrait (`< 768px`):** Top compact greeting + Library drawer trigger + Install/API pills + 2-column cover grid + floating mini-player capsule above a sleek ergonomic bottom glass nav dock; tapping the mini-player opens an immersive full-screen Now Playing & Lyrics/Recommendations sheet.
