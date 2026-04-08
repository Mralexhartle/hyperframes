# Session Handoff — Website Capture & DESIGN.md System

> Last updated: 2026-04-07 (end of marathon session)
> Branch: `feat/website-capture-design-md`
> Key commit: d60a9f8

## What Was Built This Session

### Core Pipeline: `hyperframes capture <url>`

A complete website-to-video pipeline that produces AI-agent-ready output:

```
hyperframes capture https://stripe.com -o /tmp/stripe
```

**Pipeline steps (in order):**
1. Launch headless Chrome (Puppeteer)
2. Catalog animations (Web Animations API, CSS, IntersectionObserver, CDP)
3. Extract HTML & CSS
4. Extract design tokens (colors, fonts, headings, CTAs, sections, CSS variables)
5. Catalog assets with HTML contexts (img[src], css url(), link[rel=preload], video[src], etc.)
6. Detect JS libraries (GSAP, Three.js, ScrollTrigger, etc. via globals + script URLs)
7. Extract ALL visible text in DOM order
8. Extract inline SVGs (up to 50, 10KB each)
9. **Full-page screenshot via Playwright** (not Puppeteer — Playwright doesn't resize viewport, preserving fixed/sticky layouts)
10. Download assets (fonts, images, SVGs, favicon)
11. **AI-generated DESIGN.md** via Gemini 3.1 Pro or Claude Sonnet (screenshot + tokens → rich design system prose + programmatic asset catalog)
12. **AI-generated replica.html** — clean single-file Tailwind CSS recreation of the website
13. **Refinement pass** — screenshots replica, compares to original, asks AI to fix differences
14. Generate CLAUDE.md + .cursorrules (AI agent instructions)
15. *(Optional)* Split into section compositions, verify, CSS purge, HTML prettify

**Output files:**
- `DESIGN.md` — AI-written design system (colors, typography, elevation, components, do's/don'ts) + programmatic asset catalog with HTML contexts
- `replica.html` — Clean Tailwind CSS recreation (~30-56KB, single file)
- `screenshots/full-page.png` — Full-page website screenshot
- `screenshots/replica-screenshot.png` — Screenshot of the replica (for comparison)
- `CLAUDE.md` + `.cursorrules` — AI agent instructions (auto-read by Claude Code/Cursor)
- `assets/` — Downloaded fonts, images, SVGs, favicon
- `assets/svgs/` — Extracted inline SVGs from the page
- `extracted/` — Raw HTML, CSS, animation data, tokens.json
- `compositions/` — *(if split enabled)* Per-section HTML compositions (CSS-purged, prettified)

### Key Files

| File | Purpose |
|------|---------|
| `packages/cli/src/capture/index.ts` | Pipeline orchestrator |
| `packages/cli/src/capture/designMdGenerator.ts` | AI-powered DESIGN.md generation (Gemini or Claude) |
| `packages/cli/src/capture/replicaGenerator.ts` | AI-powered HTML replica + refinement loop |
| `packages/cli/src/capture/assetCataloger.ts` | Comprehensive asset extraction with HTML contexts |
| `packages/cli/src/capture/screenshotCapture.ts` | Full-page screenshot (Playwright) |
| `packages/cli/src/capture/cssPurger.ts` | PurgeCSS + Prettier for compositions |
| `packages/cli/src/capture/agentPromptGenerator.ts` | CLAUDE.md/.cursorrules generation |
| `packages/cli/src/capture/tokenExtractor.ts` | Design token extraction (colors, fonts, headings, SVGs) |
| `packages/cli/src/capture/animationCataloger.ts` | Animation detection (4 techniques) |
| `packages/cli/src/capture/assetDownloader.ts` | Asset downloading + inline SVG saving |
| `packages/cli/src/capture/briefGenerator.ts` | Legacy (replaced by DESIGN.md, kept for reference) |
| `packages/cli/src/commands/capture.ts` | CLI command definition |

### Research Documentation

| File | Contents |
|------|----------|
| `docs/research/aura-build-and-design-systems.md` | Complete Aura.build analysis, DESIGN.md format, prompt builder |
| `docs/research/aura-prompt-comparison.md` | Side-by-side comparison of Aura's with/without screenshot prompts |
| `docs/research/aura-examples/stripe-DESIGN.md` | Aura's Stripe DESIGN.md for comparison |
| `docs/research/reverse-engineered-aura-system-prompt.md` | **Reverse-engineered Aura system instructions** based on output analysis |

## Known Issues & Gaps

### Screenshot
- Puppeteer `fullPage:true` breaks complex sites (mesh gradients, position:fixed layers) — solved by using Playwright instead
- Chrome 16,384px height limit — pages taller than this get clipped at the bottom
- Stripe's hero wave gradient still shows artifacts in some captures

### Replica Quality
- Gemini 3.1 Pro produces better replicas than Claude Sonnet for visual-to-code
- Company logos in "logo walls" often rendered as text instead of images because the original site uses inline SVGs (not `<img>` tags) — our extractor now saves them to `assets/svgs/` but the AI can't access local files during generation
- Refinement pass sometimes rewrites Tailwind to vanilla CSS (fixed with explicit rules in refinement prompt)
- Complex animations (WebGL gradients, Three.js scenes) not reproduced — AI generates static alternatives

### DESIGN.md
- Comparable to Aura's quality for most sections
- Asset catalog includes HTML contexts (img[src], css url(), link[rel=preload], etc.)
- Deduplicates srcset resolution variants
- Filters tracking pixels and CSS fragment references
- Inline SVGs now saved but listed as local paths (not URLs accessible to external AI)

### Compositions (Optional Path)
- CSS purge reduces captured compositions by 87% (7.2MB → 918KB)
- HTML prettify makes them AI-readable (one-tag-per-line)
- But compositions may be unnecessary — replica.html serves the same purpose more cleanly

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API (for DESIGN.md and replica generation) |
| `ANTHROPIC_API_KEY` | Claude API (fallback for DESIGN.md and replica) |
| `CLAUDE_API_KEY` | Alternative Claude API key name |

Gemini is preferred when set. Falls back to Claude. If neither is set, DESIGN.md uses a structured template (no AI prose) and replica is skipped.

## Model IDs
- Gemini: `gemini-3.1-pro-preview` (NOT gemini-2.5-flash)
- Claude: `claude-sonnet-4-20250514`

## What's Next

### Priority 1: HyperFrames Video Creation Workflow
The whole point was to create VIDEOS from captured websites. The current output (DESIGN.md + screenshot + replica.html) gives an AI agent everything it needs to create on-brand video compositions. But we need:

1. **A prompt/skill that bridges DESIGN.md → HyperFrames compositions** — the AI reads the DESIGN.md, understands the brand, then creates video compositions following HyperFrames rules (GSAP timelines, data-* attributes, clip visibility)
2. **Use-case library** — pre-built prompts for common video types:
   - 15s social media ad
   - 30s product tour
   - Feature highlight reel
   - Testimonial spotlight
   - Competitor comparison
   - Customer case study
3. **Prompt builder** — interactive prompt construction (like Aura's but for video)

### Priority 2: SVG Logo Fix
Inline SVGs are saved locally but the AI can't access them during generation. Options:
- Embed SVG code directly in DESIGN.md (bloats the file)
- Upload to a temp CDN during capture
- Accept this limitation — the local AI agent (Claude Code) CAN read them

### Priority 3: Web Shader Extractor Integration
141K websites use Three.js. Stripe, Linear, Vercel all have WebGL. The lixiaolin94/skills shader extractor could capture these effects. Research done, implementation deferred.

### Priority 4: Prompt Builder UI
Could live in HyperFrames Studio. Categories (from Aura research):
- Scene types: Hero, Features, Stats, Testimonial, CTA, Comparison
- Duration: 15s, 30s, 60s
- Style: Energetic, Corporate, Cinematic, Minimal
- Transitions: Wipe, Fade, Slide, Scale
- Animation: Stagger, Counter, Reveal, Float

## Dependencies Added
- `purgecss` — CSS tree-shaking for compositions
- `prettier` — HTML prettification
- `@anthropic-ai/sdk` — Claude API
- `@google/genai` — Gemini API
- `playwright` — Full-page screenshots (better than Puppeteer for this)

## How to Test

```bash
# Capture with Gemini (recommended)
GEMINI_API_KEY="your-key" npx tsx packages/cli/src/cli.ts capture https://notion.com -o /tmp/test --skip-split

# Capture with Claude (fallback)
ANTHROPIC_API_KEY="your-key" npx tsx packages/cli/src/cli.ts capture https://notion.com -o /tmp/test --skip-split

# With compositions (full pipeline)
GEMINI_API_KEY="your-key" npx tsx packages/cli/src/cli.ts capture https://notion.com -o /tmp/test

# Serve and view replica
python3 -m http.server 3334 --directory /tmp/test
open http://localhost:3334/replica.html
```

## User Preferences (from memory)

- DESIGN.md must be AI-generated prose, not template filling
- Always verify by reading outputs, comparing to references
- Don't hide problems — show them honestly
- Research thoroughly before implementing
- Match Aura.build quality as the benchmark
- Don't add HyperFrames-specific sections to DESIGN.md (keep it universal)
- Full-page screenshot only (no per-section screenshots)
- Gemini 3.1 Pro preferred over Claude for visual-to-code tasks
