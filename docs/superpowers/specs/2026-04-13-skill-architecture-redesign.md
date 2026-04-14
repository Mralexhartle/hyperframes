# Skill Architecture Redesign — Website-to-HyperFrames + Compose

**Date:** 2026-04-13
**Status:** Approved
**Goal:** A fresh Claude Code session, given a one-line prompt, produces professional-quality video with shader transitions, real assets, synced narration, and purposeful motion — whether starting from a URL or from scratch.

---

## Problem Statement

The current system produces mediocre output. Root causes identified through comprehensive code review:

1. **Split-brain DESIGN.md schema.** The auto-generator (`designMdGenerator.ts`) produces DESIGN.md missing 3 critical sections (Style Prompt, Motion, What NOT to Do) that the skill depends on. Two different systems disagree on what DESIGN.md contains.

2. **Instruction decay.** The 450-line monolithic SKILL.md causes Lost-in-the-Middle attention collapse. Shader instructions (the biggest visual differentiator) sit in the middle of a long document and are ignored in 100% of existing compositions.

3. **Context overflow.** "Read ALL files, do not skip any" triggers 100+ tool calls. By the time the agent finishes viewing 42 images, the first 10 are compressed out of context.

4. **RGB/HEX mismatch.** Token extractor outputs `rgb()` format but every downstream consumer expects `#HEX`.

5. **Shader transitions require building from scratch.** The agent must read 900+ lines of reference material across 3 files to wire a shader. 0% compliance rate.

6. **No path for "from scratch" videos.** The hyperframes compose skill's Visual Identity Gate handles URL-based captures well but produces a minimal 4-field DESIGN.md for non-URL prompts.

---

## Design

### Part 1: Remove AI Auto-Generation from Capture Pipeline

The capture pipeline becomes a pure data extractor. All intelligence lives in the agent session.

#### Files to delete
- `packages/cli/src/capture/designMdGenerator.ts`

#### Dependencies to remove from `packages/cli/package.json`
- `@anthropic-ai/sdk`
- `@google/genai`

#### Changes to `packages/cli/src/capture/index.ts`
- Remove the AI key check block (lines 822-853). Replace with:
  ```typescript
  progress("design", "DESIGN.md will be created by your AI agent");
  ```
- Remove `hasDesignMd` variable and its usage in `generateAgentPrompt()` call
- Remove the font paths collection block (lines 787-797) — only needed for the AI generator

#### Changes to `packages/cli/src/capture/agentPromptGenerator.ts`
- Remove `hasDesignMd` parameter from `generateAgentPrompt()` and `buildPrompt()`
- Remove the conditional DESIGN.md row from the table
- Convert colors to HEX in the Brand Summary section (use a simple rgb-to-hex converter)
- The CLAUDE.md it generates should always say "DESIGN.md will be created when you run the workflow"

#### Changes to `packages/cli/src/capture/tokenExtractor.ts`
- Convert all extracted colors from `rgb()`/`rgba()` to `#HEX` format at extraction time
- Add a `rgbToHex()` utility function

#### New: Generate `extracted/asset-descriptions.md` during capture
- After asset download completes in `index.ts`, generate a one-line-per-file summary
- Source data: filename, file size, image dimensions (from buffer), HTML context from `assets-catalog.json`
- Format: `image-0.png — 1920x600, hero section, found in <section> "Financial Infrastructure"`
- For SVGs: `svgs/logo.svg — brand wordmark, 400x100 viewBox, found in <nav>`
- No AI needed — derive from metadata already available
- Add this file to the CLAUDE.md table so agents know to read it

#### New: Improve `index.html` scaffold with shader boilerplate
- The scaffold generated at end of `index.ts` (lines 908-932) currently creates an empty shell
- Replace with a scaffold that includes:
  - `<canvas id="gl-canvas">` positioned above scene slots
  - Pre-wired WebGL init (getContext, compileShader utility functions)
  - The Cross-Warp Morph fragment shader as default (most versatile)
  - Scene slot divs with `data-composition-src` pointing to `compositions/scene-N.html`
  - `beginTrans()` / `endTrans()` functions wired to GSAP timeline
  - Comment markers: `/* AGENT: Replace this shader with your choice from shader-transitions.md */`
  - CSS fallback for when WebGL is unavailable
- The scaffold should be a complete, working composition that the agent modifies, not builds from scratch
- Number of scene slots: 4 (the agent adds/removes as needed)
- Include `<audio>` element for narration on its own track
- Include a caption composition slot on a parallel track

---

### Part 2: Restructure website-to-hyperframes Skill

Replace the monolithic SKILL.md with a slim orchestrator + phase-specific references.

