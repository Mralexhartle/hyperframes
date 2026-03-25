# Decomposing After Effects Templates into HyperFrames Compositions

## Overview

A Claude Code skill that autonomously converts After Effects projects (`.aepx` files) into complete HyperFrames composition projects. The skill reads the `.aepx` XML, extracts the composition tree, maps AE features to HTML/CSS/GSAP equivalents, and generates a ready-to-preview project.

## Goals

- **Highest fidelity reproduction** of AE templates possible using HTML, CSS, GSAP (all plugins), and SVG
- **Autonomous execution** — the AI reads the file and generates the project, presenting a summary at the end
- **Complete project output** — `index.html`, `compositions/`, `fonts/`, `assets/` ready for studio preview
- **Take as many passes as needed** — optimize for fidelity, not speed

## Input

A path to an `.aepx` file (After Effects XML project format). The user may also provide asset files (video, audio, images, fonts) referenced by the project.

## Skill Structure

```
decomposing-ae/
├── SKILL.md                  # Process, workflow checklist, output format (~300 lines)
├── ae-mapping.md             # AE → HyperFrames mapping tables
├── aepx-structure.md         # .aepx XML structure and hex decoding guide
├── scripts/
│   └── parse-aepx.py         # Preprocessor: .aepx → clean JSON
└── examples/
    └── simple-title.md       # Input/output example
```

## Preprocessing Script: `parse-aepx.py`

### Why

The `.aepx` format encodes most meaningful data in hex binary strings:
- `<tdmn>` tags contain property names as hex-encoded ASCII (e.g., `4144424520416e63686f7220506f696e74` = "ADBE Anchor Point")
- `<cdat>` tags contain keyframe values as IEEE 754 doubles in hex
- `<tdb4>` tags encode keyframe metadata (count, interpolation type, bezier handles)
- `<ldta>` tags encode layer metadata (in/out point, timing, flags)
- `<cdta>` tags encode composition metadata (dimensions, frame rate, duration)

Having the AI decode hex inline would be error-prone and token-wasteful. A preprocessing script extracts and decodes all of this into clean JSON.

### Why Python

Python is the best tool for this job:
- `xml.etree.ElementTree` — built-in XML parser, no dependencies
- `struct.unpack('>d', data)` — IEEE 754 big-endian double decoding in one line
- `bytes.fromhex(s).decode('ascii')` — hex-to-ASCII `<tdmn>` decoding in one line
- `json.dumps()` — built-in JSON output
- Python 3 ships on macOS and virtually every Linux/dev machine — zero install required

