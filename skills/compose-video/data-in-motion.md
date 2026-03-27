# Data in Motion

How to present data, stats, and infographics in video compositions. This is NOT a web dashboard — video data visualization has different rules because the viewer can't hover, scroll, or study at their own pace.

## Core Principles

**One idea per beat.** The viewer has 2-3 seconds per data point before the next arrives. Every stat gets its own moment.

**Visual continuity for related data.** When successive stats belong to the same concept (Q1 → Q2 → Q3 → Q4, or three metrics for the same product), keep them in the same visual space with the same aesthetic. The number stays in the same position. The fill uses the same bar or shape. Only the VALUE changes — the viewer watches progression, not chaos. An aesthetic change (new layout, new position, new color scheme) should signal a NEW concept, not just a new number.

**Calm confidence over flashiness.** Professional data presentations are restrained. Not every number needs to explode onto screen. Sometimes metrics sit cleanly side-by-side. Sometimes a number simply appears with a quiet fill. Reserve dramatic motion for genuinely dramatic data (a record being broken, a sudden change, a threshold crossed). Default to composed and measured.

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

### Every Stat Needs Visual Context

A number alone on screen is sterile. Pair data with a visual treatment — a fill, a color shift, a shape, a spatial relationship. But don't mistake variety for quality. Related metrics should share the same visual language. Change the layout when the CONCEPT changes, not when the number changes.

### The Frame IS the Scale

Use the full screen width or height as the 100% reference. "47% market share" = a fill that covers 47% of the frame width. The viewer sees the proportion instantly because the screen is the container. No axes needed. The unfilled space communicates the remaining amount just as powerfully.

### Time Replaces the X-Axis

Instead of a line chart showing months, reveal each month's value sequentially — same position on screen, the fill or number changes. The viewer feels the trend through rhythm. Growing fills build momentum. Shrinking fills create tension.

### Position Encodes Meaning

Higher values physically higher on screen. Growth on the right, decline on the left. The viewer reads spatial position without any legend.

### Color Reinforces Emotion

Animate background color or accent element colors during data reveals — this is one of the most powerful techniques and should be used in most data scenes. The color shift happens WITH the data reveal, not separately:

- Growth → background warms (shift toward accent color) as the fill expands
- Decline → background desaturates or cools as the value shrinks
- Achievement → brief flash of accent color when a target is hit
- Danger/warning → background shifts toward deep red
- Comparison → the winning side's color intensifies while the losing side dims

## Techniques

These are descriptions, not templates. Implement them differently each time — the LLM knows GSAP well enough to build any of these from the description alone.

- **Count-up** — animate a number from 0 to its final value using GSAP's `onUpdate` callback with `snap`. Pair it with a visual that grows simultaneously.
- **Proportional fill** — a shape fills to represent the value. The unfilled space is just as meaningful. Use width, height, or clip-path — don't default to scale for everything.
- **Reduction** — start full, shrink to the actual value. Powerful for small percentages or losses. The viewer watches something disappear.
- **Threshold hit** — show where the target is, then animate the actual value toward it. The moment of reaching (or missing) the target is the drama.
- **Sequential comparison** — show value A with a fill, hold, then show value B in the same space. The viewer compares to their memory. More dramatic than side-by-side.
- **Color temperature shift** — background or accent elements shift color as data is revealed. Growth warms. Loss cools. Achievement flashes.
- **Spatial stacking** — represent quantity by stacking visual marks (blocks, dots, lines) that accumulate to fill a space.
- **Reveal through motion** — the animation speed itself conveys data. Fast sweep = fast performance. Slow fill = slow growth. The timing IS information.

## What NOT To Do

- **No pie charts** — segments are hard to compare and look like PowerPoint. Use a single-value donut ring for one percentage, or sequential hero numbers for multiple values.
- **No multi-axis charts** — the viewer can't study intersections in a 3-second window.
- **No 6-panel dashboards** — showing 6+ charts simultaneously is a web pattern. 2-3 related metrics side-by-side is fine when they're peers.
- **No gridlines or tick marks** — visual noise that adds nothing in motion.
- **No legends** — if you need a legend to explain your visualization, the visualization isn't working. Use color + direct labels.
- **No chart library output** — D3, Chart.js, etc. produce static chart patterns. Build with GSAP + SVG/CSS for video-native animation.

## Structure for Multi-Stat Compositions

When showing multiple data points, choose the approach that fits:

**Sequential scenes** — each metric gets its own beat. Best for stats that tell a story in order (Q1→Q2→Q3→Q4, or a narrative arc). Keep the number and fill in the SAME position across scenes — only the value changes. The viewer watches progression.

**Side-by-side** — 2-3 related metrics visible at once. Best for comparison data (our product vs theirs) or a set of peer metrics (users, uptime, latency). This is calmer and more professional than flashing stats one at a time. Use when the relationship between metrics matters more than the individual values.

**Grouped reveal** — a hybrid. Show the layout with placeholders, then fill in values one by one with stagger. The viewer sees the structure first, then watches it come alive. Good for report-style compositions.

**Match structure to data relationship:**

- Independent metrics (users, uptime, latency) → side-by-side or grouped reveal
- Sequential/time-series (Q1, Q2, Q3, Q4) → sequential scenes, same visual space
- Comparative (us vs them, before vs after) → side-by-side with fills that race or contrast
- Narrative (problem → solution → result) → sequential scenes with aesthetic shift at each concept change

See [house-style.md](./house-style.md) for motion defaults, palette selection, and scene pacing.
