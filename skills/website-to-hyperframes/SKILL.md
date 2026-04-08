---
name: website-to-hyperframes
description: |
  Capture a website and create a HyperFrames video from it. Use when: (1) a user provides a URL and wants a video, (2) someone says "capture this site", "turn this into a video", "make a promo from my site", (3) the user wants a social ad, product tour, or any video based on an existing website, (4) the user shares a link and asks for any kind of video content. Even if the user just pastes a URL — this is the skill to use.
---

# Website to HyperFrames

Capture a website's design system (colors, fonts, components, assets, text, animations), then create on-brand HyperFrames video compositions from it.

## How It Works

**Phase 1: Capture** — CLI extracts everything from the website into a project folder
**Phase 2: Understand** — Read all captured data to understand the brand
**Phase 3: Create** — Build video compositions using the brand identity

## Execution

Every step has an **OUTPUT GATE**. Print the required output before proceeding.

### Step 1: Capture the website

```bash
npx hyperframes capture <URL> -o <project-name>
```

If the built CLI isn't available, fall back to:

```bash
npx tsx packages/cli/src/cli.ts capture <URL> -o <project-name>
```

Optional flags:

- `--split` — also generate per-section compositions (for using real website HTML as video scenes)
- No API keys needed — all extraction is local

**OUTPUT GATE**: Print the capture summary (screenshots, assets, sections, fonts).

✅ Step 1 complete

### Step 2: Read ALL captured data

You MUST read every single file before writing any code. Do not skip any.

1. **Read** `screenshots/full-page.png` — study every section, component, color, font, layout
2. **Read** `extracted/tokens.json` — exact hex colors, font families, font weights, headings, CTAs, sections, CSS variables
3. **Read** `extracted/visible-text.txt` — exact text content from every section of the page
4. **Read** `extracted/assets-catalog.json` — every image, video, font, icon URL with HTML context
5. **Browse** `assets/svgs/` — open each SVG to identify what it is (company logos, icons, illustrations)
6. **Browse** `assets/` — check downloaded images and font files
7. **Read** `extracted/animations.json` — what animations the site uses (for recreation guidance)

**OUTPUT GATE**: Print a summary table:

```
| Data | Key Values |
|------|-----------|
| Title | [page title] |
| Colors | [top 5 hex colors and where they're used] |
| Fonts | [font families + weights] |
| Sections | [N sections: list headings] |
| Assets | [N images, N SVGs, N fonts, N videos] |
| Animations | [N scroll triggers, N web animations] |
```

✅ Step 2 complete

### Step 3: Create DESIGN.md

Write a `DESIGN.md` file with these sections:

- **## Overview** — 3-4 sentences: visual identity, design philosophy, overall feel
- **## Colors** — Brand & neutral colors with exact hex values from tokens.json. Semantic palette.
- **## Typography** — Every font family with weights and design roles. Sizing hierarchy.
- **## Elevation** — Depth strategy (borders vs shadows vs glassmorphism).
- **## Components** — Name every UI component you see in the screenshot with styling details.
- **## Do's and Don'ts** — Design rules from what the site does and doesn't do.
- **## Assets** — Map every file in assets/ and URL in assets-catalog.json to WHERE it appears and WHAT it shows.

Rules:

- Use exact hex values and font names from tokens.json
- Name components by what you see in the screenshot (Bento Grid, Logo Wall, Pricing Calculator)
- Use exact strings from visible-text.txt — do NOT fabricate or paraphrase
- Be specific and factual, not poetic

**OUTPUT GATE**: Print the DESIGN.md section headings and key values from each.

✅ Step 3 complete

### Step 4: Plan the video

Before writing any composition code, plan the video structure:

1. What type of video? (social ad, product tour, feature announcement, testimonial, launch video)
2. What duration? (15s, 30s, 60s)
3. What format? (landscape 1920×1080, portrait 1080×1920, square 1080×1080)
4. What scenes? List each scene with: duration, content, background color, key elements, animations

**OUTPUT GATE**: Print the scene plan:

```
| Scene | Duration | Content | Background | Key Elements |
|-------|----------|---------|-----------|-------------|
| Hook | 0-4s | Hero heading | #02093a (navy) | h1, 2 CTAs, floating icons |
| Features | 4-12s | 3 feature cards | #f6f5f4 (light) | Screenshots, stagger entrance |
| Proof | 12-18s | Testimonial + logos | #ffffff | Quote, company logos, stat |
| CTA | 18-22s | Brand CTA | #02093a (navy) | Logo, button, URL |
```

✅ Step 4 complete

### Step 5: Build the video

**Invoke `/hyperframes-compose` BEFORE writing any composition code.**

Create HyperFrames compositions following these rules:

**Brand fidelity:**

- Use EXACT colors from DESIGN.md (hex values, not generic names)
- Use EXACT fonts via @font-face with URLs from the assets catalog
- Use EXACT text from visible-text.txt — do NOT paraphrase or invent
- Use real asset URLs for images, logos, product screenshots
- Use SVGs from assets/svgs/ for company logos and icons
- Follow the do's and don'ts from DESIGN.md

**Animation guidance:**

- Read [animation-recreation.md](./references/animation-recreation.md) for converting source animations to GSAP
- Read [video-recipes.md](./references/video-recipes.md) for scene patterns and mid-scene activity
- Every element must DO something — not just appear and sit there

**Scene structure:**

- Each scene = a separate sub-composition in `compositions/`
- Root `index.html` loads scenes sequentially on the same track
- Every scene fades in (first 0.3s) and fades out (last 0.3s)
- Bottom 120px reserved for captions

**OUTPUT GATE**: Print what was built:

```
| Scene | File | Duration | Elements | Animations |
|-------|------|----------|----------|-----------|
| Hook | compositions/scene-hook.html | 4s | h1, CTAs, icons | heading slide-up, CTAs stagger |
| Features | compositions/scene-features.html | 8s | 3 cards, screenshots | cards stagger, images scale |
```

✅ Step 5 complete

### Step 6: Lint, validate, preview

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes preview
```

Fix ALL errors before previewing.

**OUTPUT GATE**: Print final summary:

```
## Ready
- Preview: http://localhost:XXXX
- Scenes: N
- Duration: Ns
- Source: <URL>
- Format: 1920×1080
```

✅ Step 6 complete

## Adding Narration (Optional)

Read [tts-integration.md](./references/tts-integration.md) for the full narration workflow:

1. Write a conversational narration script (2.5 words/second)
2. Generate TTS audio via HeyGen, ElevenLabs, or local Kokoro
3. Transcribe back for word-level timestamps
4. Sync scene durations to narration segments
5. Add captions overlay

## Quick Reference

### Video Types

| Type                  | Duration | Scenes                                           | Best For                    |
| --------------------- | -------- | ------------------------------------------------ | --------------------------- |
| Social Ad             | 15s      | 4 (hook, feature, proof, CTA)                    | Instagram, TikTok, LinkedIn |
| Product Tour          | 30s      | 5-6 (hero, features, proof, stats, pricing, CTA) | Website, YouTube            |
| Feature Announcement  | 15s      | 3 (feature name, demo, CTA)                      | Product Hunt, Twitter       |
| Testimonial Spotlight | 15s      | 3 (logo, quote, attribution)                     | LinkedIn, case study        |
| Launch Video          | 60s      | 4 acts (hook, solution, proof, CTA)              | Product Hunt, landing page  |

### Energy Modifiers

- **Energetic**: fast cuts (2-3s), back.out easing, 0.08s stagger
- **Corporate**: smooth 0.6s transitions, gentle fades, generous holds
- **Cinematic**: slow power4.out reveals, dramatic scale, long holds
- **Playful**: bounce easing, colorful accents, rotation pops

### Format

- **Landscape**: 1920×1080 (default)
- **Portrait**: 1080×1920 (Instagram Stories, TikTok)
- **Square**: 1080×1080 (Instagram feed)

## Reference Files

| File                                                            | When to read                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [animation-recreation.md](./references/animation-recreation.md) | Step 5 — converting source animations to GSAP                                              |
| [video-recipes.md](./references/video-recipes.md)               | Step 5 — scene patterns, mid-scene activity, product promo/social clip/explainer templates |
| [section-refinement.md](./references/section-refinement.md)     | Step 5 — building from screenshot + tokens                                                 |
| [tts-integration.md](./references/tts-integration.md)           | After Step 6 — adding narration and captions                                               |
