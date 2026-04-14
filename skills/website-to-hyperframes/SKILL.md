---
name: website-to-hyperframes
description: |
  Capture a website and create a HyperFrames video from it. Use when: (1) a user provides a URL and wants a video, (2) someone says "capture this site", "turn this into a video", "make a promo from my site", (3) the user wants a social ad, product tour, or any video based on an existing website, (4) the user shares a link and asks for any kind of video content. Even if the user just pastes a URL — this is the skill to use.
---

# Website to HyperFrames

Capture a website's identity and design system (colors, fonts, components, assets, text, animations), then create on-brand HyperFrames video from it.

## Quick Start

Users can say things like:

- "Capture stripe.com and make me a 20-second product demo video"
- "Turn this website into a 15-second social ad for Instagram"
- "Create a 30-second product tour from linear.app"
- "Make a launch video from my site — portrait format for TikTok"

The workflow: **Capture → Understand!!!! → Create**. That's it.

## Execution

### Step 1: Capture the website

```bash
npx hyperframes capture <URL> -o captures/<project-name>
```

If the built CLI isn't available, fall back to:

```bash
npx tsx packages/cli/src/cli.ts capture <URL> -o captures/<project-name>
```

Optional flags:

- `--split` — also generate per-section compositions (for using real website HTML as video scenes)
- No API keys needed — all extraction is local

**Confirm:** Capture succeeded. Print how many screenshots, assets, sections, and fonts were extracted.

### Step 2: Read ALL (every single, no miss) captured data

You MUST read every single file before writing any code. Do not skip any.

