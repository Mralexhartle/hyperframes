# Multi-Scene Build Pipeline

For compositions with 4 or more scenes, build in phases instead of one pass. A single pass produces shallow results — detail drops as context fills with boilerplate.

## Phase 1: Scaffold

Build the HTML skeleton yourself:

- All scene `<div>` elements with `data-start`, `data-duration`, `data-track-index`
- The root composition container with `data-composition-id`, `data-width`, `data-height`
- The GSAP timeline backbone: `gsap.timeline({ paused: true })`, `window.__timelines` registration
- All transition code between scenes (read [transitions.md](transitions.md))
- Global CSS: body reset, scene positioning, font declarations, the `design.md` palette as CSS
- Leave each scene's inner content empty: `<div id="scene1" class="scene"><!-- SCENE 1 CONTENT --></div>`

## Phase 2: Scene subagents

Dispatch one subagent per scene, running in parallel. Each subagent receives:

- The `design.md` (or its values summarized)
- The global animation rules from the prompt
- That scene's specific prompt section only
- Instructions: "Write your output to `.hyperframes/scenes/sceneN.html` as a single file with three clearly marked sections: `<!-- HTML -->`, `<!-- CSS -->`, `<!-- GSAP -->`. Use the timeline variable `tl`. Start tweens at `{start_time}`. Do not create the timeline or register it — the parent handles that. **Do NOT use `tl.from()` in multi-scene compositions** — use `tl.set()` + `tl.to()` instead. The `tl.set` hides the element at **time 0** (not scene start — time 0 ensures elements are hidden before any transition reveals the scene), then `tl.to` animates it in at the scene time. Example: `tl.set('#el', { opacity: 0, y: 30 }, 0); tl.to('#el', { opacity: 1, y: 0, duration: 0.4 }, sceneStart + 0.5);`. The `tl.from` approach causes elements to flash visible at their CSS default state before the entrance tween fires. **Do NOT set `position`, `top`, `left`, `width`, `height`, `opacity`, or `z-index` on the `#sceneN` container in your CSS** — the scaffold owns those properties. Only style elements INSIDE the scene."

Each subagent focuses its entire context on making ONE scene visually rich: parallax layers, micro-animations, kinetic typography, ambient motion, background decoratives. No boilerplate, no other scenes. **Each subagent must write to a file** — text returned in conversation is not accessible to the assembly agent.

## Phase 2b: Streaming evaluation

As each scene file appears in `.hyperframes/scenes/`, dispatch an evaluator subagent immediately — don't wait for all scenes to finish. The evaluator receives:

- The scene file
- That scene's section from the original prompt
- The `design.md`

The evaluator checks:

- **Prompt adherence**: Does the scene include the elements the prompt described? List what's present and what's missing.
- **Design compliance**: Are the design.md colors, fonts, corners, and spacing used? Any invented values?
- **Rule compliance**: No `tl.from`, no `position` on scene container, `tl.set` at time 0, all repeats finite.
- **Density**: 15+ animated elements? 3 parallax layers?

The evaluator writes a verdict to `.hyperframes/scenes/sceneN.eval.md`: PASS or FAIL with specific issues. If FAIL, re-dispatch the scene subagent with the evaluator's feedback appended to the original instructions. If PASS, the scene is ready for assembly.

Run evaluators concurrently with scene builds — a scene that finishes first gets evaluated first. The pipeline streams, not batches.

## Phase 3: Assembly

Once all scenes have PASS evaluations, read each scene file from `.hyperframes/scenes/` and:

- Extract the HTML, CSS, and GSAP blocks from each `sceneN.html`
- Inject HTML into the scaffold's empty scene divs
- Merge CSS blocks into the style element (check for ID conflicts — prefix with scene ID if needed)
- Merge GSAP tweens into the single timeline (adjust start times if subagent used relative offsets)
- Run `npx hyperframes lint` and fix any structural issues
- Run `npx hyperframes validate` if available
