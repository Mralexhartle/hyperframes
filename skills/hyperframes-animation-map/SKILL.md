---
name: hyperframes-animation-map
description: Map every GSAP animation in a HyperFrames composition to a structured JSON report with per-tween summaries, bbox trajectories, and flags. Use after authoring animations and before final render. Catches off-screen elements, invisible tweens, collisions, and bad pacing.
---

# HyperFrames Animation Map

You write GSAP code but you cannot see how it plays. You guess at pacing, overshoot, collision, and whether the animation is even visible. This skill makes every tween legible: structured data you can read and reason about.

## When to run

1. After all animations are authored.
2. Before declaring the composition done.
3. Whenever you wrote an animation you have not verified.

## How to run

```bash
node skills/hyperframes-animation-map/scripts/animation-map.mjs <composition-dir> \
  --out .hyperframes/anim-map
```

- `<composition-dir>` — directory containing index.html. Raw authoring HTML works.
- `--frames N` — bbox samples per tween (default 6).
- `--out <dir>` — output directory (default .hyperframes/anim-map/).
- `--min-duration S` — skip tweens shorter than this (default 0.15s).

## Output

A single `animation-map.json`:

```json
{
  "duration": 35.5,
  "mappedTweens": 17,
  "totalTweens": 17,
  "tweens": [
    {
      "index": 1,
      "selector": "#card1",
      "props": ["opacity", "y"],
      "start": 5.2,
      "end": 5.7,
      "duration": 0.5,
      "ease": "power3.out",
      "bboxes": [
        { "t": 5.24, "x": 120, "y": 223, "w": 640, "h": 80, "opacity": 0, "visible": true },
        { "t": 5.45, "x": 120, "y": 208, "w": 640, "h": 80, "opacity": 0.7, "visible": true },
        { "t": 5.66, "x": 120, "y": 200, "w": 640, "h": 80, "opacity": 1, "visible": true }
      ],
      "flags": [],
      "summary": "#card1 animates opacity+y over 0.50s (power3.out). moves 23px up. fades in. ends at (120, 200) 640x80px."
    }
  ]
}
```

Each tween has a `summary` — a single sentence describing what happens in plain language. Read the summaries first, check flags second, look at bboxes only if something needs debugging.

## Flags

- **offscreen** — element partially or fully outside the viewport during the tween.
- **degenerate** — element has 0 width or height throughout (invisible by geometry).
- **invisible** — element has opacity 0 and visibility hidden throughout the tween window.
- **collision** — element overlaps another animated element by more than 30% area at the same timestamp.
- **paced-fast** — duration under 0.2s for a tween that moves or fades; may feel twitchy.
- **paced-slow** — duration over 2.0s; may feel sluggish.

## How to use

1. Read `animation-map.json`.
2. Scan summaries for anything unexpected (wrong direction, missing fade, bad timing).
3. Check every flag. Fix or justify each one.
4. Verify tween count matches what you authored — extra tweens may indicate duplicates.

## Fixing flagged tweens

- **offscreen**: change the from/to values so the element stays within the canvas. Check the final bbox coordinates.
- **degenerate**: the element has width/height 0 — likely scaled to 0 without a corresponding scale-up, or a CSS issue.
- **invisible**: opacity is 0 throughout. Either tween opacity up, or the parent is hidden.
- **collision**: stagger the tweens or move one element to a different region.
- **paced-fast/slow**: adjust duration. Entrances: 0.4-0.8s. Exits: 0.3-0.5s. Hero reveals: 0.8-1.2s.

## Anti-patterns

- Declaring a tween "fine" without reading its summary. The summary is the minimum check.
- Ad-hoc tweens via `gsap.to()` outside the timeline. Only tweens inside `window.__timelines` are mapped.

## Checklist

- [ ] Every authored tween appears in the map
- [ ] Every flagged tween is fixed or justified
- [ ] Summaries describe the intended motion
- [ ] Re-run after any animation change
