# generate-hyperframes.py Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the HTML/GSAP code generator so it produces visually faithful reproductions of AE compositions that look correct in the HyperFrames studio.

**Architecture:** `generate-hyperframes.py` takes parsed `.aepx` JSON and outputs a single flat `index.html` with all layers and GSAP animations. The generator must solve: coordinate mapping, text sizing, visual contrast, layer stacking, and effect rendering.

**Tech Stack:** Python 3 (stdlib only), outputs HTML + CSS + GSAP

**Current state:** The pipeline works end-to-end — parser extracts data correctly, generator produces valid HTML with GSAP tweens at correct timings, studio plays the timeline. But the visual output is broken: layers overlap at (0,0), text is tiny, backgrounds are invisible dark-on-dark.

**Test fixture:** `/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx`

**Test command:**
```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py <aepx-file> > /tmp/ae-project.json
python3 .claude/skills/decomposing-ae/scripts/generate-hyperframes.py /tmp/ae-project.json examples/modern-fast-promo/index.html
```

---

## Problem Analysis

The test fixture is a "Modern Fast Promo" template (1920x1080, ~22s) with 4 scenes containing:
- 12 text compositions (sized to fit their text, e.g., 1574x128, 662x114)
- Shape layers with colored strokes
- Solid layers with Fill/Tint effects for color
- Photo/Video placeholder pre-comps
- Transitions

### Root causes of visual failure:

1. **Layer positioning**: AE layers use separated position axes (Position_0/1/2) which all resolve to 0 in the parser. The actual position comes from the pre-comp's placement within the parent comp, which is stored differently. Layers that ARE sub-compositions need to be positioned based on AE's comp-within-comp coordinate system, not the layer's transform.

2. **Text composition sizing**: Text comps have small dimensions (e.g., 662x114) because AE sizes them to fit the text. When rendered at those sizes in a 1920x1080 viewport, they're tiny. Text needs to be either scaled up or positioned as centered overlays.

3. **Solid/fill colors**: Many solid layers have Fill effects that set their color, but the generator reads `#111111` as default. The effect parameters contain the actual colors (e.g., from Color Control expressions referencing a palette) but they're stored as `[255, 255, 0, 0]` (RGBA 0-255) format rather than hex.

4. **Pre-comp layer sizing**: When a layer references a sub-composition (e.g., text_01 at 1574x128), the layer in the parent comp may have a different size. The layer should render at the parent comp's dimensions, not the source comp's dimensions.

5. **Z-ordering**: Elements within a scene all have `position:absolute` but no `z-index`. AE layer order (top=first in list) should map to z-index (first layer = highest z-index).

6. **Scene background**: Each scene needs a visible background. The AE template uses solid layers at the bottom of the layer stack as backgrounds, but these are colored via Fill effects.

---

### Task 1: Fix layer positioning — center text comps in parent viewport

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

Currently all text sub-comp layers render at `left:0; top:0` because their AE position is `[0,0,0]` (separated axes). For sub-composition layers (type=precomp referencing a text comp), the text should be centered in the parent composition viewport.

- [ ] **Step 1: Identify precomp layers that reference text compositions**

In `layer_to_html()`, when a layer is type "text" (inlined from a text precomp), check if the source comp dimensions are smaller than the parent comp. If so, center it: `left: (parent_w - source_w) / 2`, `top: (parent_h - source_h) / 2`.

- [ ] **Step 2: Implement centering logic**

```python
# For text layers inlined from sub-compositions
if ltype == "text" and w < comp.get("width", 1920) and h < comp.get("height", 1080):
    parent_w = comp.get("width", 1920) if comp.get("width", 0) > w else 1920
    parent_h = comp.get("height", 1080) if comp.get("height", 0) > h else 1080
    css_left = round((parent_w - w) / 2, 2)
    css_top = round((parent_h - h) / 2, 2)
```