1. **Read and VIEW (actually view and see what is this website's mood, vibe?)** `screenshots/full-page.png` — study every section, component, color, font, layout
2. **Read and ANALYZE** `extracted/tokens.json` — exact hex colors, font families, font weights, headings, CTAs, sections, CSS variables
3. **Read for CONTEXT** `extracted/visible-text.txt` — exact text from every section of the page
4. **Read and Understand (You need to know what's available)** `extracted/assets-catalog.json` — all images, videos, fonts, icon URLs with HTML context 
5. **Browse and VIEW (actually view and see how and what is it)** `assets/svgs/` — open and view every single thing, not 2-5, but EVERY SINGLE thing!!!!!!
6. **Browse and VIEW every image in `assets/`** — use Read on each .jpg, .png, .webp, .gif file to actually see what it shows. Do not skip any. You need to know what every downloaded asset actually looks like before you can use it creatively.
7. **Read and ANALYZE** `extracted/animations.json` — what animations the site uses (named animations, scroll triggers, canvas count and etc.)
8. **Check if exists, read** `extracted/lottie-manifest.json` — Lottie animations found on the site. **VIEW each preview image** at `assets/lottie/previews/` to actually SEE what the animation looks like (the names are often useless). Do NOT read the raw JSON files — they are machine data. Just reference them by path when embedding.
9. **Check if exists, read** `extracted/video-manifest.json` — every `<video>` on the site with its URL, section heading, caption text, and a preview screenshot. **VIEW each preview** at `assets/videos/previews/` to see what each video shows. Videos work as remote URLs in compositions — download with `curl -o assets/video-name.mp4 "<url>"` before rendering.
10. **Check if exists, read** `extracted/shaders.json` — WebGL shader source code captured from the site

**Confirm:** Print the site title, top colors, fonts, number of sections, number of assets.

### Step 3: Create DESIGN.md

Write a `DESIGN.md` file with these sections:

- **## Overview** — 3-4 sentences: visual identity of the website, design philosophy, vibe, overall feel
- **## Style Prompt** — A single self-contained paragraph (3-5 sentences) that fully captures the visual identity. An AI should be able to read ONLY this paragraph and generate consistent on-brand visuals. Include exact hex colors, font names, motion feel, and what to avoid. This is the most important section.
- **## Colors** — Brand & neutral colors with exact HEX values from tokens.json. Semantic palette.
- **## Typography** — Every font family with weights and design roles. Sizing hierarchy.
- **## Elevation** — Depth strategy (borders vs shadows vs glassmorphism).
- **## Components** — Name every UI component you see in the screenshot with styling details.
- **## Motion** — How the site moves: animation style (subtle/energetic/mechanical), typical easing, scroll behavior, any signature motion patterns.
- **## Do's and Don'ts** — Design rules from what the site does and doesn't do.
- **## What NOT to Do** — An explicit list of anti-patterns for this brand (e.g., "No gradients — this brand is flat", "Never use rounded corners", "No sans-serif for headings"). These are the `mood.avoid` constraints — what would look immediately off-brand.
- **## Assets** — Map every file in assets/ and URL in assets-catalog.json to WHERE it appears and WHAT it shows.

Rules (IMPORTANT):

- Use exact HEX values and font names from tokens.json
- Name components by what you see in the screenshot (Bento Grid, Logo Wall, Pricing Calculator) as much accurate as possible
- You are not REQUIRED to use exact strings from visible-text.txt, but you of course can.
- Be specific and factual

Example of DESIGN.md:

```
# Design System

## Overview
Notion's visual identity is characterized by a "Digital Paper" aesthetic—clean, predominantly monochrome with deliberate pops of functional color. The interface balances high information density with significant whitespace. The tone is sophisticated yet approachable, using hand-drawn style illustrations and "Nosey" character animations to add a human touch to a robust productivity tool. Layouts rely on a rigid bento-box grid system, providing a sense of modularity and organized structure.

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
- **Primary Sans**: `NotionInter` (Custom variant of Inter). Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold). Used for UI, buttons, and primary navigation.
- **Display Serif**: `LyonText`. Used for high-impact quotes and storytelling headers to evoke a traditional publishing feel.
- **Monospace**: `iAWriterMonoS`. Used for technical contexts, code-like accents, or specific metadata.
- **Handwritten**: `Permanent Marker`. Used for illustrative annotations and personality-driven callouts.

## Elevation
- **Border Reliance**: Notion avoids heavy shadows, instead using 1px borders in `var(--color-border-base)` to define surfaces.
- **Bento Elevation**: Cards use a background color shift or subtle border rather than lifting off the page with drop shadows.
- **Layering**: Sticky navigation bars and dropdown menus use high z-index with flat background fills or subtle glass effects in specific sub-themes.

## Components
- **Global Navigation**: A sophisticated sticky header with nested dropdown grids, logo stickerized paths, and clear CTA buttons.
- **Bento Cards**: Rounded-corner rectangles (`--border-radius-600`) containing an eyebrow title, heading, and a descriptive image or video. Variations include "Standard" and "Wide."
- **Interactive Calculator**: A form-based component with checkbox tool selection and numeric inputs for team size, featuring dynamic currency output fields.
- **Logo Marquee**: A continuous horizontal scroll of grayscale brand logos (OpenAI, Toyota, Figma) with specific speed-per-item settings.
- **Download Blocks**: Split-layout cards featuring high-fidelity app previews (Calendar, Mail) and tertiary download buttons.

## Do's and Don'ts
### Do's
- Use generous padding (spacing variables 32, 64, 80) between sections to maintain the "Digital Paper" feel.
- Align illustrations and media within bento cards to the right or center as defined by the grid.
- Use the monochromatic palette for the core interface and reserve colors for specific feature categorization.

### Don'ts
- Do not use heavy drop shadows; favor borders and background contrast for separation.
- Do not mix the serif (LyonText) and sans (Inter) fonts within the same functional button or input.
- Avoid overly saturated gradients; use flat fills or noise textures like `grain.svg` for depth.

## Assets
- **Image**: https://images.ctfassets.net/.../forbes.png — forbes logo in quote section
- **Video**: https://videos.ctfassets.net/.../Desktop_HomepageHero_compressed.mp4 — Homepage Hero Animation
- **Image**: https://www.notion.com/_next/image?url=...calendar...png — Notion calendar app preview
- **Font**: https://www.notion.com/front-static/fonts/NotionInter-Bold.woff2 — Notion Inter Bold
- **Font**: https://www.notion.com/_next/static/media/LyonText-Regular-Web.woff2 — Lyon Text Regular
- **Icon**: https://www.notion.com/front-static/favicon.ico — Notion favicon
- **Video**: https://www.notion.com/front-static/nosey/fall/clip_customAgents.mp4 — Custom Agents clip
- And etc...
```

**Confirm:** DESIGN.md written. Print the section headings and 2-3 key values from each.

### Step 4: Plan the video (think like a Creative Director)

You are now a creative director with 20 years of experience making content for YouTube, Instagram, and TikTok. You have unlimited creative freedom. Your job is to design a video that stops the scroll, holds attention, and drives action.

LOOK AND VIEW the screenshot, the text, the brand personality, every available assets and every URL from assets-catalog.json. Ask yourself:

- What's the ONE thing that makes this product interesting?
- What hook would make someone stop scrolling in the first 2 seconds?
- What visual sequence tells the story without needing explanation?
- What animations, trasitions, motions would be great to have given capabilities of HyperFrames?
- What assets/images/svgs/videos/URLs I want to use?
- What ending makes them want to click?

Don't think about code yet. Think about storytelling, pacing, and emotion.

**Before planning scenes, understand what's visually possible.** Read these now:

- Invoke `/hyperframes-compose` and read `references/transitions/catalog.md` — all available transitions with mood mapping
- Read `references/transitions/shader-transitions.md` — the 14 shader effects (domain warp, ridged burn, gravitational lens, etc.)
- Read `house-style.md` Anti-Defaults table — things the LLM defaults to that look generic. Do the OPPOSITE.
- Read [visual-styles.md](./references/visual-styles.md) — 8 named visual styles (Swiss Pulse, Velvet Standard, Deconstructed, Maximalist Type, Data Drift, Soft Signal, Folk Frequency, Shadow Cut) with designer references, palettes, and motion rules. Pick ONE as your style anchor.

#### Choose your transitions FIRST — before writing anything else

**Right now, before writing the narration or scene plan, state your transition choice:**

> "I will use **[shader name]** as the primary transition for this video because [reason]."

Shader transitions are HyperFrames' biggest visual differentiator — per-pixel compositing effects that CSS literally **cannot replicate**. The 14 available shaders (domain warp, ridged burn, gravitational lens, swirl vortex, glitch, cross-warp morph, etc.) are in `references/transitions/shader-transitions.md`.

Use this table to match the right shader to your video's energy:

| Energy | Primary shader | Why it works |
|--------|---------------|-------------|
| Calm / luxury / wellness | Cross-Warp Morph | Organic and flowing — scenes melt into each other |
| Corporate / SaaS / explainer | Cinematic Zoom or SDF Iris | Professional momentum without being boring |
| High energy / launch / promo | Ridged Burn or Glitch | Dramatic — stops the scroll, feels technically impossible |
| Cinematic / dramatic / story | Gravitational Lens or Domain Warp | Otherworldly — viewers rewatch to understand what happened |
| Playful / fun / social | Swirl Vortex or Ripple Waves | Hypnotic and delightful |

**Default: use a shader transition.** The only valid reasons to use CSS instead:
- The video is under 10 seconds total
- The creative brief explicitly requires "minimal" or "clean cuts"

If you default to fade-to-black, CSS wipe, or any non-shader transition without a stated reason from the above list, you have made the wrong choice. Hard cuts are also valid as an **accent** (1-2 scenes max), not as the primary.

#### Red Flags — STOP if you think any of these

| Thought | Reality |
|---------|---------|
| "CSS fades are simpler" | Shader transitions ARE the default. CSS is the fallback for <10s videos only. |
| "I'll add shader transitions later" | Later never comes. Wire them when you write the first scene. |
| "Separate composition files are cleaner than inline" | Shaders need the root `index.html` to have WebGL. Plan the architecture for this. |
| "The video is short, shaders are overkill" | Under 10 seconds is the ONLY valid exception. State the exact duration. |
| "I committed to a shader in Step 4 but now it seems complex" | The boilerplate is copy-paste from `shader-setup.md`. Read it — it's not complex. |
| "I'll use a simple fade and the video will still look good" | Fade-to-black between every scene = slideshow. Shaders = video. This is the difference. |
| "I'll put the shader transition in a sub-composition file" | Shaders composite between scene textures at the WebGL level. They MUST go in root `index.html`. |

#### Motion Vocabulary

Use specific action verbs when describing what you want to build. These are the words to think in — not "it animates in" but which specific motion:

| Energy | Verbs | Example |
|--------|-------|---------|
| **High impact** | SLAMS, CRASHES, PUNCHES, STAMPS, SHATTERS | `"$1.9T" SLAMS in from left at -5°` |
| **Medium energy** | CASCADE, SLIDES, DROPS, FILLS, DRAWS | `Three cards CASCADE in staggered 0.3s` |
| **Low energy** | types on, FLOATS, morphs, COUNTS UP, fades in | `Counter COUNTS UP from 0 to 135K` |

Every element MUST have at least one of these during its hold phase — not just entrance and exit.

#### Write the narration script FIRST

Every good video has a voice. Write the voiceover script BEFORE finalizing scene durations — the narration drives the pacing, not the other way around.

**Rules for the script:**

- 2.5 words per second is natural speaking pace (15s = ~37 words, 30s = ~75 words)
- Write like a real human being
- Use contractions (it's, you'll, that's) and try to write like a real human because robotic speech kills the vibe
- Numbers become words: "135+" → "more than a hundred thirty five", "$1.9T" → "nearly two trillion dollars" and etc.

**Your opening line is the most important sentence in the video.** It must create tension, curiosity, or surprise.

Save the script as `narration-script.txt`.

#### Then plan the scenes around it

Map each sentence or phrase of the narration to a scene. The narration IS the timeline.

**Confirm:** Print your scene plan:

| Scene | Duration | What viewer sees | What viewer feels | Assets to use | Transition OUT | Narration |
| ----- | -------- | ---------------- | ----------------- | ------------- | -------------- | --------- |
|       |          |                  |                   |               |                |           |

If the user explicitly says "no narration" or "no voiceover", skip the script and plan scenes with visual-only timing.

### Step 5: Build the video (think like a Senior HyperFrames Engineer)

Switch roles. You are now a senior engineer who specializes in video creation with HyperFrames. A client (the creative director from Step 4) just handed you a video plan with a narration script and you need to execute it at 200% quality.

**Your goal is not just "working video." Your goal is a video that makes viewers say "how the hell did they make this from just a URL?"** Use shader transitions between scenes. Use the website's real assets creatively — not just as static images, but as elements that move, transform, and surprise. The captured shaders, animations, and Lottie files are inspiration for what the original site's creators thought was visually impactful — channel that same energy.

#### First: generate the audio

Before writing a single line of HTML, produce the voiceover and get word-level timestamps. This gives you EXACT durations for every scene.

1. **Generate TTS** from `narration-script.txt`. Read [tts-integration.md](./references/tts-integration.md) for voice selection and options:
   - **HeyGen TTS** (preferred) — use `mcp__claude_ai_HeyGen__text_to_speech`, returns audio + word timestamps
   - **ElevenLabs** (if available) — use `mcp__elevenlabs__text_to_speech`, wider voice selection
   - **Kokoro** (offline fallback) — `npx hyperframes tts narration-script.txt --voice af_nova --output narration.wav`

2. **Audition 2-3 voices** with the first sentence before committing. Pick the most natural, conversational one — not the most "professional."

3. **Transcribe** for word-level timestamps:

   ```bash
   npx hyperframes transcribe narration.wav
   ```

   This produces `transcript.json` with `[{ text, start, end }]` for every word.

4. **Map timestamps to scenes** — each scene's `data-duration` now comes from the narration, not from guessing.

#### Then: build the compositions

<HARD-GATE>
Before writing `index.html`, verify ALL of these:
1. You stated a specific shader transition by name in Step 4 (e.g., "Cross-Warp Morph", "Gravitational Lens")
2. You read `references/transitions/shader-setup.md` — the complete WebGL boilerplate
3. You read the specific fragment shader code from `references/transitions/shader-transitions.md`

If your `index.html` does NOT contain `gl.createShader` and `beginTrans`, you have not wired shader transitions. Go back and read `shader-setup.md` — the boilerplate is copy-paste.

The ONLY exceptions: video is under 10 seconds, OR the user explicitly said "no shaders" or "simple cuts."
</HARD-GATE>

Now invoke `/hyperframes-compose`. Read the entire skill — every rule, every pattern, every anti-pattern, examples, guides - everything. This is your technical bible. Also read:

- [animation-recreation.md](./references/animation-recreation.md) — converting source animations to GSAP
- [video-recipes.md](./references/video-recipes.md) — scene patterns, mid-scene activity, how to keep things alive

**IMPORTANT. Before writing ANY HTML, create an asset plan for each scene.** List every file from assets/ and every URL from assets-catalog.json that you'll embed. If a scene uses zero captured assets, explain why.

**Remote URLs from assets-catalog.json work directly in compositions:**

```html
<img src="https://soulscapefilm.com/mentor/john_gaeta.png" crossorigin="anonymous" />
```

These load in preview and render. Don't limit yourself to local files — product screenshots, headshots, hero images from the catalog are all usable.

> **⚠ Always check `assets/` before using remote URLs.** Images downloaded during capture are already in `assets/` — prefer local files if possible

Build each scene as a separate sub-composition in `compositions/`. Follow these non-negotiable rules:

**Use real assets — never placeholders:**

- EXACT colors from DESIGN.md (hex values)
- EXACT fonts via @font-face with URLs from assets catalog
- Real product brand-kit, identity, style, fonts, SVG logos from assets/svgs/ (IDEALLY AS MANY AS APPROPRIATE)
- If the capture has an asset for something, USE IT!!!

**How to reference assets in compositions** (compositions live in `compositions/`, assets in `assets/`):

```html
<!-- Local image (use ../ because compositions/ is one level deep) -->
<img src="../assets/image-0.png" crossorigin="anonymous" />

<!-- Local SVG (inline for animation, or as img) -->
<img src="../assets/svgs/logo-0.svg" />

<!-- Local font -->
<style>
  @font-face {
    font-family: "BrandFont";
    src: url("../assets/fonts/FontName.woff2") format("woff2");
    font-weight: 400;
    font-display: block;
  }
</style>

<!-- Remote image from assets-catalog.json -->
<img src="https://example.com/product-screenshot.jpg" crossorigin="anonymous" />

<!-- Lottie animation (from lottie-manifest.json) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
<div id="anim" style="width:400px;height:400px;"></div>
<script>
  lottie.loadAnimation({
    container: document.getElementById("anim"),
    renderer: "svg",
    loop: false,
    autoplay: false,
    path: "../assets/lottie/animation-0.json",
  });
</script>
```

**Make it move:**

- Every element must DO something — not just appear and sit there
- Entrances, mid-scene activity, exits. Read the mid-scene activity table in video-recipes.md.
- Never use `repeat: -1` — calculate exact repeats from scene duration

**Beyond GSAP — HyperFrames also supports Lottie, Three.js, CSS animations, and Web Animations API.** Embedding patterns for all of these are shown in the "How to reference assets" block above. For canvas/WebGL backgrounds, use the `hf-seek` event:

```html
<canvas id="bg-canvas" width="1920" height="1080"></canvas>
<script>
  var ctx = document.getElementById("bg-canvas").getContext("2d");
  window.addEventListener("hf-seek", function (e) {
    var time = e.detail.time;
    // Draw frame at this time — must be deterministic
    drawBackground(ctx, time);
  });
</script>
```

Check if `extracted/shaders.json` exists, you can reference the captured GLSL source code to recreate similar WebGL visual effects.

**Wire up shader transitions (if your scene plan includes them):**

Read `references/transitions/shader-setup.md` for the complete WebGL boilerplate and `references/transitions/shader-transitions.md` for the fragment shaders. The shader system composites scenes as WebGL textures — each scene's DOM is captured to a texture, then the shader blends between them with GSAP driving `u_progress` from 0 to 1.

Key points:

- Shader transitions go in the **root `index.html`**, not in individual scene files
- Scenes with shader transitions do NOT need fade-in/fade-out — the shader handles the visual blend
- The root timeline orchestrates: show scene 1 via passthrough shader → `beginTrans(shaderProg, "scene1", "scene2")` → GSAP tweens progress 0→1 → `endTrans("scene2")`
- Pick transition duration from the catalog (0.3-0.8s depending on energy level)

**Wire up the audio:**

- Add `narration.wav` as an `<audio>` element in root `index.html` on its own track
- Add a captions sub-composition (`compositions/captions.html`) on a parallel track
- Scene durations MUST match the narration timestamps from Step 5.1

**Confirm:** Print what was built (Scene | File | Duration | Elements | Animations).

### Step 6 (IMPORTANT ALWAYS): Self-verify, lint, validate, preview

**Before running lint/validate, self-verify your shader implementation:**

If the video is over 10 seconds and you committed to a shader in Step 4:
- [ ] `index.html` contains `<canvas id="gl-canvas">`
- [ ] `index.html` contains `gl.createShader` or `compileShader`
- [ ] `index.html` contains `beginTrans` and `endTrans` function calls
- [ ] Scene compositions do NOT individually fade to/from black (shaders handle transitions)
- [ ] There is a CSS fallback `else` block in case WebGL is unavailable

If any checkbox fails, go back to Step 5 and wire the shader. Do NOT proceed with a video that uses CSS fades when shaders were planned.

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes preview
```

Fix ALL errors before previewing. Give specific feedback on what you see in the preview — "scene 3 is too slow", "make the logo bigger", "the transition is jarring" — and iterate.

**Confirm:** Preview URL, number of scenes, total duration, source URL, format.

## Quick Reference

### Video Types

| Type | Typical Duration | Best For |
| ---- | ---------------- | -------- |

Don't follow a fixed scene formula. Let the content, brand-identity dictate the structure.

### Energy & Visual Vocabulary

Don't just pick timing — pick a VISUAL IDENTITY for the video:

| Energy                                | Motion feel                              | Transitions                                   | Easing                         | What it looks like                      |
| ------------------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------ | --------------------------------------- |
| **Explosive** (launches, reveals)     | Elements slam in, shatter out            | Ridged Burn, Glitch (shader)                  | `expo.out`, `back.out(2.5)`    | Like a movie trailer — every cut hits   |
| **Cinematic** (stories, tours)        | Slow reveals, dramatic scale, long holds | Gravitational Lens, Domain Warp (shader)      | `power4.out`, `sine.inOut`     | Like a Netflix opening sequence         |
| **Fluid** (luxury, wellness, brand)   | Everything flows, nothing snaps          | Cross-Warp Morph, Thermal Distortion (shader) | `sine.inOut`, `power1`         | Like ink in water — smooth and organic  |
| **Technical** (dev tools, APIs, SaaS) | Precise, geometric, grid-aware           | Cinematic Zoom, SDF Iris (shader)             | `power3.out`, `circ.out`       | Like a HUD system booting up            |
| **Chaotic** (social, memes, viral)    | Unexpected motion, broken rules          | Glitch, Whip Pan (shader)                     | `elastic.out(1.5)`, `steps(4)` | Like TikTok creators with After Effects |

**The opening 2 seconds define everything.** If you start with a logo fading in on a solid background, you've already lost. Start with:

- A number that shocks ("$1.9 TRILLION in transactions")
- A visual that moves immediately (image zooming, particles, gradient shifting)
- A question that provokes ("What if your database could think?")
- An asset from the website doing something unexpected (logo exploding into pieces, hero image warping, headline text shattering)

### Format

- **Landscape**: 1920×1080 (default)
- **Portrait**: 1080×1920 (Instagram Stories, TikTok)
- **Square**: 1080×1080 (Instagram feed)

## Reference Files

| File                                                            | When to read                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| [visual-styles.md](./references/visual-styles.md)               | Step 4 — 8 named visual styles with palettes, motion rules, and shader pairings |
| [animation-recreation.md](./references/animation-recreation.md) | Step 5 — converting source animations to GSAP              |
| [video-recipes.md](./references/video-recipes.md)               | Step 5 — scene patterns, 5-layer system, mid-scene activity |
| [tts-integration.md](./references/tts-integration.md)           | Step 5 — voice selection, TTS generation, audition process |
| [asset-sourcing.md](./references/asset-sourcing.md)             | Step 5 — finding and downloading brand logos, icons, photos from free sources |
