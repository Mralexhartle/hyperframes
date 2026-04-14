# Phase 1: Pre-Production + Shader Enforcement

**Date:** 2026-04-13
**Status:** Approved
**Scope:** Skill/documentation changes only. Zero engine or CLI code.

## Problem

1. **2/3 test videos skipped shader transitions** despite SKILL.md instructions. The instruction was a suggestion, not an enforced gate. Claude verbally committed to a shader in Step 4 then wrote CSS fades in Step 5.

2. **Non-capture videos have no visual identity.** When there's no website capture, Claude picks generic defaults (blue, gray, Roboto). The compose skill acknowledges `visual-style.md` exists but has no mechanism to require one.

3. **Non-capture videos have no assets.** Without a capture, Claude can only generate CSS shapes and inline SVGs. No photos, no brand logos, no icons.

## Deliverables

### 1. Asset Sourcing Reference (`asset-sourcing.md`)

**File:** `skills/website-to-hyperframes/references/asset-sourcing.md`

Teaches Claude how to find and download free assets from known-good sources:

| Asset type | Source | URL pattern | License |
|-----------|--------|-------------|---------|
| Brand logos (SVG) | Simple Icons | `cdn.jsdelivr.net/npm/simple-icons@latest/icons/{name}.svg` | CC0 |
| Company logos (PNG) | Clearbit | `logo.clearbit.com/{domain}` | Free |
| Icons (SVG) | Lucide | `cdn.jsdelivr.net/npm/lucide-static@latest/icons/{name}.svg` | ISC |
| Photos | Unsplash | `api.unsplash.com/search/photos?query={q}` | Free (attribution) |

Includes: when to source vs skip, curl patterns, naming conventions, manifest format.

Also wired into SKILL.md Reference Files table.

### 2. Universal DESIGN.md Gate in Compose Skill

**File:** `skills/hyperframes-compose/SKILL.md` (the global compose skill)

Add a `<HARD-GATE>` before any HTML writing that enforces:

```
1. DESIGN.md exists? → Use it.
2. visual-style.md exists? → Use it.
3. User named a style? → Generate DESIGN.md from visual-styles.md.
4. None? → Ask 3 questions, generate minimal DESIGN.md.
```

Every composition must trace its palette back to a defined source. No generic defaults.

### 3. Shader Transition Enforcement

**File:** `skills/website-to-hyperframes/SKILL.md`

Three superpowers-inspired enforcement mechanisms:

**A. Red Flags table** (Step 4) — 5 common rationalizations with reality checks:
- "CSS fades are simpler" → Shaders are the default
- "I'll add shaders later" → Later never comes
- "Separate files are cleaner" → Shaders need root index.html
- "Video is short" → Under 10s is the ONLY exception
- "It's complex" → Boilerplate is copy-paste from shader-setup.md

**B. Hard gate** (Step 5) — Before writing index.html, verify:
- Shader named in Step 4
- shader-setup.md read
- Fragment shader code read

**C. Self-verification checklist** (Step 6) — Before claiming done:
- [ ] index.html contains `<canvas id="gl-canvas">`
- [ ] index.html contains `gl.createShader`
- [ ] index.html contains `beginTrans` and `endTrans`
- [ ] Scenes do NOT fade to/from black

## Files Changed

| File | Change type |
|------|------------|
| `skills/website-to-hyperframes/references/asset-sourcing.md` | NEW |
| `skills/website-to-hyperframes/SKILL.md` | EDIT (red flags + hard gate + verification) |
| `skills/hyperframes-compose/SKILL.md` | EDIT (DESIGN.md hard gate) |

## Success Criteria

Re-run 3 test captures. Expect:
- 3/3 use shader transitions (was 1/3)
- 3/3 have DESIGN.md with Style Prompt (was 3/3, maintain)
- Non-capture videos also get DESIGN.md before any HTML

## What This Does NOT Change

- Compose skill HTML rules (data attributes, templates, GSAP)
- Capture pipeline (no code changes)
- Engine or producer (no code changes)
- house-style.md (still the fallback for motion defaults)
