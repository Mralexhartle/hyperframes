# Hyperframes

## Skills — USE THESE FIRST

This repo ships skills that are installed globally via `npx hyperframes skills` (runs automatically during `hyperframes init`). **Always use the appropriate skill instead of writing code from scratch or fetching external docs.**

### HyperFrames Skills (from this repo)

| Skill                    | Invoke with             | When to use                                                                                                                                                                                                                 |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **hyperframes-compose**  | `/hyperframes-compose`  | Creating ANY HTML composition — videos, animations, title cards, overlays. Contains required HTML structure, `class="clip"` rules, GSAP timeline patterns, and rendering constraints.                                       |
| **hyperframes-captions** | `/hyperframes-captions` | Any task involving text synced to audio: captions, subtitles, lyrics, lyric videos, karaoke. Also covers transcription strategy (whisper model selection, whisper.cpp flags, transcript format). Lyric videos ARE captions. |

### GSAP Skills (from [greensock/gsap-skills](https://github.com/greensock/gsap-skills))

| Skill                  | Invoke with           | When to use                                                                      |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------- |
| **gsap-core**          | `/gsap-core`          | `gsap.to()`, `from()`, `fromTo()`, easing, duration, stagger, defaults           |
| **gsap-timeline**      | `/gsap-timeline`      | Timeline sequencing, position parameter, labels, nesting, playback               |
| **gsap-performance**   | `/gsap-performance`   | Performance best practices — transforms over layout props, will-change, batching |
| **gsap-plugins**       | `/gsap-plugins`       | ScrollTrigger, Flip, Draggable, SplitText, and other GSAP plugins                |
| **gsap-scrolltrigger** | `/gsap-scrolltrigger` | Scroll-linked animations, pinning, scrub, triggers                               |
| **gsap-utils**         | `/gsap-utils`         | `gsap.utils` helpers — clamp, mapRange, snap, toArray, wrap, pipe                |

### Why this matters

The skills encode HyperFrames-specific patterns (e.g., required `class="clip"` on all timed elements, GSAP timeline registration via `window.__GSAP_TIMELINE`, `data-*` attribute semantics) that are NOT in generic web docs. Skipping the skills and writing from scratch will produce broken compositions.

### Rules

- When creating or modifying HTML compositions → invoke `/hyperframes-compose` BEFORE writing any code
- When adding captions, subtitles, lyrics, or any text synced to audio → invoke `/hyperframes-captions` BEFORE writing any code
- When transcribing audio or choosing a whisper model → invoke `/hyperframes-captions` BEFORE running any transcription tool — it defines the transcription strategy, model selection, and expected output format
- When creating a video from audio (music video, lyric video, audio visualizer with text) → invoke BOTH `/hyperframes-compose` AND `/hyperframes-captions`
- When writing GSAP animations → invoke `/gsap-core` and `/gsap-timeline` BEFORE writing any code
- When optimizing animation performance → invoke `/gsap-performance` BEFORE making changes

### Installing skills

```bash
npx hyperframes skills          # install all to Claude, Gemini, Codex
npx hyperframes skills --claude # Claude Code only
npx skills add greensock/gsap-skills  # alternative: via skills CLI
```

## Project Overview

Open-source video rendering framework: write HTML, render video.

```
packages/
  cli/       → hyperframes CLI (create, preview, lint, render)
  core/      → Types, parsers, generators, linter, runtime, frame adapters
  engine/    → Seekable page-to-video capture engine (Puppeteer + FFmpeg)
  producer/  → Full rendering pipeline (capture + encode + audio mix)
  studio/    → Browser-based composition editor UI
```

## Development

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm test       # Run tests
```

## Key Concepts

- **Compositions** are HTML files with `data-*` attributes defining timeline, tracks, and media
- **Frame Adapters** bridge animation runtimes (GSAP, Lottie, CSS) to the capture engine
- **Producer** orchestrates capture → encode → audio mix into final MP4
- **BeginFrame rendering** uses `HeadlessExperimental.beginFrame` for deterministic frame capture