- [ ] **Step 3: Test — text should be centered, not at top-left**

```bash
python3 .claude/skills/decomposing-ae/scripts/generate-hyperframes.py /tmp/ae-project.json /tmp/test.html
grep 'MODERN PROMO' /tmp/test.html  # should show left ~173px, not 0
```

- [ ] **Step 4: Commit**

---

### Task 2: Fix text sizing — scale font sizes for visibility

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

AE font sizes are in comp-local coordinates (27px in a 128px-tall comp). When rendered in a 1920x1080 viewport, this is tiny. Scale font sizes relative to the viewport.

- [ ] **Step 1: Calculate scaled font size**

```python
# Scale factor: source comp height → parent comp height
scale = parent_h / source_h  # e.g., 1080/128 = 8.4x
scaled_size = min(font_size * scale * 0.6, 120)  # cap at 120px, 0.6 factor for aesthetics
```

- [ ] **Step 2: Apply to all text layers**

In `layer_to_html()`, when rendering text content, use the scaled font size instead of the raw AE value.

- [ ] **Step 3: Test — text should be readable**

- [ ] **Step 4: Commit**

---

### Task 3: Fix solid layer colors — extract from Fill effect parameters

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

Solid layers default to `#111111` but many have Fill effects with color data. The effect params contain color as `[R, G, B, A]` in 0-255 range. Some have expressions referencing Color Control — these should use a default palette.

- [ ] **Step 1: Improve color extraction from effects**

The current code has a params iteration but it's fragile. Improve:

```python
def extract_fill_color(effects: list) -> str | None:
    for eff in effects:
        name = (eff.get("displayName") or eff.get("name", "")).lower()
        if "fill" not in name and "tint" not in name:
            continue
        params = eff.get("params", [])
        if isinstance(params, list):
            for p in params:
                val = p.get("value") if isinstance(p, dict) else p
                if isinstance(val, list) and len(val) >= 3:
                    r, g, b = int(val[0]), int(val[1]), int(val[2])
                    if r + g + b > 10:  # skip near-black
                        return f"#{r:02x}{g:02x}{b:02x}"
    return None
```

- [ ] **Step 2: Apply to solid and shape layers**

- [ ] **Step 3: Test — solid backgrounds should show colors from Fill effects**

- [ ] **Step 4: Commit**

---

### Task 4: Fix z-ordering — AE layer order to CSS z-index

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

AE layer order: first in list = top (highest visual priority). CSS: higher z-index = on top.

- [ ] **Step 1: Calculate z-index from layer position**

In `layer_to_html()`:
```python
# AE: layer_idx 0 = top, so invert for z-index
total_layers = len(comp.get("layers", []))
z_index = total_layers - layer_idx
style_parts.append(f"z-index:{z_index}")
```

- [ ] **Step 2: Also add z-index to scene containers**

Scenes should stack with later scenes on top.

- [ ] **Step 3: Test — shapes and text should appear above backgrounds**

- [ ] **Step 4: Commit**

---

### Task 5: Fix pre-comp sizing — render at parent viewport dimensions

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

When a layer references a sub-composition (text comp, photo placeholder), the generator uses the source comp's dimensions (e.g., 1574x128 for text_01). But in the AE project, these layers render at the parent comp's viewport size (1920x1080) with the content centered or scaled.

- [ ] **Step 1: For precomp layers, use parent comp dimensions**

When type is "precomp" (not inlined as text), render at `width: parent_w; height: parent_h` instead of the source comp's dimensions.

- [ ] **Step 2: For photo/video placeholders, make them visually distinct**

