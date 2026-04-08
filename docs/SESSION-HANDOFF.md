# Session Handoff — Website Capture & Video Creation Pipeline

> Last updated: 2026-04-08
> Branch: `feat/website-capture-design-md`
> Latest commit: b0308cf

## START HERE

Before doing ANYTHING, read these in order:

1. **This file** — understand what was built and what needs validation
2. **`Hyperframes-100-Test-Prompts-v3.pdf`** and **`Hyperframes-Evaluation-Guide.pdf`** — understand what GOOD HyperFrames output looks like (check ~/Downloads/ or root)
3. **`skills/website-to-hyperframes/SKILL.md`** — the skill that drives the workflow (WAS REWRITTEN but NOT VALIDATED)
4. **`skills/website-to-hyperframes/references/`** — 4 reference files (PRE-EXISTING, may be outdated)
5. **Templates at `templates/`** — see how real HyperFrames projects are structured

## What Was Built

### Core: `hyperframes capture <url>`

Extracts everything from a website into an AI-agent-ready project folder:

```bash
# Default (no API key needed):
hyperframes capture https://stripe.com -o stripe-video

# With AI-generated DESIGN.md + replica:
GEMINI_API_KEY="..." hyperframes capture https://stripe.com -o stripe-video

# With per-section compositions:
hyperframes capture https://stripe.com -o stripe-video --split
```

**Output files:**
| File | Purpose |
|------|---------|
| `CLAUDE.md` / `.cursorrules` | AI agent instructions (auto-read) |
| `screenshots/full-page.png` | Full-page screenshot (via Playwright) |
| `extracted/tokens.json` | Colors, fonts, headings, CTAs, sections, CSS vars |
| `extracted/visible-text.txt` | All visible text in DOM order |
| `extracted/assets-catalog.json` | Every asset URL with HTML context |
| `extracted/animations.json` | Animation catalog |
| `assets/` | Downloaded fonts, images, favicon |
| `assets/svgs/` | Extracted inline SVGs |
| `index.html` + `meta.json` | Valid HyperFrames project skeleton |
| `DESIGN.md` | *(if API key set)* AI-generated design system |
| `replica.html` | *(if API key set)* Clean Tailwind recreation |

### Pipeline files:
| File | Purpose |
|------|---------|
| `packages/cli/src/capture/index.ts` | Pipeline orchestrator |
| `packages/cli/src/capture/tokenExtractor.ts` | Design tokens |
| `packages/cli/src/capture/animationCataloger.ts` | Animations |
| `packages/cli/src/capture/assetCataloger.ts` | Asset URLs with contexts |
| `packages/cli/src/capture/assetDownloader.ts` | Download assets + save SVGs |
| `packages/cli/src/capture/screenshotCapture.ts` | Playwright full-page screenshot |
| `packages/cli/src/capture/agentPromptGenerator.ts` | CLAUDE.md generation |
| `packages/cli/src/capture/designMdGenerator.ts` | AI DESIGN.md (optional) |
| `packages/cli/src/capture/replicaGenerator.ts` | AI replica + refinement (optional) |
| `packages/cli/src/capture/cssPurger.ts` | CSS purge for compositions |
| `packages/cli/src/capture/htmlExtractor.ts` | Raw HTML extraction |
| `packages/cli/src/capture/types.ts` | TypeScript types |
| `packages/cli/src/commands/capture.ts` | CLI command |

### Research:
| File | Contents |
|------|----------|
| `docs/research/aura-build-and-design-systems.md` | Aura.build analysis |
| `docs/research/reverse-engineered-aura-system-prompt.md` | Aura system instructions |
| `docs/research/aura-prompt-comparison.md` | Aura prompt variants |
| `docs/research/aura-examples/stripe-DESIGN.md` | Aura's Stripe output |
| `docs/research/video-prompt-catalog.md` | Video prompt library |

## CRITICAL: What Needs Validation

### 1. The website-to-hyperframes skill

The SKILL.md was **completely rewritten** to match the new capture pipeline, but it has **NOT been tested end-to-end**. The 6-step workflow needs validation:

1. Does Step 1 (capture) work reliably?
2. Does Step 2 (read all data) actually happen — does the AI read every file?
3. Does Step 3 (create DESIGN.md) produce good output when the AI writes it vs the API?
4. Does Step 4 (plan video) produce sensible scene plans?
5. Does Step 5 (build compositions) follow HyperFrames rules correctly?
6. Does Step 6 (lint/validate/preview) catch issues?

### 2. The skill references

These 4 files were PRE-EXISTING (not written this session):
- `references/animation-recreation.md` — converting source animations to GSAP
- `references/video-recipes.md` — scene patterns, product promo, social clip templates
- `references/section-refinement.md` — building from screenshot + tokens (UPDATED this session)
- `references/tts-integration.md` — adding narration and captions

**Question: are these helpful or do they confuse the AI?** Need to:
- Read each one critically
- Check if they contradict the SKILL.md
- Check if they reference old files (capture-brief.md, visual-style.md)
- Decide: keep, update, or remove each

### 3. HyperFrames best practices

This session focused on CAPTURE but didn't deeply study how HyperFrames creates the best videos. Before testing the full workflow, read:
- Test prompts PDF (what good prompts look like)
- Evaluation guide (what good output looks like)
- Showcase HTML (real examples)
- Templates in `templates/` directory
- Git history for successful HyperFrames projects

### 4. SVG usage in replicas

Inline SVGs are extracted and saved to `assets/svgs/` but the AI replica generator can't use them (local paths, not URLs). The local AI agent (Claude Code) CAN read them. This needs testing with the actual workflow.

## Environment

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini 3.1 Pro (optional) |
| `ANTHROPIC_API_KEY` | Claude Sonnet (optional fallback) |

Model IDs: `gemini-3.1-pro-preview`, `claude-sonnet-4-20250514`

## User Preferences

- DESIGN.md must be AI-generated prose, not template filling
- Always verify by actually reading outputs
- Research thoroughly before implementing
- Match Aura.build quality as benchmark
- AI API calls should be optional — the user's AI agent is enough
- Don't add unnecessary complexity
- Test everything end-to-end before declaring it done