### Input/Output

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py input.aepx > project.json
```

### Output Format

```json
{
  "projectName": "Free Modern Fast Promo",
  "folders": [
    {
      "name": "01. Edit",
      "children": [
        {
          "name": "Image",
          "children": [
            { "type": "composition", "name": "Photo/Video_01", "id": "comp-1" }
          ]
        },
        {
          "name": "Text",
          "children": [
            { "type": "composition", "name": "text_01", "id": "comp-2" }
          ]
        }
      ]
    },
    {
      "name": "02. Final Comp",
      "children": [
        { "type": "composition", "name": "Render", "id": "comp-main" }
      ]
    }
  ],
  "compositions": {
    "comp-1": {
      "name": "Photo/Video_01",
      "width": 1920,
      "height": 1080,
      "frameRate": 25,
      "duration": 10.0,
      "layers": [
        {
          "index": 1,
          "name": "modern promo",
          "type": "text",
          "inPoint": 0,
          "outPoint": 5.0,
          "parentIndex": null,
          "textContent": "modern promo",
          "fontFamily": "Montserrat",
          "fontSize": 72,
          "fontColor": "#ffffff",
          "transform": {
            "anchorPoint": { "value": [960, 540, 0], "keyframes": null },
            "position": {
              "value": [960, 540, 0],
              "keyframes": [
                {
                  "time": 0,
                  "value": [960, 800, 0],
                  "easing": { "type": "bezier", "inInfluence": 0.33, "outInfluence": 0.33 }
                },
                {
                  "time": 0.5,
                  "value": [960, 540, 0],
                  "easing": { "type": "easeOut" }
                }
              ]
            },
            "scale": { "value": [1, 1, 1], "keyframes": null },
            "rotation": { "value": 0, "keyframes": null },
            "opacity": {
              "value": 1,
              "keyframes": [
                { "time": 0, "value": 0, "easing": { "type": "linear" } },
                { "time": 0.3, "value": 1, "easing": { "type": "easeOut" } }
              ]
            }
          },
          "effects": [],
          "masks": [],
          "blendMode": "normal",
          "trackMatteType": null,
          "expression": null
        }
      ]
    }
  },
  "footage": {
    "footage-1": {
      "name": "presenter.mp4",
      "type": "video",
      "path": "presenter.mp4",
      "duration": 60.0
    }
  },
  "fonts": ["Montserrat", "Inter"],
  "warnings": [
    "Unrecognized effect match name: ADBE CC Particle World on layer 'particles' in comp 'scene-02'"
  ]
}
```

### What the Script Decodes

| `.aepx` Tag | Hex Content | Decoded To |
|---|---|---|
| `<tdmn>` | Property match names | Readable strings: "ADBE Anchor Point", "ADBE Position_0", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity", etc. |
| `<cdat>` | Keyframe values | IEEE 754 doubles → numbers |
| `<tdb4>` | Keyframe metadata | Keyframe count, interpolation type, bezier influence values |
| `<ldta>` | Layer data | In point, out point, start time, layer type flags, layer name |
| `<cdta>` | Composition data | Width, height, frame rate, duration, background color |
| `<string>` | Layer/comp names, expressions | Passed through as-is |
| Expressions in `<string>` after `<tdbs>` | AE expression code | Captured and associated with the property |

### Script Responsibilities

1. Parse `.aepx` XML using Python's built-in `xml.etree.ElementTree` (zero dependencies)
2. Walk the `<Fold>` / `<Item>` / `<Sfdr>` tree to build folder + composition hierarchy
3. For each composition (`<Item>` with `<cdta>`):
   - Decode `<cdta>` for dimensions, frame rate, duration
   - Walk `<Layr>` children to extract layers
4. For each layer:
   - Decode `<ldta>` for in/out point, type, name, parent layer index
   - Walk `<tdgp>` groups to find transform properties (position, scale, rotation, opacity, anchor point)
   - Decode `<tdmn>` hex to identify which property each `<tdbs>` represents
   - Decode `<tdb4>` for keyframe count and interpolation metadata
   - Decode `<cdat>` for keyframe values (use `struct.unpack('>d', data)` for big-endian IEEE 754 doubles)
   - Extract effects (by `<tdmn>` match name)
   - Extract expressions (inline `<string>` elements after `<tdbs>`)
   - Extract text document data (font, size, color, content)
   - Extract masks
   - Determine blend mode and track matte relationships
5. Collect footage items and font references
6. Output as JSON to stdout
7. Collect warnings for unrecognized `<tdmn>` match names, unexpected `<cdat>` byte lengths, and unsupported layer types — include in JSON output `warnings` array rather than crashing

### Known `<tdmn>` Match Names

These are the hex-encoded property identifiers the script needs to recognize:

**Transform group:**
- `ADBE Transform Group` — container
- `ADBE Anchor Point` — anchor point (2D/3D)
- `ADBE Position` — combined position (when not separated)
- `ADBE Position_0` — X position (when separated)
- `ADBE Position_1` — Y position
- `ADBE Position_2` — Z position
- `ADBE Scale` — scale
- `ADBE Rotate Z` — Z rotation (2D rotation)
- `ADBE Rotate X` — X rotation (3D)
- `ADBE Rotate Y` — Y rotation (3D)
- `ADBE Opacity` — opacity

**Text:**
- `ADBE Text Properties` — text property group
- `ADBE Text Document` — text document (content, font, size, color)

**Effects:**
- `ADBE Effect Parade` — effects container
- Individual effects by match name (e.g., `ADBE Fill`, `ADBE Tint`, `ADBE Gaussian Blur 2`, `ADBE Color Control`)

**Shape layers:**
- `ADBE Root Vectors Group` — shape layer content group
- `ADBE Vector Shape - Group` — shape group
- `ADBE Vector Graphic - Fill` — fill
- `ADBE Vector Graphic - Stroke` — stroke
- `ADBE Vector Graphic - G-Fill` — gradient fill
- `ADBE Vector Graphic - G-Stroke` — gradient stroke
- `ADBE Vector Filter - Trim` — trim paths
- `ADBE Vector Filter - Repeater` — repeater
- `ADBE Vector Filter - RC` — rounded corners
- `ADBE Vector Filter - Merge` — merge paths
- `ADBE Vector Shape` — path data
- `ADBE Vector Rect` — rectangle
- `ADBE Vector Ellipse` — ellipse
- `ADBE Vector Star` — polystar

**Masks:**
- `ADBE Mask Parade` — masks container
- `ADBE Mask Shape` — mask path

**Layer types (from `<ldta>` flags):**
- Footage layer, solid layer, text layer, shape layer, null layer, adjustment layer, camera, light

## SKILL.md Content

### Frontmatter

```yaml
name: decomposing-ae
description: Decomposes After Effects projects (.aepx files) into HyperFrames HTML compositions. Parses the AE project structure, maps layers/effects/keyframes to HTML/CSS/GSAP equivalents, and generates a complete ready-to-preview project. Use when converting AE templates, recreating motion graphics from After Effects, or porting AE animations to HyperFrames.
```

### Workflow (in SKILL.md)

```
Decomposition Progress:
- [ ] Step 1: Preprocess .aepx (run parse-aepx.py)
- [ ] Step 2: Analyze project structure (review JSON output)
- [ ] Step 3: Plan the mapping (identify approximations)
- [ ] Step 4: Generate compositions (leaves to root)
- [ ] Step 5: Assemble root composition
- [ ] Step 6: Verify and summarize
```

**Step 1: Preprocess**
Run the parsing script to convert binary-encoded `.aepx` into clean JSON:
```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py <path-to-aepx> > /tmp/ae-project.json
```
Read the output JSON.

**Step 2: Analyze**
- Identify the main render composition (usually in "Final Comp" folder or the comp with the most layers/references)
- Build the composition dependency tree: which comps reference which pre-comps
- Count layers per comp, identify layer types
- List all footage items and fonts used
- Note the project dimensions and frame rate

**Step 3: Plan**
For each composition, map every layer and effect to its HyperFrames equivalent. Output a brief plan summary before proceeding to generation:
- Consult [ae-mapping.md](ae-mapping.md) for the mapping tables
- For each effect, choose the best CSS/SVG/GSAP approximation
- For keyframed properties, plan the GSAP tweens (property, values, timing, easing)
- Convert AE easing (bezier handles) to GSAP easing using `CustomEase.create()` or built-in presets
- Resolve layer parenting: layers with a `parentIndex` inherit transforms from the parent layer — generate nested DOM structures accordingly (child inside parent wrapper `<div>`)
- Convert AE coordinate system to CSS: AE anchor point is in layer-local pixels; CSS `transform-origin` is relative to the element. Position the element with `left`/`top` offset by anchor point, set `transform-origin` to match.
- For AE expressions containing `random()` or `wiggle()`, convert to deterministic equivalents (e.g., precomputed arrays indexed by frame number)
- Flag any features that require approximation and document the approach
- Determine generation order: leaf compositions first, root last

**Step 4: Generate (comp by comp, leaves to root)**
For each composition, create a `.html` file in `compositions/`:

1. **Structure** — HTML elements with data attributes
   - Every element gets a unique `id` using the pattern `ae-<comp-id>-<layer-index>` (e.g., `ae-text01-1`)
   - Text layers → `<div>` with styled text content
   - Footage (video) → `<video muted playsinline>` with `src` pointing to `assets/` + separate `<audio>` element
   - Footage (image) → `<img>` with `src` pointing to `assets/`
   - Footage (audio) → `<audio>` with `src`
   - Solid layers → `<div>` with background color
   - Shape layers → SVG elements or CSS
   - Null objects → wrapper `<div>` for grouping transforms; child layers with `parentIndex` pointing to this null become nested inside the wrapper
   - Pre-comps → `<div>` with `data-composition-id`, `data-composition-src`, `data-duration`, `data-width`, `data-height`
   - Set `data-start` (from layer inPoint), `data-duration` (from outPoint - inPoint), `data-track-index` (from layer stacking order)

2. **Styling** — CSS in `<style>` block, scoped with `[data-composition-id="<id>"]` prefix to prevent leaking
   - Positioning from AE position values, accounting for anchor point offset: `left: posX - anchorX; top: posY - anchorY; transform-origin: anchorX anchorY`
   - Colors, fonts, sizes from layer properties
   - Blend modes → `mix-blend-mode`
   - Track mattes → `mask-image` / `clip-path`
   - Effects → `filter` properties or SVG filters

3. **Animation** — GSAP timeline in `<script>` block
   - Convert each keyframed property to a GSAP tween
   - Map AE time (seconds from comp start) to GSAP timeline position
   - Map AE easing to GSAP easing
   - Use appropriate GSAP plugins (MotionPathPlugin for path motion, SplitText for text animation, MorphSVGPlugin for shape morphing, CustomEase for AE graph editor curves, DrawSVGPlugin for stroke animation)
   - Initialize and register timeline:
     ```js
     window.__timelines = window.__timelines || {};
     const tl = gsap.timeline({ paused: true });
     // ... tweens ...
     window.__timelines["<composition-id>"] = tl;
     ```

4. **Write** the composition file using the `<template>` format with `id="<composition-id>-template"`:
   ```html
   <template id="<comp-id>-template">
     <div data-composition-id="<comp-id>" data-width="1920" data-height="1080">
       <!-- elements -->
       <style>[data-composition-id="<comp-id>"] .element { ... }</style>
       <script>
         window.__timelines = window.__timelines || {};
         const tl = gsap.timeline({ paused: true });
         // ...
         window.__timelines["<comp-id>"] = tl;
       </script>
     </div>
   </template>
   ```

**Step 5: Assemble**
Generate `index.html` as the root composition:
- The root composition element must have `data-composition-id`, `data-start="0"`, `data-duration`, `data-width`, `data-height`
- Reference all sub-compositions via host elements with ALL required attributes:
  ```html
  <div id="el-intro"
       data-composition-id="intro-anim"
       data-composition-src="compositions/intro-anim.html"
       data-start="0"
       data-duration="5"
       data-track-index="2"
       data-width="1920"
       data-height="1080">
  </div>
  ```
- `data-duration` on each host element = the sub-composition's duration (from the AE pre-comp)
- `data-width` / `data-height` on each host element must match the sub-composition's dimensions
- Include project-level CSS (fonts via `@font-face`, base styles)
- Create root GSAP timeline and register with `window.__timelines`

Create the project directory structure:
```
<project-name>/
├── index.html
├── compositions/
│   └── <comp-name>.html (one per AE pre-comp)
├── fonts/
│   └── (font files if available)
└── assets/
    └── (video/image/audio files)
