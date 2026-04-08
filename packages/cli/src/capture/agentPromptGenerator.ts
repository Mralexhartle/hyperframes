/**
 * Generate CLAUDE.md (and .cursorrules) for captured website projects.
 *
 * This file is the playbook the AI agent follows automatically.
 * When a user says "make me a video", the agent reads this file and
 * knows the entire workflow: read data → create DESIGN.md → create video.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignTokens } from "./types.js";
import type { AnimationCatalog } from "./animationCataloger.js";

export function generateAgentPrompt(
  outputDir: string,
  url: string,
  tokens: DesignTokens,
  animations: AnimationCatalog | undefined,
  hasScreenshot: boolean,
  hasDesignMd: boolean,
): void {
  const prompt = buildPrompt(url, tokens, animations, hasScreenshot, hasDesignMd);
  writeFileSync(join(outputDir, "CLAUDE.md"), prompt, "utf-8");
  writeFileSync(join(outputDir, ".cursorrules"), prompt, "utf-8");
}

function buildPrompt(
  url: string,
  tokens: DesignTokens,
  animations: AnimationCatalog | undefined,
  hasScreenshot: boolean,
  hasDesignMd: boolean,
): string {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const cues = detectImplementationCues(tokens, animations);

  return `# ${tokens.title || hostname} — Website Capture

Source: ${url}

## Automatic Workflow

When the user asks you to create a video, make an ad, or do anything with this captured website, follow these steps IN ORDER. Do not skip any step.

### Phase 1: Read everything

Before writing ANY code, you MUST read ALL of these files:

1. ${hasScreenshot ? "**Read** `screenshots/full-page.png` — this is the website's visual design. Study every section." : "No screenshot available."}
2. **Read** \`extracted/tokens.json\` — colors, fonts, headings, CTAs, page sections, CSS variables.
3. **Read** \`extracted/visible-text.txt\` — the exact text content from every section of the page.
4. **Read** \`extracted/assets-catalog.json\` — every image, video, font, icon URL with the HTML context where it was found.
5. **Browse** \`assets/svgs/\` — open each SVG file to see what it is (company logos, brand icons, illustrations).
6. **Browse** \`assets/\` — check downloaded images and fonts.
${hasDesignMd ? "7. **Read** `DESIGN.md` — the pre-generated design system reference." : ""}

Do NOT start writing compositions until you have read ALL of the above.

### Phase 2: Create DESIGN.md${hasDesignMd ? " (already done)" : ""}

${
  hasDesignMd
    ? "A DESIGN.md already exists. Read it and use it as your brand reference."
    : `Write a \`DESIGN.md\` file with these sections:

**## Overview** — 3-4 sentences describing the visual identity, design philosophy, and overall feel.
**## Colors** — Brand & neutral colors with exact hex values from tokens.json. Semantic palette for feature-specific colors.
**## Typography** — Every font family with weights and design roles. Complete sizing hierarchy from tokens.json headings.
**## Elevation** — How the site creates depth (borders vs shadows vs glassmorphism vs flat color shifts).
**## Components** — Name every UI component you see in the screenshot (Bento Grid, Logo Wall, Pricing Calculator, etc.) with their styling approach.
**## Do's and Don'ts** — Design rules derived from what the site does and doesn't do.
**## Assets** — Map every file in assets/ and URL in assets-catalog.json to WHERE it appears on the page and WHAT it shows.

Be specific and factual. Use exact hex values and font names from tokens.json. Name components by what you see in the screenshot. Do NOT fabricate or paraphrase any text — use exact strings from visible-text.txt.`
}

### Phase 3: Create the video

Now use \`/hyperframes-compose\` skill and create HyperFrames compositions.

Rules for on-brand videos:
- Use EXACT colors from the DESIGN.md (hex values, not generic Tailwind colors)
- Use EXACT fonts via @font-face with URLs from the assets catalog
- Use EXACT text from the website (visible-text.txt) — do NOT paraphrase or invent content
- Use real asset URLs for images, logos, product screenshots
- Use the SVGs from assets/svgs/ for company logos and icons
- Follow the do's and don'ts from DESIGN.md

After creating compositions, run:
\`\`\`bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes preview
\`\`\`

${
  cues.length > 0
    ? `## Detected source patterns

${cues.map((c) => `- ${c}`).join("\n")}
`
    : ""
}
## Quick start prompts

If the user doesn't specify what they want, suggest these options:

**15-Second Social Ad:**
> Scene 1 (0-3s): Bold hook from the hero heading on brand dark background.
> Scene 2 (3-8s): 2-3 key features with product screenshots, staggered entrance.
> Scene 3 (8-12s): Social proof — testimonial quote, company logos, counter-animated stat.
> Scene 4 (12-15s): CTA with brand logo, accent color glow, fade to black.

**30-Second Product Tour:**
> Walk through the website top-to-bottom: Hero (5s) → Features (7s) → Social proof (6s) → Stats (5s) → Pricing (4s) → CTA (3s).

**Feature Announcement (15s):**
> Pick the newest feature. Name + icon (4s) → Product screenshot demo (6s) → Benefit + CTA (5s).

**Testimonial Spotlight (15s):**
> Company logo (3s) → Quote word-by-word in serif font (8s) → Attribution + brand logo (4s).

### Modifiers
- **Energetic**: fast cuts, back.out easing, 0.08s stagger
- **Corporate**: smooth 0.6s transitions, gentle fades
- **Cinematic**: slow power4.out reveals, dramatic scale
- **Portrait (9:16)**: 1080×1920 canvas for Instagram Stories/TikTok
- **Square (1:1)**: 1080×1080 canvas for Instagram feed
`;
}

function detectImplementationCues(
  tokens: DesignTokens,
  animations: AnimationCatalog | undefined,
): string[] {
  const cues: string[] = [];

  if (Object.keys(tokens.cssVariables).length > 10) {
    cues.push(
      "CSS custom properties used extensively — preserve design tokens for colors, spacing, and typography.",
    );
  }

  if (tokens.fonts.length > 0) {
    cues.push(
      `Typography: ${tokens.fonts.join(", ")}. Match these exact font families and weights.`,
    );
  }

  if (animations?.summary) {
    if (animations.summary.scrollTargets > 20) {
      cues.push(`${animations.summary.scrollTargets} scroll-triggered animations detected.`);
    }
    if (animations.summary.webAnimations > 5) {
      cues.push(`${animations.summary.webAnimations} active Web Animations detected.`);
    }
    if (animations.summary.canvases > 0) {
      cues.push(`${animations.summary.canvases} Canvas/WebGL elements detected.`);
    }
  }

  const hasMarquee = animations?.cssDeclarations?.some(
    (d) =>
      d.animation?.name?.toLowerCase().includes("marquee") ||
      d.animation?.name?.toLowerCase().includes("scroll"),
  );
  if (hasMarquee) {
    cues.push("Marquee/ticker animation present — preserve continuous scrolling behavior.");
  }

  return cues;
}
