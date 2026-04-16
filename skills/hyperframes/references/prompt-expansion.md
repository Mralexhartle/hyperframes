# Prompt Expansion

Expand a sparse user prompt into a full production prompt before proceeding with design and construction.

## When to expand

A prompt needs expansion if it lacks: scene-by-scene structure, specific visual elements per scene, transition descriptions, or timing.

**Sparse:** "make me a trailer about a killer alien on a spaceship" or "coconut water promo, tropical, 45 seconds"

**Already expanded:** Has numbered scenes with timing, specific elements, transition rules, and animation direction — skip this step.

## What to generate

Expand into a full production prompt with these sections:

1. **Title + style block** — genre, visual style, format, color direction, typography direction, mood, audio feel
2. **Global animation rules** — parallax layers, micro-motion requirements, kinetic typography, pacing rules, transition style
3. **Scene-by-scene breakdown** — for each scene:
   - Time range and title
   - Specific visual elements (not generic — "alien claw slides across wall" not "scary things happen")
   - Text/typography that appears with animation style
   - Background, midground, foreground layer descriptions
   - Transition to next scene as a specific morph (what object becomes what)
4. **Recurring motifs** — visual threads that appear across multiple scenes
5. **Transition rules** — every scene-to-scene connection described as object morphing
6. **Pacing curve** — where energy builds, peaks, and releases
7. **Negative prompt** — what to avoid

## User review

Present the expanded prompt to the user for review before proceeding. They may edit scenes, adjust pacing, or change the tone. Only move to the design system step after they approve.