#### New file structure
```
skills/website-to-hyperframes/
├── SKILL.md                          ← ~120 lines, orchestrator only
├── references/
│   ├── phase-1-understand.md         ← Read data, write working summary
│   ├── phase-2-design.md             ← Write DESIGN.md (full 10-section schema)
│   ├── phase-3-direct.md             ← Creative direction + narration + TTS
│   ├── phase-4-build.md              ← Build compositions + inline shader example
│   ├── asset-sourcing.md             ← Keep as-is
│   ├── video-recipes.md              ← Keep, minor trim
│   ├── tts-integration.md            ← Keep as-is
│   └── animation-recreation.md       ← Keep as-is
```

#### Delete
- `skills/website-to-hyperframes/references/visual-styles.md` (duplicate of canonical `skills/hyperframes/visual-styles.md`)

#### SKILL.md — The Orchestrator (~120 lines)

Structure:
```
# Website to HyperFrames

Quick Start section (what users say, what happens)

## Phase 1: Capture & Understand
- Run capture command
- Read: references/phase-1-understand.md
- GATE: Print site summary (name, colors, fonts, asset count, vibe)

## Phase 2: Write DESIGN.md
- Read: references/phase-2-design.md
- GATE: DESIGN.md exists with all 10 sections

## Phase 3: Creative Direction
- Read: references/phase-3-direct.md
- GATE: narration-script.txt exists, scene plan printed

## Phase 4: Build & Deliver
- Read: /hyperframes-compose skill
- Read: references/phase-4-build.md
- GATE: npx hyperframes lint && npx hyperframes validate pass

## Quick Reference
- Video Types table (filled in with durations, scene counts, narration guidance)
- Format reference (landscape/portrait/square)
- Reference files table
```

Key principles:
- Each phase is ~3-5 lines in the orchestrator, linking to a focused reference
- Gates produce artifacts (files, printed output), not "confirm" instructions
- No "Red Flags" tables — positive directives only
- No `!!!!` or `!!!!!!` — professional tone
- Critical rules stated at top AND bottom (repetition per research)

#### phase-1-understand.md (~80 lines)

The write-down-and-forget pattern:
- For each extracted file, read it and write a 1-2 sentence summary
- The summary is the agent's working memory
- For captures with 30+ images: launch a sub-agent to view all assets and return a compact catalog
- Tiered reading: MUST read (screenshot, tokens, visible-text, asset-descriptions.md), SKIM (assets-catalog), ON-DEMAND (individual images)
- End state: a ~500-word printed summary that persists in context

#### phase-2-design.md (~150 lines)

Full DESIGN.md schema with all 10 sections:
1. Overview (3-4 sentences)
2. Style Prompt (single self-contained paragraph — most important section, emphasized)
3. Colors (HEX values, semantic roles)
4. Typography (families, weights, sizing hierarchy)
5. Elevation (depth strategy)
6. Components (named by what you see)
7. Motion (easing, speed, animation style, signature patterns)
8. Do's and Don'ts
9. What NOT to Do (explicit anti-patterns)
10. Assets (map every file to what it shows and where it appears)