```

**Step 6: Verify and Summarize**
Present a summary to the user:
- All compositions generated with layer counts
- All approximations made (AE feature → HyperFrames equivalent used)
- Any unsupported features that were skipped
- Asset and font requirements (files the user needs to provide if not already present)

### Rules Referenced from compose-video

The skill must follow all rules from the [compose-video](../../.claude/skills/compose-video/SKILL.md) skill:
- **Deterministic output** — no `Math.random()`, `Date.now()`, or any randomness. AE expressions using `random()` or `wiggle()` must be converted to deterministic equivalents.
- **GSAP animation conflict avoidance** — never animate the same property on the same element from multiple timelines
- **`data-duration` required on all compositions** — both the host element in the parent and the composition root
- **`data-width` / `data-height` required on all compositions**
- **`window.__timelines` initialization** — always use `window.__timelines = window.__timelines || {};` before assigning
- **Separate `<audio>` elements** — video elements must be `muted playsinline`; audio is always a separate `<audio>` element
- **Every top-level container must be a composition** — must have `data-composition-id`
- **CSS scoping** — all composition styles must be scoped with `[data-composition-id="<id>"]` prefix
- **Template naming** — composition files must use `<template id="<comp-id>-template">` wrapper

### Known Limitations (v1)

- **Time remapping** — AE's time remapping for non-linear pre-comp playback is not converted. Pre-comps with time remapping will play at normal speed. Logged as a warning.
- **Complex expressions** — AE expressions beyond simple property references are logged but not auto-converted. The AI should manually interpret common patterns (`wiggle`, `loopOut`, `linear`, `ease`) where feasible.
- **3D camera** — Approximated with CSS `perspective`/`transform-style: preserve-3d` but not a true 3D camera. No depth-of-field or camera blur.
- **Motion blur** — Not natively supported in CSS/GSAP. Can approximate with directional `filter: blur()` on fast-moving elements.

## ae-mapping.md Content

Full mapping tables for:

**Layer types:**

| AE Layer | HyperFrames Equivalent |
|---|---|
| Footage (video) | `<video>` clip (muted, playsinline) + separate `<audio>` clip |
| Footage (image) | `<img>` clip |
| Footage (audio) | `<audio>` clip |
| Solid | `<div>` with `background-color` |
| Text | `<div>` with styled text; SplitText for per-character animation |
| Shape | SVG elements or CSS (depending on complexity) |
| Null object | Wrapper `<div>` for grouping transforms |
| Adjustment layer | CSS `filter` on a wrapper element |
| Pre-comp | Sub-composition via `data-composition-src` |
| Camera | CSS `perspective` + `transform-style: preserve-3d` on parent |
| Light | Approximate with CSS gradients/shadows |

**Transform properties:**

| AE Property | GSAP/CSS |
|---|---|
| Position | `x`, `y` (GSAP) |
| Scale | `scale`, `scaleX`, `scaleY` |
| Rotation | `rotation` (GSAP) |
| Opacity | `opacity` |
| Anchor Point | `transformOrigin` |
| 3D Position (X,Y,Z) | `x`, `y`, `z` with `perspective` on parent |
| 3D Rotation (X,Y,Z) | `rotationX`, `rotationY`, `rotationZ` |

**Effects:**

| AE Effect | Approximation |
|---|---|
| Gaussian Blur | `filter: blur(Npx)` |
| Drop Shadow | `filter: drop-shadow(...)` |
| Glow | Duplicate element + `filter: blur()` + `mix-blend-mode: screen` |
| Turbulent Displace | SVG `feTurbulence` + `feDisplacementMap` |
| Gradient Ramp | CSS `linear-gradient` / `radial-gradient` |
| Tritone/Tint | CSS `filter: sepia() hue-rotate() saturate()` |
| Stroke (on text) | `-webkit-text-stroke` or SVG text with stroke |
| CC Particle World | Script-driven DOM/Canvas in sub-composition |
| Fractal Noise | SVG `feTurbulence` |
| Mosaic | SVG pixelation filter |
| Color correction | CSS `filter: brightness() contrast() saturate()` |
| Fill | CSS `background-color` or SVG `fill` |
| Venetian Blinds | CSS `clip-path` animation or repeating gradient mask |
| Color Control | CSS custom properties / JS variables |

**Blend modes:**

| AE Mode | CSS `mix-blend-mode` |
|---|---|
| Normal | `normal` |
| Multiply | `multiply` |
| Screen | `screen` |
| Overlay | `overlay` |
| Soft Light | `soft-light` |
| Hard Light | `hard-light` |
| Color Dodge | `color-dodge` |
| Color Burn | `color-burn` |
| Difference | `difference` |
| Exclusion | `exclusion` |
| Add | `screen` (closest) |

**Track mattes:**

| AE Matte Type | CSS Equivalent |
|---|---|
| Alpha Matte | `mask-image` referencing the matte element |
| Alpha Inverted | `mask-image` + `mask-composite: exclude` |
| Luma Matte | `mask-image` + `mask-mode: luminance` |
| Luma Inverted | `mask-image` + `mask-mode: luminance` + `mask-composite: exclude` |

**Easing:**

| AE Preset | GSAP Equivalent |
|---|---|
| Easy Ease | `"power2.inOut"` |
| Easy Ease In | `"power2.in"` |
| Easy Ease Out | `"power2.out"` |
| Linear | `"none"` |
| Custom bezier | `CustomEase.create("name", "M0,0 C<cx1>,<cy1> <cx2>,<cy2> 1,1")` |

**GSAP Plugins:**

| Use Case | Plugin |
|---|---|
| Path-based motion | MotionPathPlugin |
| Shape morphing | MorphSVGPlugin |
| Per-character text animation | SplitText |
| SVG stroke drawing | DrawSVGPlugin |
| Custom easing from AE graph editor | CustomEase |
| Physics-based bounce/elastic | CustomBounce, CustomWiggle |
| Layout/flip animations | Flip |

## aepx-structure.md Content

Guide to the `.aepx` XML format based on real-world file analysis:

### Top-Level Structure

```xml
<AfterEffectsProject>
  <Pefl>          <!-- Plugin effect list -->
  <EfdG>          <!-- Effect definitions (global) -->
  <Fold>          <!-- Project root folder -->
    <Item>        <!-- Folder or composition -->
      <string>    <!-- Item name -->
      <Sfdr>      <!-- Subfolder contents -->
        <Item>... <!-- Nested items -->
      </Sfdr>
    </Item>
  </Fold>
