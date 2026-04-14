# Context for New Session

## The Project

HyperFrames is an open-source video rendering framework: write HTML, render video. The branch `feat/website-capture-design-md` adds a website capture pipeline and skill system for turning URLs into videos.

## What Exists on This Branch

### Capture Pipeline (`packages/cli/src/capture/`)
`npx hyperframes capture <URL>` extracts a website's design system — colors, fonts, assets, animations, Lottie, WebGL shaders — into a structured folder with screenshots, tokens.json, assets/, and extracted data.

### Skills (AI Agent Instructions)

**`skills/website-to-hyperframes/SKILL.md`** — 6-step workflow:
1. Capture the website
2. Read ALL captured data
3. Create DESIGN.md (brand identity doc)
4. Plan the video (Creative Director role)
5. Build compositions (Engineer role)
6. Lint, validate, preview

**`skills/hyperframes/SKILL.md`** — Compose skill for writing HTML video compositions. Has rules for data attributes, GSAP timelines, deterministic rendering.

**Reference files:**
- `references/visual-styles.md` — 8 named visual styles with hex palettes, GSAP easing, shader pairings
- `references/asset-sourcing.md` — How to source brand logos, icons, photos from free APIs
- `references/video-recipes.md` — Scene patterns, 5-layer composition system, transition patterns
- `references/transitions/shader-setup.md` — WebGL boilerplate for 14 GLSL shader transitions
- `references/transitions/shader-transitions.md` — 14 fragment shaders (domain warp, ridged burn, gravitational lens, etc.)

### 28 Existing Captures
`captures/` has linear, perplexity, arc-browser, stripe-website, notion, framer, midjourney, resend, vercel-tour, and more — each with screenshots, tokens, assets, visible text.

## Git State
- Rebased on latest `origin/main` (v0.3.0)
- 6 commits + 10 staged files (not yet committed)
- ~49 unstaged test/template files that are NOT our changes — discard with `git checkout -- packages/producer/tests/ templates/`

## 4 Test Runs Were Completed

Each in a fresh Claude Code session with a single prompt:

1. **Linear capture → 24s launch video**
2. **"Make a 20s video about AI agents replacing jobs"** (no URL, from scratch)
3. **"Make a 20s video showcasing Stripe's payment platform"** (brand-specific)
4. **"Make a 15s Data Drift style video about quantum computing"** (named visual style)

The conversation logs are the 4 most recent JSONL files in:
`/Users/ularkimsanov/.claude/projects/-Users-ularkimsanov-Desktop-hyperframes-3/`

## What To Do

Review the entire skill system, the 4 test conversation logs, and the resulting compositions. Assess:

- What is the skill system doing well?
- What is it doing poorly?
- What specific changes would improve output quality?
- Are there structural issues (not just instruction wording) that need addressing?

Look at the actual HTML compositions produced, the DESIGN.md files, the narration scripts, and the index.html files. Judge the output quality honestly.

## Key Files
- `skills/website-to-hyperframes/SKILL.md`
- `skills/hyperframes/SKILL.md`
- `skills/hyperframes/house-style.md`
- `skills/hyperframes/references/transitions/shader-setup.md`
- `skills/hyperframes/references/transitions/shader-transitions.md`
- `skills/website-to-hyperframes/references/visual-styles.md`
- `skills/website-to-hyperframes/references/video-recipes.md`
- `skills/website-to-hyperframes/references/asset-sourcing.md`
