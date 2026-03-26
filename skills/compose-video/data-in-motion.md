# Data in Motion

How to present data, stats, and infographics in video compositions. This is NOT a web dashboard — video data visualization has different rules because the viewer can't hover, scroll, or study at their own pace.

## Core Principle

**One idea per beat.** The viewer has 2-3 seconds per data point before the next arrives. Every stat gets its own moment, its own scene, its own visual treatment. Never show 6 stats simultaneously.

## The Frame IS the Visualization

Don't reach for charts. The screen itself is your canvas — use its full area to make data feel visceral. Every number needs a visual companion that makes the viewer FEEL the data, not just read it.

### Match Technique to Data Meaning

Choose the visual treatment based on what the data emotionally represents:

| Data type               | Visual treatment                                                                                         | Why it works                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Growth / increase       | A fill that GROWS across the frame — bar expanding, container filling, element scaling up                | The motion itself tells the story of increase                                   |
| Comparison              | Two fills in the same space, one larger. The GAP between them is the story                               | The difference is visible and visceral                                          |
| Percentage / proportion | Fill the frame to the percentage. The empty space matters as much as the filled space                    | "99.9% uptime" with a nearly-full frame makes the 0.1% gap tiny and visceral    |
| Decline / loss          | Start full, shrink. Background drains from warm to cold as the value drops                               | Loss feels like loss — the viewer watches something disappear                   |
| Threshold / target      | Show a marker at the target, animate the actual value toward it — overshoot, undershoot, or exact hit    | The relationship between actual and target IS the story                         |
| Accumulation            | Visual density increasing — marks appearing, a space filling, the frame getting denser                   | The process of reaching the number is more engaging than the number itself      |
| Speed / performance     | Brief flash animation, quick horizontal sweep — the SPEED of the animation conveys the speed of the data | "150ms latency" shown as a near-instant flash communicates faster than a number |

### Hero Number + Visual Context

Every data scene has two layers:

1. **The number** — large (200-300px), prominent, positioned consistently
2. **The visual aid** — a proportional fill, color shift, spatial element, or motion that gives the number emotional context

Never show a number alone on a blank background. And never show a chart without a clear number. The two work together — the number is precise, the visual is emotional.

### The Frame IS the Scale

Use the full screen width or height as the 100% reference. "47% market share" = a fill that covers 47% of the frame width. The viewer sees the proportion instantly because the screen is the container. No axes needed. The unfilled space communicates the remaining amount just as powerfully.

### Time Replaces the X-Axis

Instead of a line chart showing months, reveal each month's value sequentially — same position on screen, the fill or number changes. The viewer feels the trend through rhythm. Growing fills build momentum. Shrinking fills create tension.

### Position Encodes Meaning

Higher values physically higher on screen. Growth on the right, decline on the left. The viewer reads spatial position without any legend.

### Color Reinforces Emotion

Use color shifts to amplify what the data means:

- Growth → warm colors intensifying (accent color fills expanding)
- Decline → desaturation, shift toward cooler tones
- Achievement → accent color flash on hit
- Danger/warning → background shifts toward red tones

## Techniques

### Count-Up with Visual Fill

The number counts from 0 to its final value while a proportional element fills simultaneously. Both reinforce each other.

```js
// Count up the number
const counter = { val: 0 };
tl.to(
  counter,
  {
    val: 2500000,
    duration: 1.5,
    ease: "power2.out",
    snap: { val: 1 },
    onUpdate: () => {
      el.textContent = counter.val.toLocaleString();
    },
  },
  0.3,
);

// Simultaneously fill the background bar to represent scale
tl.from("#fill-bar", { width: 0, duration: 1.5, ease: "power2.out" }, 0.3);
```

### Proportional Fill

A bar or shape that fills to represent a value. The unfilled space communicates the remaining amount.

```js
// 99.9% uptime — bar fills almost the entire frame width
tl.from("#bar", { width: 0, duration: 1, ease: "power3.out" }, 0.3);
// The tiny gap at the right edge says more than the number
```

### Reduction

Start with the full amount and carve away. Use for data where the smallness is the point.

```js
// "Only 3% accepted" — start full, reduce to a sliver
gsap.set("#bar", { width: "100%" });
tl.to("#bar", { width: "3%", duration: 1.2, ease: "power2.inOut" }, 0.5);
// Background color shifts from confident to stark during reduction
tl.to("#bg", { backgroundColor: "#1a0000", duration: 1.2, ease: "power1.inOut" }, 0.5);
```

### Threshold Hit

Show a target marker, then animate the actual value toward it. The moment of hitting (or missing) the target is dramatic.

```js
// Target line at 80% of frame width
gsap.set("#target-marker", { left: "80%" });
// Actual value fills toward target
tl.from("#actual-bar", { width: 0, duration: 1.5, ease: "power3.out" }, 0.3);
// Flash the accent color when the bar crosses the target
tl.to("#target-marker", { backgroundColor: "#accent", duration: 0.15, ease: "none" }, 1.2);
```

### Sequential Comparison

Show the first value with a fill, let it register (1-2 seconds), then show the second value in the same space. The viewer compares to their memory of the first — more dramatic than simultaneous display.

### Color Temperature Shift

The background or accent elements shift color to reinforce the data's meaning as it's revealed. Growth warms up. Loss cools down. Hitting a target flashes.

## What NOT To Do

- **No pie charts** — segments are hard to compare and look like PowerPoint. Use a single-value donut ring for one percentage, or sequential hero numbers for multiple values.
- **No multi-axis charts** — the viewer can't study intersections in a 3-second window.
- **No dashboards** — multiple charts side by side is a web pattern. One stat per scene.
- **No gridlines or tick marks** — visual noise that adds nothing in motion.
- **No legends** — if you need a legend to explain your visualization, the visualization isn't working. Use color + direct labels.
- **No chart library output** — D3, Chart.js, etc. produce static chart patterns. Build with GSAP + SVG/CSS for video-native animation.

## Structure for Multi-Stat Compositions

When showing multiple data points (e.g., 3 metrics):

1. **Scene per stat** — each metric gets its own 3-5 second scene with a full-frame reveal
2. **Build rhythm** — first stat enters at the composition's pace, each subsequent stat enters slightly faster (accelerating reveal creates momentum)
3. **Callback/summary** — after all stats are revealed individually, optionally show them together briefly as a final frame (this is the only time multiple stats share the screen)
4. **Consistent position** — keep the hero number in the same screen position across scenes so the viewer's eye doesn't hunt

See [house-style.md](./house-style.md) for motion defaults, palette selection, and scene pacing.