Includes the Notion example from the current SKILL.md (it's excellent — keep it).
Word guidance: aim for thorough coverage, approximately 2000-3000 words.
Rules: use exact HEX values from tokens.json, be factual not poetic, name components specifically.

#### phase-3-direct.md (~120 lines)

Creative direction workflow:
1. Read visual-styles.md (from hyperframes/ skill) — pick a style anchor
2. Choose shader transition FIRST (energy → shader mapping table, inline)
3. Write narration script FIRST (2.5 words/sec pacing, opening line is everything)
4. Generate TTS (HeyGen preferred → ElevenLabs → Kokoro fallback)
5. Transcribe for word-level timestamps
6. Map timestamps to scene plan (narration IS the timeline)
7. Print scene plan table (Scene | Duration | What viewer sees | What viewer feels | Assets | Transition | Narration)

Motion vocabulary table (SLAMS, CASCADE, FLOATS, etc.) — inline, not referenced.
Opening 2 seconds guidance — inline.

#### phase-4-build.md (~150 lines)

Composition building:
1. The index.html scaffold already has shader transitions wired — modify, don't build
2. One complete inline example: Cross-Warp Morph between two scenes with GSAP driving `u_progress`
3. "For other shaders, see `hyperframes/references/transitions/shader-transitions.md`" (link, not inline)
4. Asset plan per scene (list every file/URL you'll embed)
5. Scene composition rules: use real assets, EXACT colors from DESIGN.md, @font-face with captured fonts
6. Wire audio: narration.wav on root track, captions.html on parallel track
7. Scene durations from narration timestamps, not guessing

Key rules repeated at bottom:
- Every element must DO something (mid-scene activity)
- No `repeat: -1`
- Deterministic (no Math.random)
- Timeline registered to `window.__timelines`

---

### Part 3: Update Hyperframes Compose Skill's Visual Identity Gate

#### Current behavior (hyperframes/SKILL.md lines 24-38):
```
Check in this order:
1. DESIGN.md exists? → Read it
2. visual-style.md exists? → Read it
3. User named a style? → Generate MINIMAL DESIGN.md (4 fields)
4. None of the above? → Ask 3 questions, generate MINIMAL DESIGN.md
```

#### New behavior:
Options 1 and 2 stay the same. Options 3 and 4 change:

**Option 3 (user named a style or gave a topic):**
- Read visual-styles.md for the 8 named presets
- If a preset matches, use it as the foundation
- Generate a **full** DESIGN.md with all 10 sections, not 4
- The Style Prompt, Colors, Typography, and Motion come from the preset
- Components, Do's/Don'ts, What NOT to Do are derived from the style's principles
- Save as DESIGN.md in the project directory

**Option 4 (no style, no URL, just a topic like "astronomical discoveries"):**
- Ask 3 questions (keep current: mood, light/dark, brand references)
- But then generate a **full** DESIGN.md with all 10 sections
- Pick the closest visual style preset as a starting point
- Adapt colors, typography, motion to the topic
- The agent should research the topic briefly (web search if available) to inform visual choices
- Save as DESIGN.md in the project directory

The key change: **every path through the gate produces a full DESIGN.md**, not a minimal one. This ensures Prompt B ("astronomical discoveries") gets the same quality foundation as Prompt A ("stripe.com").

Update the gate text to replace the minimal DESIGN.md instruction with a reference to the full schema. The full schema lives in `website-to-hyperframes/references/phase-2-design.md` — the compose skill can reference it: "Generate a full DESIGN.md following the schema in the `/website-to-hyperframes` skill's phase-2-design.md reference."

---

### Part 4: Root CLAUDE.md Updates

- Update the skills table if skill names or descriptions change
- Update the "Rules" section to reference the new phase structure
- Remove any references to the old monolithic SKILL.md workflow

---

## What Stays the Same

- **hyperframes SKILL.md** — structure stays, only Visual Identity Gate options 3-4 updated
- **All hyperframes references** — house-style.md, motion-principles.md, transitions/, fonts.md, captions.md, patterns.md, etc.
- **Capture pipeline logic** — Puppeteer two-pass, animation cataloger, asset downloader, token extractor, Lottie detection, shader extraction, video manifest, section splitter
- **28 existing captures** — keep their DESIGN.md files (agent-written, good quality)
- **Narration-first workflow** — elevated from buried instruction to hard gate

## Not In Scope

- Lint rule for shader presence (future PR)
- Rewriting video-recipes.md beyond minor trim
- Changes to rendering engine, producer, or studio packages
- Re-running captures to regenerate data
- Building sub-agent orchestration framework (document the pattern, agent follows naturally)
- Music/sound effects integration (the compose skill already supports `<audio>` elements — the agent can source royalty-free music and layer it)

---

## Success Criteria

A fresh Claude Code session handles both prompts and produces shocking quality:

**Prompt A (with URL):**
> "Create me a 24-28 second product launch video of my website https://stripe.com"

**Prompt B (from scratch):**
> "Create me a video about the most exciting astronomical discoveries for the past 20 years with visuals, voiceover, music and some sound effects"

**"Shocking good quality" means:**
- Shader transitions between scenes (not CSS fades, not fade-to-black)
- Real brand assets / sourced visuals (not colored rectangles or placeholder text)
- Narration that sounds human, timed to the millisecond
- Every element moves with purpose (5-layer system, mid-scene activity throughout)
- Opening 2 seconds that stop the scroll
- Typography and color that match the brand / topic precisely
- The "What NOT to Do" constraints from DESIGN.md are visibly respected
- A viewer cannot tell this was made from a URL + one sentence

---

## File Change Summary

| Action | File |
|--------|------|
| DELETE | `packages/cli/src/capture/designMdGenerator.ts` |
| EDIT | `packages/cli/src/capture/index.ts` (remove AI key block, add asset descriptions, improve scaffold) |
| EDIT | `packages/cli/src/capture/agentPromptGenerator.ts` (remove hasDesignMd, HEX colors) |
| EDIT | `packages/cli/src/capture/tokenExtractor.ts` (RGB→HEX conversion) |
| EDIT | `packages/cli/package.json` (remove @anthropic-ai/sdk, @google/genai) |
| REWRITE | `skills/website-to-hyperframes/SKILL.md` (slim orchestrator) |
| CREATE | `skills/website-to-hyperframes/references/phase-1-understand.md` |
| CREATE | `skills/website-to-hyperframes/references/phase-2-design.md` |
| CREATE | `skills/website-to-hyperframes/references/phase-3-direct.md` |
| CREATE | `skills/website-to-hyperframes/references/phase-4-build.md` |
| DELETE | `skills/website-to-hyperframes/references/visual-styles.md` (duplicate) |
| EDIT | `skills/hyperframes/SKILL.md` (Visual Identity Gate options 3-4) |
| EDIT | `CLAUDE.md` (update skill references) |
