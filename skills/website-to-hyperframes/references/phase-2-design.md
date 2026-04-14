# Phase 2 — Write the DESIGN.md

## Introduction

DESIGN.md is the brand identity document that every composition references. It encodes the complete visual design system so AI agents can generate on-brand output without guessing. Every section is derived from what the capture pipeline extracted: tokens.json, animations.json, screenshots, and the assets/ directory.

---

## The 10 Required Sections

### 1. `## Overview`

Write 3-4 factual sentences describing the visual identity. Cover:

- The overall aesthetic name or shorthand (e.g., "Digital Paper", "Glassmorphic Dark", "Warm Editorial")
- Layout patterns you see in the screenshot — use UI vocabulary: "Bento grid", "Logo Wall", "Pricing toggle", "Alternating feature rows", "Full-bleed hero"
- Color strategy: monochrome with accents? Dark-first? Pastel? Gradient-heavy?
- Typography tone: is it technical and neutral, editorial and expressive, playful, authoritative?

Do not editorialize or use brand marketing language. Describe what is visually present.

---

### 2. `## Style Prompt`

**This is the most important section.** It is a single self-contained paragraph of 3-5 sentences. An AI agent should be able to read ONLY this paragraph and generate visuals that are consistent with the brand.

Requirements:
- Include exact HEX values for 2-3 dominant colors
- Name the primary and display font families
- Describe the motion feel (e.g., "smooth ease-out transitions", "snappy spring physics", "slow parallax drift")
- Describe the surface treatment (flat, shadowed, glassmorphic, textured, noisy)
- End with what to avoid (e.g., "Avoid gradients, rounded corners above 8px, and any drop shadows")

The Style Prompt is the one section every downstream composition agent must read. Write it to stand alone — assume the reader will skip everything else.

---

### 3. `## Colors`

List every color token from tokens.json. Group into:

**Brand & Neutral** — background fills, text colors, borders, dividers. Sorted from lightest to darkest. For each:

```
- **[Token Name]**: `#XXXXXX` ([usage context])
```

**Semantic Palette** — colors that carry functional meaning: primary CTAs, error states, feature differentiation, category colors. Describe which product area or UI state each color maps to.

If the site uses a dark mode, list both light and dark surface values. If the site uses CSS custom properties, pull the resolved hex values from tokens.json rather than copying var() references.

---

### 4. `## Typography`

List every font family present in the capture. For each font:

```
- **[Role]**: `[Font Family Name]`. Weights: [list weights]. Used for [specific UI role].
```

Include:
- Primary sans-serif (UI, body, nav)
- Display or serif (hero headlines, pull quotes)
- Monospace (code, technical labels)
- Any custom or variable fonts

Follow with a sizing hierarchy table using actual pixel values from the captured CSS data. Example:

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Hero heading | 72px | 700 | 1.05 |
| Section heading | 48px | 600 | 1.1 |
| Body | 16px | 400 | 1.6 |
| Caption | 13px | 400 | 1.4 |

Use actual numbers, not token names.

---

### 5. `## Elevation`

Describe the site's depth strategy. Choose from and combine:

- **Border-based**: 1px borders define surfaces, no shadows
- **Shadow-based**: drop shadows with specific blur/spread values
- **Glassmorphism**: backdrop-filter blur, translucent fills
- **Flat color shifts**: surfaces distinguished only by background fill changes
- **Noise/texture**: grain overlays for depth

For each strategy present, give specific CSS values from the capture. Example:
- "Cards use `box-shadow: 0 2px 12px rgba(0,0,0,0.08)`, not borders."
- "Navigation uses `backdrop-filter: blur(12px)` with `background: rgba(255,255,255,0.8)`."

---

### 6. `## Components`

Name every distinct UI component visible in the screenshot. Be specific with naming — use what you see, not generic terms:

- "Bento Grid" not "Cards"
- "Pricing Calculator" not "Form"
- "Logo Wall" not "Images"
- "Floating CTA Bar" not "Button"
- "Feature Alternating Row" not "Section"

For each component describe:
- Structure (how many columns, rows, nested elements)
- Border-radius (exact px value or token)
- Internal spacing (padding values)
- Any distinctive visual treatment (gradient border, animated badge, hover state)

The more specific the component names and measurements, the more accurately the AI can recreate them in a composition.

---

### 7. `## Motion`

Describe how the site moves. Pull values directly from animations.json.

Cover:
- **Animation style**: subtle and functional vs. expressive and theatrical
- **Typical easing**: include actual cubic-bezier values from animations.json (e.g., `cubic-bezier(0.16, 1, 0.3, 1)`)
- **Duration range**: fast (150-250ms) vs. slow (600-1200ms)
- **Scroll behavior**: parallax, scroll-triggered fade-ins, sticky sections, scrubbed animations
- **Signature patterns**: any unique motion the brand is known for (e.g., "morphing blobs on hover", "card tilt on mouse move", "text character stagger")

This section directly informs the GSAP choreography in video compositions. Agents use these values to pick easing curves and animation durations that feel native to the brand.

---

### 8. `## Do's and Don'ts`

**Do's** — 3-5 rules describing what the site does and should always do:

```
### Do's
- [Specific visual behavior the brand does]
- ...
```

**Don'ts** — 3-5 rules describing what the site avoids:

```
### Don'ts
- [Specific visual behavior the brand avoids]
- ...
```

Be specific and visual. "Use 64px vertical padding between sections" beats "Use generous spacing." "Never use drop shadows" beats "Keep it clean."

---

### 9. `## What NOT to Do`

This section is distinct from Don'ts. It captures explicit anti-patterns — things that would immediately read as off-brand. These come from the mood.avoid constraints and your visual analysis.

Write 4-6 statements in this form:

