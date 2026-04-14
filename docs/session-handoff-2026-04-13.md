# Session Handoff — April 13, 2026

## What This Branch Is

`feat/website-capture-design-md` — Website capture pipeline + skill system for turning URLs into HyperFrames videos. Rebased on latest main (v0.3.0, 28 commits ahead). Not yet pushed or PR'd.

## What Was Built (All Working)

### Capture Pipeline (`packages/cli/src/capture/`)
- `npx hyperframes capture <URL>` — extracts design tokens, assets, screenshots, animations, Lottie, shaders, video manifest
- Two-pass strategy: Pass 1 (full JS) captures WebGL/Lottie/animations, Pass 2 (stable HTML) extracts tokens
- Downloads SVGs, images, fonts, favicons with deduplication and batch parallelism
- Generates `CLAUDE.md` per capture with brand summary and example prompts
- Bug fix needed: `assetDownloader.ts` `fetchBuffer()` — added content-type check to reject XML error responses saved as images (staged but not committed)

### Website-to-HyperFrames Skill (`skills/website-to-hyperframes/`)
Full 6-step pipeline: Capture → Read ALL data → Create DESIGN.md → Plan video (Creative Director) → Build compositions (Engineer) → Lint/validate/preview.

### Compose Skill Improvements (`skills/hyperframes/SKILL.md`)
- Added `<HARD-GATE>` Visual Identity Gate — requires DESIGN.md or visual-style.md before ANY HTML writing
- 4-step cascade: existing DESIGN.md → visual-style.md → named style → ask 3 questions
- **TEST RESULT: 4/4 tests created DESIGN.md before HTML. This works.**

### New Reference Files
- `references/visual-styles.md` — 8 named visual styles (Swiss Pulse, Velvet Standard, Deconstructed, Maximalist Type, Data Drift, Soft Signal, Folk Frequency, Shadow Cut) with hex palettes, GSAP easing, shader pairings
- `references/asset-sourcing.md` — How to source brand logos (Simple Icons), company logos (Clearbit), icons (Lucide), photos (Unsplash) with exact curl commands
- `references/video-recipes.md` — 5-layer composition system (L1-L5), shader-first transition pattern, seeded PRNG grain, motion vocabulary

### DESIGN.md Format
Added sections: `## Style Prompt` (standalone AI-readable paragraph), `## Motion`, `## What NOT to Do` (explicit anti-patterns). Tested and working across all captures.

## What Failed — Shader Transitions

### The Problem
HyperFrames has 14 GLSL shader transitions (domain warp, ridged burn, gravitational lens, etc.) that are a massive visual differentiator. But Claude Code never uses them — every test video uses CSS fade-to-black between scenes.