</AfterEffectsProject>
```

### Identifying Item Types

- **Folder**: `<Item>` with `<Sfdr>` child and no `<cdta>`
- **Composition**: `<Item>` with `<cdta>` (composition data) and `<Layr>` children
- **Footage**: `<Item>` with footage-specific tags but no `<cdta>`

### Composition Data (`<cdta>`)

Binary-encoded. Key fields (byte offsets):
- Frame rate, width, height, duration
- The preprocessing script decodes this.

### Layer Data (`<Layr>` + `<ldta>`)

Each `<Layr>` contains:
- `<ldta>` — binary layer metadata (in point, out point, start time, type flags, name)
- `<string>` — layer name
- `<tdgp>` — property groups (transform, effects, masks, text)

### Property Groups (`<tdgp>`)

Properties are organized in groups identified by `<tdmn>` hex match names:
- `ADBE Transform Group` — contains position, scale, rotation, opacity, anchor point
- `ADBE Text Properties` → `ADBE Text Document` — text content and styling
- `ADBE Effect Parade` — effects list
- `ADBE Mask Parade` — masks list

### Property Values (`<tdbs>`)

Each property contains:
- `<tdb4>` — metadata: keyframe count, dimensions, interpolation type, bezier handles
- `<cdat>` — values as IEEE 754 doubles in hex
- Optional `<string>` — expression code

### Hex Decoding

All `<tdmn>` values are hex-encoded ASCII strings padded with null bytes to 40 bytes. To decode: convert each pair of hex digits to its ASCII character, strip trailing nulls.

Example: `4144424520416e63686f7220506f696e74` → "ADBE Anchor Point"

`<cdat>` values are sequences of IEEE 754 double-precision floats (8 bytes each, big-endian). Each keyframe has multiple doubles depending on the property dimensions.

### Common Folder Conventions

AE templates typically organize items as:
- `01. Edit` — user-editable compositions (media placeholders, text)
- `02. Final Comp` — render-ready main composition
- `03. Others` — helper compositions, pre-comps, utilities

The main render composition is usually the one in "Final Comp" or the comp with the most layer/pre-comp references.

## Coordinate System Conversion

AE and CSS use different coordinate models. This conversion is critical for accurate positioning.

**AE model:**
- Position is relative to the composition (0,0 = top-left of comp)
- Anchor Point is relative to the layer's own bounds (e.g., [100, 50] = 100px from left, 50px from top of the layer)
- The anchor point is where the layer "attaches" — position moves the anchor point to that comp location

**CSS/GSAP model:**
- `left`/`top` position the element's top-left corner
- `transform-origin` is the pivot for transforms, relative to the element

**Conversion formula:**
```
CSS left   = AE positionX - AE anchorPointX
CSS top    = AE positionY - AE anchorPointY
CSS transform-origin = AE anchorPointX + "px " + AE anchorPointY + "px"
```

For GSAP keyframes animating position, animate `x` and `y` relative to the initial `left`/`top` placement.

## Design Decisions

1. **Preprocessing script over inline hex decoding** — The `.aepx` binary encoding makes inline parsing error-prone and token-wasteful. A Python script produces clean JSON that the AI can reason about directly.

2. **Python for the script** — Built-in XML parser, struct module for binary decoding, and json output. Zero dependencies. Python 3 is available on virtually every developer machine.

3. **Leaves-to-root generation order** — Pre-comps must exist as files before the parent can reference them via `data-composition-src`. Building from leaves up ensures all dependencies are met.

4. **Approximate rather than skip** — When an AE effect has no direct equivalent, use the closest CSS/SVG/GSAP approximation. Only skip features that truly cannot be represented.

5. **All GSAP plugins available** — No restrictions on which plugins to use. Choose the best tool for each conversion.

6. **Complete project output** — The skill generates everything needed to preview immediately, not fragments that need manual assembly.

7. **Summary with approximation log** — The user needs to know what was approximated so they can manually adjust if the fidelity isn't sufficient.

8. **Graceful degradation** — The preprocessing script and AI both handle unknowns by logging warnings rather than failing. Unrecognized features are documented in the summary.