Use a medium dark background (#222) with a visible border and centered label text at readable size.

- [ ] **Step 3: Test — precomp layers should fill their scene's viewport**

- [ ] **Step 4: Commit**

---

### Task 6: Add scene backgrounds — use the bottom solid layer's color

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

Each AE scene has a solid layer at the bottom of the stack (last in layer list) that serves as the background. Currently these render as `#111111` (default) or dark placeholders. They should pick up the Fill effect color.

- [ ] **Step 1: For each scene, identify the background layer**

The last solid layer in the layer list (highest index) is typically the background. Extract its Fill color.

- [ ] **Step 2: Set the scene container's background**

Apply the extracted color to the scene `<div>` container's `background` style.

- [ ] **Step 3: Fallback to a visible dark but not black color**

If no color is found, use `#1a1a1a` instead of `#111111` so elements are at least slightly distinguishable.

- [ ] **Step 4: Test — scenes should have colored or visible backgrounds**

- [ ] **Step 5: Commit**

---

### Task 7: Fix shape layer rendering — use stroke data from parser

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

Shape layers have stroke colors/widths extracted by the parser. The current generator applies some of them but defaults to `border:2px solid #ffffff` for many. Use the actual stroke data.

- [ ] **Step 1: Improve shape rendering logic**

```python
if ltype == "shape":
    shapes = layer.get("shapeGroups", [])
    stroke_color = "#ffffff"
    stroke_width = 2
    has_fill = False
    for sg in shapes:
        if sg.get("stroke"):
            sc = sg["stroke"].get("color", [])
            if isinstance(sc, list) and len(sc) >= 3:
                stroke_color = f"#{int(sc[0]):02x}{int(sc[1]):02x}{int(sc[2]):02x}"
            sw = sg["stroke"].get("width", 2)
            if isinstance(sw, (int, float)):
                stroke_width = max(1, int(sw))
        if sg.get("fill"):
            has_fill = True

    style_parts.append(f"border:{stroke_width}px solid {stroke_color}")
    style_parts.append("background:transparent")
```

- [ ] **Step 2: Also extract fill colors from Fill effects on shape layers**

Many shape layers have `ADBE Fill` effects that override the shape's own fill.

- [ ] **Step 3: Test — shapes should show correct colors from AE**

- [ ] **Step 4: Commit**

---

### Task 8: Fix keyframe time offsets for nested scenes

**File:** `.claude/skills/decomposing-ae/scripts/generate-hyperframes.py`

Keyframe times are currently local to the layer (0-based within the layer's own duration). They need to be offset by the scene start time when placed in the root timeline. The current regex-based offset in the generator is fragile.

- [ ] **Step 1: Pass scene_start into layer_to_html**

Add `parent_start` parameter to `layer_to_html()`. Add it to all keyframe time values directly in `generate_keyframe_tweens()`.

- [ ] **Step 2: Also offset the visibility show/hide times**

The `tl.set(visibility)` calls already use `in_pt` which is local. Add `parent_start` to these.

- [ ] **Step 3: Remove the regex-based time offset hack**

Replace the `re.sub` offset with clean arithmetic passed through function parameters.

- [ ] **Step 4: Test — animations should appear at correct absolute times**

- [ ] **Step 5: Commit**

---

### Task 9: End-to-end validation

- [ ] **Step 1: Regenerate from test fixture**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-project.json
python3 .claude/skills/decomposing-ae/scripts/generate-hyperframes.py /tmp/ae-project.json examples/modern-fast-promo/index.html
```

- [ ] **Step 2: Verify in studio**

- Scene backgrounds should be visible (not all #111)
- Text should be centered and readable
- Shapes should show AE colors
- Animations should play at correct times
- Layer stacking should match AE (backgrounds behind, text on top)
- Timeline should show all 84 elements

- [ ] **Step 3: Commit final output**

- [ ] **Step 4: Update SKILL.md with two-script architecture**

Update the decomposing-ae skill to document:
```
Step 1: python3 parse-aepx.py input.aepx > project.json
Step 2: python3 generate-hyperframes.py project.json > index.html
Step 3: Review output, refine effects/shapes that need creative judgment
```

- [ ] **Step 5: Commit skill docs update**
