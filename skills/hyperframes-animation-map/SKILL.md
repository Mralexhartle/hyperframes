---
name: hyperframes-animation-map
description: Visualize every GSAP animation in a HyperFrames composition as a sprite sheet so you can actually see how motion plays out. Use after authoring animations and before final render. The script reads window.__timelines, enumerates every tween, renders N frames across each tween window with a high-contrast box drawn on the animated element, and emits one sprite sheet per element plus a timeline JSON. Review the output to catch off-screen animations, collisions, stiff pacing, and entrances that never visually arrive.
---

# HyperFrames Animation Map

LLMs write GSAP code blind. You can see where elements _end up_ (that's CSS), but you cannot see how they move — you are guessing at pacing, overshoot, collision, and whether the animation is even visible on screen. This skill makes the motion legible: every tween becomes a sprite sheet you can read.

## When to run

Run this skill:

1. **After all animations are authored.** The timeline should be complete — entrances, exits, nested sub-compositions, the lot.
2. **Before declaring the composition done.** Hard gate, same as contrast.
3. **Whenever you wrote an animation you have not visually verified**, even a small one.

If you only wrote a single crossfade and nothing else moves, you can skip — but say so in your plan.

## How to run

```bash
node skills/hyperframes-animation-map/scripts/animation-map.mjs <composition-dir> \
  --frames 8 \
  --out .hyperframes/anim-map
```

- `<composition-dir>` — directory containing `index.html`. Works with raw authoring HTML — the script auto-injects the HyperFrames runtime at serve time.
- `--frames N` — screenshots per tween, evenly spaced from start to end. Default `8`.
- `--out <dir>` — report directory. Default `.hyperframes/anim-map/`.
- `--min-duration 0.15` — skip tweens shorter than this (seconds). Default `0.15` to suppress imperceptible micro-tweens.

The script:

1. Launches the headless engine on the composition.
2. Reads `window.__timelines` and recursively descends into every child timeline.
3. For every top-level tween, resolves:
   - the DOM target (from `tween.targets()`),
   - absolute start and end time on the master timeline,
   - which properties are being animated,
   - the animated element's bbox at each sampled frame.
4. For each tween, renders `frames` screenshots between start and end. On every frame it overlays the target's bbox in high-contrast magenta, with a label showing `{selector} {props} t={time}s`.
5. Stitches each tween's frames into a horizontal sprite sheet.

## Output

```
.hyperframes/anim-map/
  animation-map.json       # timeline + per-tween metadata
  sprites/
    01_title_opacity_y.png # one sprite sheet per tween, named by tween index + target + props
    02_subtitle_x.png
    ...
```

`animation-map.json` shape:

```json
{
  "compositionId": "my-video",
  "duration": 30.0,
  "tweens": [
    {
      "index": 1,
      "selector": ".title",
      "targets": 1,
      "props": ["opacity", "y"],
      "start": 0.0,
      "end": 0.6,
      "ease": "power3.out",
      "bboxes": [
        { "t": 0.0, "x": 160, "y": 220, "w": 820, "h": 140 },
        { "t": 0.3, "x": 160, "y": 190, "w": 820, "h": 140 },
        { "t": 0.6, "x": 160, "y": 160, "w": 820, "h": 140 }
      ],
      "sprite": "sprites/01_title_opacity_y.png",
      "flags": []
    }
  ]
}
```

Flags are script-generated warnings you should attend to:

- `offscreen` — the target's bbox is partially or fully outside the viewport during part of the tween.
- `degenerate` — the target has width or height 0 at one or more sampled frames.
- `invisible` — the target has `opacity: 0` or `visibility: hidden` throughout the tween window (animation is happening, but nothing is visible).
- `collision` — the target's bbox overlaps another tween's target bbox at the same sample time by >30% area.
- `paced-fast` — tween duration under 0.2s for non-micro-interactions; may feel twitchy.
- `paced-slow` — tween duration over 2.0s for entrances/exits; may feel sluggish.

## How to use the output

**Read each sprite sheet.** That is the whole point. The LLM can Read PNG files — do it.

For every tween:

1. Check the sprite sheet. Does the element actually appear to move from A to B? Is the motion visible, or is the element off-screen / behind another element / opacity-0 the whole time?
2. Check the flags in `animation-map.json`. Address every flag or justify why it's intentional.
3. Check pacing: the frames are evenly spaced in time, so visually uneven stride = non-linear easing. That's often correct. But if the element barely moves for 6 frames and then snaps at the end, your easing is probably wrong.
4. Check collisions: if flagged, the animation overlaps another element's animation at the same moment. Either stagger them or confirm the overlap is design intent (e.g. layered entrance).

## How to fix a flagged animation

- **`offscreen`**: animate from `x` / `y` that lands on-screen, not `x: 200vw`. Or extend the tween so the arrival frame lingers on-screen before the next beat. Verify the element's final position is inside the canvas.
- **`degenerate`**: the element has `width: 0` or similar — usually means you tweened `scale` from/to 0 and the sprite sheet shows nothing. Fine for exits, bad for entrances if nothing comes in.
- **`invisible`**: you forgot to tween `opacity` back up, or the parent is hidden. Trace the visibility chain.
- **`collision`**: restagger with the position parameter on the timeline, or move one element to a different region of the frame.
- **`paced-fast` / `paced-slow`**: adjust `duration`. Entrances usually want 0.4–0.8s, exits 0.3–0.5s, hero reveals 0.8–1.2s.

## Anti-patterns

- Declaring a tween "fine" without reading its sprite sheet. If you skip the visual check, you are in exactly the position this skill exists to fix.
- Suppressing the flags (`flags: []` but the motion is obviously broken). The script is conservative — if it flagged something, look.
- Adding a parallel, untimed tween with `gsap.to` outside the timeline. Only tweens inside timelines registered in `window.__timelines` are mapped. If you wrote ad-hoc tweens, move them into the timeline or the audit misses them.
- Using the sprite sheet as decoration. It is a diagnostic — if you looked at it and didn't come away with a concrete verdict, look again.

## Checklist

- [ ] `animation-map.json` has every tween you intentionally authored (no "where did this come from" entries)
- [ ] Every sprite sheet has been visually inspected via Read
- [ ] Every flagged tween has been fixed or justified
- [ ] Pacing feels intentional, not accidental
- [ ] Re-run after any animation change