- "No gradients — this brand is entirely flat color."
- "Never use rounded corners above 4px — sharp corners are the brand."
- "No sans-serif for display headings — all headlines use the serif."
- "No drop shadows — surfaces are separated by background contrast only."
- "No animation easing above 500ms — motion should feel snappy, not cinematic."

These are the guard-rails. They prevent the most common off-brand mistakes when composing video scenes.

---

### 10. `## Assets`

Map every file in assets/ and URL in assets-catalog.json to a specific location and role. Use this format:

```
- **[Type]**: [filename or URL] — [where it appears] / [what it shows]
```

Types: Image, Video, SVG, Font, Lottie, Shader, Audio

Include:
- Hero images and videos (above the fold)
- Logo files (SVG preferred over PNG)
- Icon sets
- Background textures or patterns
- Font files (list each weight separately if captured)
- Any Lottie JSON animations
- WebGL shader source files (if extracted)

If assets-catalog.json groups assets by section, mirror that grouping. If an asset's role is ambiguous from the filename, describe what the screenshot shows.

---

## Rules

- Use exact HEX values from tokens.json — never approximate colors by eye
- Use exact font family names as they appear in CSS — not marketing names
- Name components by what you see in the screenshot, not generic labels
- Pull cubic-bezier values and durations from animations.json — do not invent them
- Be specific and factual, not creative or poetic
- Aim for 2000-3000 words of thorough coverage across all 10 sections
- Every section must be present — leave none out, even if data is sparse

---

## Complete Example

The following is a real DESIGN.md for Notion. It is a reference for tone, depth, and specificity. Note that it predates the Style Prompt, Motion, and What NOT to Do sections — a complete DESIGN.md must include all 10 sections.

```markdown
# Design System

## Overview
Notion's visual identity is characterized by a "Digital Paper" aesthetic—clean, predominantly
monochrome with deliberate pops of functional color. The interface balances high information
density with significant whitespace. The tone is sophisticated yet approachable, using
hand-drawn style illustrations and "Nosey" character animations to add a human touch to a
robust productivity tool. Layouts rely on a rigid bento-box grid system, providing a sense
of modularity and organized structure.

## Colors
### Brand & Neutral
- **Base White**: `#FFFFFF` (Surface background, card fills)
- **Text Normal**: `#000000` (Primary headings and body text)
- **Gray 900**: `#1A1A1A` (Dark mode backgrounds and hero contrast)
- **Gray 600**: `#666666` (Subtle captions and secondary text)
- **Gray 200**: `#E9E9E9` (Section backgrounds and dividers)

### Semantic Palette
- **Blue 500**: `#006ADC` (Primary buttons and AI accents)
- **Red Palette**: Used for Enterprise Search and specific use-case icons.
- **Yellow Palette**: Used for Flexible Workflow bento backgrounds.
- **Teal/Green Palette**: Used for Custom Agents and automation features.
- **Purple Palette**: Used for Meeting Notes and specific product UI links.

## Typography
- **Primary Sans**: `NotionInter` (Custom variant of Inter). Weights: 400 (Regular),
  500 (Medium), 600 (SemiBold), 700 (Bold). Used for UI, buttons, and primary navigation.
- **Display Serif**: `LyonText`. Used for high-impact quotes and storytelling headers
  to evoke a traditional publishing feel.
- **Monospace**: `iAWriterMonoS`. Used for technical contexts, code-like accents,
  or specific metadata.
- **Handwritten**: `Permanent Marker`. Used for illustrative annotations and
  personality-driven callouts.

## Elevation
- **Border Reliance**: Notion avoids heavy shadows, instead using 1px borders in
  `var(--color-border-base)` to define surfaces.
- **Bento Elevation**: Cards use a background color shift or subtle border rather than
  lifting off the page with drop shadows.
- **Layering**: Sticky navigation bars and dropdown menus use high z-index with flat
  background fills or subtle glass effects in specific sub-themes.

## Components
- **Global Navigation**: A sophisticated sticky header with nested dropdown grids,
  logo stickerized paths, and clear CTA buttons.
- **Bento Cards**: Rounded-corner rectangles (`--border-radius-600`) containing an
  eyebrow title, heading, and a descriptive image or video. Variations include
  "Standard" and "Wide."
- **Interactive Calculator**: A form-based component with checkbox tool selection and
  numeric inputs for team size, featuring dynamic currency output fields.
- **Logo Marquee**: A continuous horizontal scroll of grayscale brand logos (OpenAI,
  Toyota, Figma) with specific speed-per-item settings.
- **Download Blocks**: Split-layout cards featuring high-fidelity app previews
  (Calendar, Mail) and tertiary download buttons.

## Do's and Don'ts
### Do's
- Use generous padding (spacing variables 32, 64, 80) between sections to maintain
  the "Digital Paper" feel.
- Align illustrations and media within bento cards to the right or center as defined
  by the grid.
- Use the monochromatic palette for the core interface and reserve colors for specific
  feature categorization.

### Don'ts
- Do not use heavy drop shadows; favor borders and background contrast for separation.
- Do not mix the serif (LyonText) and sans (Inter) fonts within the same functional
  button or input.
- Avoid overly saturated gradients; use flat fills or noise textures like `grain.svg`
  for depth.

## Assets
- **Image**: https://images.ctfassets.net/.../forbes.png — forbes logo in quote section
- **Video**: https://videos.ctfassets.net/.../Desktop_HomepageHero_compressed.mp4
  — Homepage Hero Animation
- **Font**: https://www.notion.com/front-static/fonts/NotionInter-Bold.woff2
  — Notion Inter Bold
```

**Note:** This example is missing Style Prompt, Motion, and What NOT to Do sections — those were added to the schema after this example was written. A complete DESIGN.md must include all 10 sections.