### What We Tried
1. **Session 1:** Added energy→shader table, verbal commitment requirement ("I will use [shader name]"), shader wiring instructions in Step 5. **Result: 1/3 used shaders** (Arc did, Linear and Perplexity didn't).
2. **Session 2:** Added superpowers-style enforcement — `<HARD-GATE>` tags, Red Flags table (6 rationalizations), self-verification checklist (5 checkboxes). **Result: 0/3 used shaders.** Three different failure modes:
   - Linear: Named "Cinematic Zoom" but wrote CSS clip-path instead — treated verbal commitment as checkbox
   - Stripe: Falsely claimed "shader reference files are not available in the installed skill" — never tried to read them
   - Data Drift: Searched for visual-styles.md in wrong directory, gave up, improvised

### Why Instructions Don't Work For This
The shader transition system requires ~200 lines of WebGL boilerplate (texture capture, shader compilation, state machine, GSAP integration). The agent has to:
1. Read shader-setup.md (200+ lines)
2. Read shader-transitions.md (pick a fragment shader)
3. Hold all of that in working memory
4. Write it from scratch into index.html
5. While ALSO managing scenes, narration, captions, fonts, assets, timing

The agent takes the easy path every time: CSS fades (3 lines vs 200).

### What Might Actually Work (Untested)
- **Option A: Inline the shader boilerplate** directly in the SKILL.md as a copy-paste code block instead of referencing a separate file. The agent can't skip code that's right in front of it.
- **Option B: Template file** — `index-template-with-shaders.html` with WebGL pre-wired. Agent fills in scene IDs and picks a fragment shader.
- **Option C: Engine feature** — `data-transition="cinematic-zoom"` as a framework attribute. Engine handles WebGL internally. This is the long-term answer but requires real engineering in `packages/engine`.

### Key Insight From Testing
Instructions work when they're **structurally useful** to the agent (DESIGN.md helps it write better HTML → 4/4 compliance). Instructions fail when they add **extra work** the agent can shortcut (shader WebGL boilerplate → 0/3 compliance).

## Git State

- Branch: `feat/website-capture-design-md`
- Rebased on latest `origin/main` (v0.3.0)
- 6 commits + 10 staged files (not committed)
- Staged files:
  - `skills/hyperframes/SKILL.md` (DESIGN.md hard gate + visual-styles.md reference)
  - `skills/hyperframes/visual-styles.md` (NEW)
  - `skills/website-to-hyperframes/SKILL.md` (shader enforcement — may want to remove the failed enforcement parts)
  - `skills/website-to-hyperframes/references/asset-sourcing.md` (NEW)
  - `skills/website-to-hyperframes/references/visual-styles.md` (NEW)
  - `skills/website-to-hyperframes/references/video-recipes.md` (5-layer system)
  - `packages/cli/src/capture/index.ts` (capture pipeline)
  - `packages/cli/src/capture/agentPromptGenerator.ts` (capture pipeline)
  - `packages/cli/src/capture/assetDownloader.ts` (capture pipeline + content-type fix)
  - `docs/superpowers/specs/2026-04-13-preproduction-enforcement-design.md` (design spec)
- ~49 unstaged test/template files — NOT ours, caused by a bug where `npx hyperframes preview` overwrites TRANSCRIPT arrays in test fixtures. Discard with `git checkout -- packages/producer/tests/ templates/`

## Existing Captures Available for Testing

28 captures in `captures/` including: linear, perplexity, arc-browser, stripe-website, notion, framer, midjourney, resend, vercel-tour, and more. Each has screenshots, tokens.json, assets, visible-text.txt.

## Installed Skills & Tools
- Superpowers v5.0.7 (brainstorming, TDD, debugging, code review, etc.)
- GSAP skills (core, timeline, plugins, performance, scrolltrigger, utils)
- HeyGen skills (create-video, visual-style, avatar-video, TTS, etc.)
- Remotion best practices (38 rule files at `.agents/skills/remotion-best-practices/`)
- ElevenLabs MCP (TTS)
- Playwright MCP (browser automation)

## Key Files to Read
- `skills/website-to-hyperframes/SKILL.md` — the main workflow
- `skills/hyperframes/SKILL.md` — compose skill with DESIGN.md gate
- `skills/hyperframes/house-style.md` — motion defaults, anti-defaults table
- `skills/hyperframes/references/transitions/shader-setup.md` — the WebGL boilerplate that agents won't read
- `skills/hyperframes/references/transitions/shader-transitions.md` — 14 fragment shaders
- `.claude/projects/-Users-ularkimsanov-Desktop-hyperframes-3/memory/MEMORY.md` — persistent memory index

## What To Do Next

1. **Commit what works** — DESIGN.md gate, visual styles, asset sourcing, video recipes, capture pipeline. These are proven wins.
2. **Solve shader transitions** — try Option A (inline boilerplate in skill) or Option B (template file). Test with subagents or fresh sessions.
3. **Fix the transcript overwrite bug** — `npx hyperframes preview` is mutating test fixtures and templates.
4. **Test non-capture videos** — the DESIGN.md gate works but named styles (like "Data Drift") fail because the agent can't find visual-styles.md. The file path needs to be more prominent in the compose skill.
