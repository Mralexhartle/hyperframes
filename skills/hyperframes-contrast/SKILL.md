---
name: hyperframes-contrast
description: Audit color contrast in a HyperFrames composition and fix WCAG failures. Use after laying out text/typography, before declaring a composition done. Renders seeked frames, measures WCAG ratios between text elements and the pixels behind them, and reports which elements fail AA/AAA and how to fix each one. Invoke whenever text lands on gradients, photography, video frames, or any non-solid background.
---

# HyperFrames Contrast Audit

You cannot trust your own eyes on rendered frames you have not seen. Bad contrast is the most common unforced error in LLM-authored video — text against backgrounds you did not actually look at. This skill gives you a pixel-level readout so you can fix failures before handing the composition back.

## When to run

Run this skill:

1. **After layout is final** and the hero frame looks right in your head.
2. **Before adding animations** — static contrast fails are cheaper to fix without motion in the way.
3. **Any time text sits on**: gradients, imagery, video frames, translucent overlays, glassmorphic surfaces, or a color you pulled from the palette without checking.
4. **Before declaring the composition done.** This is a hard gate.

If every text element sits on a flat solid color that you explicitly paired from the palette, you may skip — but say so out loud in your plan so the reviewer can push back.

## How to run

```bash
node skills/hyperframes-contrast/scripts/contrast-report.mjs <composition-dir> \
  --samples 10 \
  --out .hyperframes/contrast
```

- `<composition-dir>` — directory containing `index.html`. Works with raw authoring HTML — the script auto-injects the HyperFrames runtime at serve time.
- `--samples N` — how many timestamps to probe, evenly spaced across the duration. Default `10`.
- `--out <dir>` — where to write the report and overlay images. Default `.hyperframes/contrast/`.

The script:

1. Launches the engine's headless browser, serves the composition via the built-in file server, and seeks to each sample timestamp.
2. At every sample, walks the DOM for elements whose computed style has renderable text (non-empty text node, opacity above 0, visibility not hidden, non-zero rect).
3. For each text element: resolves the declared foreground color from computed style, samples a 4-pixel ring of background pixels just outside the element bbox (median luminance), computes the WCAG 2.1 contrast ratio.
4. Writes:
   - `contrast-report.json` — machine-readable list of `{ time, selector, text, fg, bg, ratio, wcagAA, wcagAALarge, wcagAAA }`.
   - `contrast-overlay.png` — sprite grid of the sampled frames, each text element annotated: **magenta box = fails AA**, yellow box = passes AA but fails AAA, green box = passes AAA. The ratio is printed next to each box.

## How to use the output

**Read both files.** The JSON is authoritative; the PNG is what you eyeball to find the offending element fast.

```
For each entry in contrast-report.json:
  if wcagAA === false:
    this is a HARD FAIL — fix before finishing.
  if wcagAALarge === false and the text is NOT >= 24px normal / 19px bold:
    also a hard fail.
  if wcagAA === true but wcagAAA === false and the text is body copy:
    soft fail — fix if cheap.
```

You must address every hard fail. Re-run the script. The ratio must clear the threshold on the actual rendered pixels, not in your head.

## How to fix a failure

Pick the remedy that preserves the design intent. In order of preference:

1. **Recolor the text** to a palette neighbor with higher contrast against the background. Cheapest, no layout change. Verify the new color still belongs to the palette — don't invent a color just to pass.
2. **Add a backdrop pill** behind the text (`background-color` with sufficient opacity, `padding`, `border-radius`). Good for text on imagery. Keep the pill color in-palette.
3. **Add a scrim** — a gradient overlay between the background and the text. Good for video or photography backgrounds. Keep it subtle; aim for the minimum opacity that clears AA, not a black slab.
4. **Reposition the text** into a calmer region of the frame (e.g. away from the bright center of a gradient). Requires re-verifying layout.
5. **Darken/lighten the background** globally. Last resort — this changes the design feel.

**Anti-patterns — do NOT do these:**

- Bumping `font-weight` to 700+ "to compensate." WCAG doesn't care about weight for normal text thresholds.
- Adding a `text-shadow`. Shadows help readability perceptually but the pixel under the glyph is unchanged; the ratio won't move meaningfully.
- Raising `font-size` just to cross the large-text threshold. Only valid if the larger size is genuinely the design decision, not a contrast dodge.
- Silencing the report ("the overlay script got a weird bbox, I think it's fine") — treat unverified failures as failures.

## Thresholds

WCAG 2.1 AA is the baseline. AAA is the goal for body copy.

| Text size                       | AA        | AAA       |
| ------------------------------- | --------- | --------- |
| Normal text (<24px, <19px bold) | **4.5:1** | **7:1**   |
| Large text (≥24px, ≥19px bold)  | **3:1**   | **4.5:1** |

Motion text (captions, titles that appear briefly) should still clear AA at rest. Entrance/exit tween frames are not sampled by default — only steady-state frames after tween completion.

## Limits

- The script assumes WCAG-relevant contrast is between the **declared** foreground CSS color and the **measured** background pixels. If you are using gradient text (`background-clip: text`), the declared color is often transparent — the script falls back to sampling the glyph centroid. Those readings are approximate; spot-check manually.
- Translucent text (`opacity < 1`) is composited against the background; the script reports the composited color as fg. Expect lower ratios than the raw CSS color implies.
- Text elements smaller than 8×8 px are skipped (decorative glyphs, icon labels).

## Checklist

- [ ] Composition in steady state at each sample timestamp (no mid-tween frames being judged as final layout)
- [ ] Every entry in `contrast-report.json` passes WCAG AA
- [ ] No element is skipped silently — if the report warns about an element, address it or justify why it is safe
- [ ] Re-run after every fix until clean
- [ ] The overlay PNG shows no magenta boxes
