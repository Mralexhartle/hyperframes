---
name: claude-design-hyperframes
description: Claude Design entry point for HyperFrames. Use for renderable HyperFrames videos in Claude Design, and fetch the upstream skills tree plus player preview guidance from this repo.
---

# Claude Design + HyperFrames

Use this as the entry point when the user is working in Claude Design and wants a real HyperFrames deliverable instead of a generic web mockup.

## Fetch these first

Before writing any file, fetch and read each URL below in priority order.

1. https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/SKILL.md — core authoring contract. Visual identity gate, layout rules, data attributes, timeline contract, non-negotiable rules, scene transitions, animation guardrails.
2. https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/transitions.md — multi-scene transition patterns. Entrance-only rule, banned exit animations, energy → transition tables.
3. https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/typography.md — banned fonts list, weight contrast, video sizes, dark-background optical compensation, OpenType features.
4. https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/motion-principles.md — ease/speed/direction variety, scene build-breathe-resolve structure, choreography as hierarchy, visual composition.
5. https://github.com/heygen-com/hyperframes/blob/main/skills/gsap/SKILL.md — GSAP API: `immediateRender` default on `from()`/`fromTo()`, `autoAlpha` vs `opacity`, transform aliases, timeline position parameters.

Fetch these conditionally when the request calls for them:

- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/house-style.md — anti-slop palette and typography defaults when no visual direction is given.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/visual-styles.md — 8 named preset styles (Swiss Pulse, Warm Editorial, etc.).
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/patterns.md — PiP, title cards, slide-show patterns.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/data-in-motion.md — data, stats, infographic patterns.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/palettes/<name>.md — named palettes (`bold-energetic`, `clean-corporate`, `dark-premium`, `jewel-rich`, `monochrome`, `nature-earth`, `neon-electric`, `pastel-soft`, `warm-editorial`).
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/captions.md — captions, subtitles, karaoke synced to audio.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/tts.md — narration, voiceover.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/audio-reactive.md — music-driven animation.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/css-patterns.md — highlighting, sketchout, burst, scribble text effects.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/dynamic-techniques.md — karaoke, clip-path, slam, scatter, elastic, 3D caption animations.
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes-registry/SKILL.md — discover installable blocks (fetch the block HTML and paste manually; `hyperframes add` is CLI only).
- https://github.com/heygen-com/hyperframes/blob/main/packages/player/README.md — player API details for custom embeds.

If a URL 404s, start from https://github.com/heygen-com/hyperframes/tree/main/skills and navigate.

## Surface behavior

- Claude Design does not use slash commands.
- Default deliverables: `index.html`, `preview.html`, `README.md`. Add `DESIGN.md` when brand or visual identity is specified.
- Default to 1920x1080 at 30fps.

## Visual direction

If the user has not specified a style, brand, palette, or mood, do not default to warm editorial (cream paper + serif + terracotta). The Visual Identity Gate in `hyperframes/SKILL.md` is not optional. Either ask one clarifying question — _"What mood — clinical, raw, luxury, warm, dramatic, playful?"_ — or commit to a specific aesthetic from `visual-styles.md`'s 8 presets that matches the content type (SaaS/data → Swiss Pulse, launches → Maximalist Type, wellness → Soft Signal, luxury → Velvet Standard, etc.). Don't serve the same aesthetic for every brief.

## Composition contract

Apply these rules in `index.html`:

- Root element must include `data-composition-id`, `data-start="0"`, `data-duration`, `data-width`, `data-height`.
- Timed visual elements must include `class="clip"`, `data-start`, `data-duration`, `data-track-index`.
- Load GSAP at the top of `<body>`: `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>`.
- Immediately after GSAP, pre-load the HyperFrames runtime: `<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js"></script>`. Required for the player to drive playback inside Claude Design's sandbox.
- Create the GSAP timeline with `{ paused: true }` and register it on `window.__timelines[<composition-id>]`. The root's `data-composition-id` value and the `window.__timelines` key MUST be identical strings. Use `"main"` unless the brief specifies otherwise.
- Never call `.play()` on the timeline.
- Keep rendering deterministic. No `Date.now()`, no unseeded `Math.random()`, no `repeat: -1`, no async timeline construction.
- Video with sound: `muted playsinline` on `<video>`, put audio on separate `<audio>` clips.
- Multi-scene: use transitions and entrance animations. No jump cuts.

## Preview contract

Copy this `preview.html` verbatim:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HyperFrames Preview</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #111;
        height: 100%;
        overflow: hidden;
      }
    </style>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@hyperframes/player"></script>
  </head>
  <body>
    <hyperframes-player
      id="p"
      controls
      autoplay
      muted
      style="display:block;width:100vw;height:100vh"
    ></hyperframes-player>
    <script>
      document.getElementById("p").setAttribute("src", "./index.html" + location.search);
    </script>
  </body>
</html>
```

The `location.search` forward is required — Claude Design's sandbox needs the `?t=<token>` query on the iframe src, and `@hyperframes/player` does not forward it on its own.

If a classic script tag is needed instead of ESM, use the global build with the same token-forwarding script:

```html
<script src="https://cdn.jsdelivr.net/npm/@hyperframes/player/dist/hyperframes-player.global.js"></script>
<hyperframes-player
  id="p"
  controls
  autoplay
  muted
  style="display:block;width:100vw;height:100vh"
></hyperframes-player>
<script>
  document.getElementById("p").setAttribute("src", "./index.html" + location.search);
</script>
```

## Pre-delivery checklist

Before saying "done", verify each item against your generated files. Each has caused silent preview failures in past runs. If any fails, fix before delivering — do not ship with "I think it should work".

- [ ] `index.html` loads GSAP, then on the very next line loads `@hyperframes/core/dist/hyperframe.runtime.iife.js`. Without the runtime pre-load, the player reports ready but `currentTime` never advances and nothing moves.
- [ ] `preview.html` sets the player's src via the inline script `document.getElementById("p").setAttribute("src", "./index.html" + location.search)` — **not** via the `src=` attribute on the tag. Without the token forward, Claude Design's sandbox serves a placeholder and the in-pane preview renders black.
- [ ] `preview.html` is the template verbatim. No decorative chrome (no header, no wordmark, no aspect-ratio wrapper). `<hyperframes-player>` fills the viewport (`width:100vw;height:100vh`).
- [ ] The string in `data-composition-id` on the root element and the key in `window.__timelines["..."]` are identical. A mismatch silently prevents playback (the player can't find the timeline).
- [ ] The GSAP timeline is created with `{ paused: true }` and `.play()` is never called on it. The player and renderer drive playback.

## Output

- `index.html` renders via `npx hyperframes render index.html`.
- `preview.html` plays inside Claude Design's in-pane preview and locally after downloading the ZIP.
- `README.md` explains how to preview and render.

## Example prompts

- `Use https://github.com/heygen-com/hyperframes/blob/main/skills/claude-design-hyperframes/SKILL.md and make a 20-second product launch video about our new API. Deliver index.html, preview.html, and README.md.`
- `Use the HyperFrames Claude Design skill at https://github.com/heygen-com/hyperframes/blob/main/skills/claude-design-hyperframes/SKILL.md and turn https://www.anthropic.com/news/claude-design-anthropic-labs into a 45-second editorial launch video.`
- `Use the HyperFrames Claude Design skill entry point and build a 9:16 social teaser with captions, strong transitions, and a player-based preview.`
