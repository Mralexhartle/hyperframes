---
name: transitions
description: Use when a HyperFrames composition has multiple scenes that need transitions between them. Also use when the user mentions crossfades, wipes, reveals, scene changes, or when a composition feels like scenes just pop in and out without visual handoffs.
---

# Scene Transitions

A transition tells the viewer how two scenes relate. A crossfade says "this continues." A push slide says "next point." A flash cut says "wake up." A blur crossfade says "drift with me." Choose transitions that match what the content is doing emotionally, not just technically.

## Energy → Primary Transition

| Energy                                   | Primary                      | Accent for key moments         | Duration  | Easing                 |
| ---------------------------------------- | ---------------------------- | ------------------------------ | --------- | ---------------------- |
| **Calm** (wellness, brand story, luxury) | Blur crossfade, focus pull   | Light leak, circle iris        | 0.5-0.8s  | `sine.inOut`, `power1` |
| **Medium** (corporate, SaaS, explainer)  | Push slide, staggered blocks | Squeeze, vertical push         | 0.3-0.5s  | `power2`, `power3`     |
| **High** (promos, sports, music, launch) | Flash cut, zoom through      | Staggered blocks, gravity drop | 0.15-0.3s | `power4`, `expo`       |

Pick ONE primary (60-70% of scene changes) + 1-2 accents. Never use a different transition for every scene.

## Mood → Transition Type

Think about what the transition _communicates_, not just what it looks like.

| Mood                     | Transitions                                                                            | Why it works                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Warm / inviting**      | Light leak, blur crossfade, focus pull, film burn                                      | Soft edges, warm color washes. Nothing sharp or mechanical. The transition feels like sunlight.                         |
| **Cold / clinical**      | Squeeze, zoom out, blinds, shutter, grid dissolve                                      | Content transforms mechanically — compressed, shrunk, sliced, gridded. Zoom out creates clinical distance. No softness. |
| **Editorial / magazine** | Push slide, vertical push, diagonal split, shutter                                     | Like turning a page or slicing a layout. Clean directional movement. Diagonal split is a bold editorial cut.            |
| **Tech / futuristic**    | Grid dissolve, staggered blocks, blinds, chromatic aberration                          | Grid dissolve is the core "data" transition. Pattern-based, coordinated. Data-grid aesthetic.                           |
| **Tense / edgy**         | Glitch, VHS, chromatic aberration, flash cut, ripple                                   | Instability, distortion, digital breakdown. The medium itself is corrupted.                                             |
| **Playful / fun**        | Elastic push, 3D flip, circle iris, morph circle, clock wipe                           | Overshoot, bounce, rotation, expansion. Clock wipe has a whimsical mechanical quality.                                  |
| **Dramatic / cinematic** | Zoom through, zoom out, gravity drop, overexposure, diagonal split, color dip to black | Scale, weight, light extremes. Big spatial movements. Diagonal split is a bold geometric cut.                           |
| **Premium / luxury**     | Focus pull, blur crossfade, color dip to black, slow crossfade                         | Restraint. Long durations, soft easing, minimal movement. The transition barely exists — that IS the luxury.            |
| **Retro / analog**       | Film burn, light leak, VHS, clock wipe                                                 | Organic imperfection. Warm color bleeds, scan line displacement. Clock wipe evokes broadcast TV.                        |

## Narrative Position

| Position                   | Use                                                                        | Why                                                   |
| -------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Opening**                | Your most distinctive transition. Match the mood. 0.4-0.6s                 | Sets the visual language for the entire piece.        |
| **Between related points** | Your primary transition. Consistent. 0.3s                                  | Don't distract — the content is continuing.           |
| **Topic change**           | Something different from your primary. Staggered blocks, shutter, squeeze. | Signals "new section" — the viewer's brain resets.    |
| **Climax / hero reveal**   | Your boldest accent. Fastest or most dramatic.                             | This is the payoff — spend your best transition here. |
| **Wind-down**              | Return to gentle. Blur crossfade, crossfade. 0.5-0.7s                      | Let the viewer exhale after the climax.               |
| **Outro**                  | Slowest, simplest. Crossfade, color dip to black. 0.6-1.0s                 | Closure. Don't introduce new energy at the end.       |

## Blur Intensity by Energy

| Energy     | Blur    | Duration | Hold at peak |
| ---------- | ------- | -------- | ------------ |
| **Calm**   | 20-30px | 0.8-1.2s | 0.3-0.5s     |
| **Medium** | 8-15px  | 0.4-0.6s | 0.1-0.2s     |
| **High**   | 3-6px   | 0.2-0.3s | 0s           |

## Presets

| Preset     | Duration | Easing            |
| ---------- | -------- | ----------------- |
| `snappy`   | 0.2s     | `power4.inOut`    |
| `smooth`   | 0.4s     | `power2.inOut`    |
| `gentle`   | 0.6s     | `sine.inOut`      |
| `dramatic` | 0.5s     | `power3.in` → out |
| `instant`  | 0.15s    | `expo.inOut`      |
| `luxe`     | 0.7s     | `power1.inOut`    |

## Implementation

Read [catalog.md](./catalog.md) for GSAP code and hard rules for every transition type.

| Category             | Transitions                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Content-transforming | Push slide, vertical push, elastic push, squeeze, zoom through, zoom out, gravity drop, 3D flip |
| Reveal/mask          | Circle iris, diamond iris, diagonal split, clock wipe, shutter                                  |
| Dissolve             | Crossfade, blur crossfade, focus pull, color dip                                                |
| Cover                | Staggered blocks, horizontal blinds, vertical blinds                                            |
| Light                | Light leak, overexposure burn, film burn                                                        |
| Distortion           | Glitch, chromatic aberration, ripple, VHS tape                                                  |
| Pattern              | Grid dissolve                                                                                   |
| Instant              | Flash cut, morph circle                                                                         |

## Transitions That Don't Work in CSS

Avoid: star iris, tilt-shift, lens flare, hinge/door. See catalog.md for why.
