---
name: claude-design-hyperframes
description: Claude Design entry point for HyperFrames. Use for renderable HyperFrames videos in Claude Design, and fetch the upstream skills tree plus player preview guidance from this repo.
---

# Claude Design + HyperFrames

Use this as the entry point when the user is working in Claude Design and wants a real HyperFrames deliverable instead of a generic web mockup.

## Fetch these upstream references first

Fetch the full HyperFrames skills tree from:

- https://github.com/heygen-com/hyperframes/tree/main/skills

Prioritize these files when you need focused context:

- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/SKILL.md
- https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes-cli/SKILL.md
- https://github.com/heygen-com/hyperframes/blob/main/skills/website-to-hyperframes/SKILL.md
- https://github.com/heygen-com/hyperframes/blob/main/skills/gsap/SKILL.md
- https://github.com/heygen-com/hyperframes/blob/main/packages/player/README.md

This file is intentionally thin. The repo-hosted `skills/` directory above is the source of truth.

## Surface-specific behavior

- Claude Design does not use slash commands like Claude Code.
- Treat this file as the GitHub-hosted entry point, then fetch the upstream HyperFrames skills listed above.
- Default deliverables are `index.html`, `preview.html`, and `README.md`. Add `timeline.js` when the animation logic is large enough that inline scripts become hard to review.
- Prefer 1920x1080 at 30fps unless the user asks for a different aspect ratio or pacing.

## HyperFrames composition contract

Always follow these rules:

- Root composition element must include `data-composition-id`, `data-start="0"`, `data-width`, and `data-height`.
- Timed visual elements must include `class="clip"`, `data-start`, `data-duration`, and `data-track-index`.
- GSAP timelines must be created with `{ paused: true }` and registered on `window.__timelines[compositionId]`.
- Keep rendering deterministic. Do not use `Date.now()`, unseeded `Math.random()`, async timeline construction, or `repeat: -1`.
- If the composition has video with sound, use `muted playsinline` on `<video>` and put audio on separate `<audio>` clips.
- For multi-scene videos, add scene transitions and entrance motion instead of hard jump cuts.

## Preview contract

When you generate a preview file, use `@hyperframes/player` instead of building a custom iframe shell.

Default to the ESM CDN entry in fresh HTML files:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@hyperframes/player"></script>
<hyperframes-player src="./index.html" controls autoplay muted></hyperframes-player>
```

If a plain classic script tag is required, use the explicit global build:

```html
<script src="https://cdn.jsdelivr.net/npm/@hyperframes/player/dist/hyperframes-player.global.js"></script>
<hyperframes-player src="./index.html" controls autoplay muted></hyperframes-player>
```

Add a custom transport HUD only when the user asks for it or the demo benefits from scene labels, scrubbing, or playback-rate controls.

## Output expectations

The output should feel like a HyperFrames handoff, not just a concept:

- `index.html` should be previewable in a browser and renderable by HyperFrames.
- `preview.html` should open cleanly and embed the composition with `<hyperframes-player>`.
- `README.md` should explain how to preview and render the result with `npx hyperframes preview` and `npx hyperframes render`.

## Example prompt shapes

- `Use https://github.com/heygen-com/hyperframes/blob/main/skills/claude-design-hyperframes/SKILL.md and make a 20-second product launch video about our new API. Deliver index.html, preview.html, and README.md.`
- `Use the HyperFrames Claude Design skill at https://github.com/heygen-com/hyperframes/blob/main/skills/claude-design-hyperframes/SKILL.md and turn https://www.anthropic.com/news/claude-design-anthropic-labs into a 45-second editorial launch video.`
- `Use the HyperFrames Claude Design skill entry point and build a 9:16 social teaser with captions, strong transitions, and a player-based preview.`
