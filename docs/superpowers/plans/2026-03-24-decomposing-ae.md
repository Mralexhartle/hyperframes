# Decomposing AE Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code skill that converts After Effects `.aepx` projects into complete HyperFrames composition projects.

**Architecture:** A Python preprocessing script (`parse-aepx.py`) converts binary-encoded `.aepx` XML into clean JSON. The SKILL.md guides the AI through a 6-phase workflow: preprocess, analyze, plan, generate comp-by-comp, assemble root, and summarize. Reference files provide AE→HyperFrames mapping tables and `.aepx` format documentation.

**Tech Stack:** Python 3 (stdlib only: xml.etree.ElementTree, struct, json), Claude Code skills (SKILL.md + reference .md files)

**Spec:** `docs/superpowers/specs/2026-03-24-decomposing-ae-design.md`

**Test fixture:** `/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx`

---

## File Structure

```
.claude/skills/decomposing-ae/
├── SKILL.md                  # Workflow, checklist, rules (~300 lines)
├── ae-mapping.md             # AE → HyperFrames mapping tables
├── aepx-structure.md         # .aepx XML format and binary decoding guide
├── scripts/
│   └── parse-aepx.py         # Preprocessor: .aepx → JSON (Python 3, zero deps)
└── examples/
    └── simple-title.md       # Worked input/output example
```

---

### Task 1: Scaffold the skill directory and script structure

**Files:**
- Create: `.claude/skills/decomposing-ae/SKILL.md` (stub)
- Create: `.claude/skills/decomposing-ae/ae-mapping.md` (stub)
- Create: `.claude/skills/decomposing-ae/aepx-structure.md` (stub)
- Create: `.claude/skills/decomposing-ae/scripts/parse-aepx.py` (with `main()` guard and `decode_tdmn`)
- Create: `.claude/skills/decomposing-ae/examples/simple-title.md` (stub)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p .claude/skills/decomposing-ae/scripts
mkdir -p .claude/skills/decomposing-ae/examples
```

- [ ] **Step 2: Create SKILL.md stub with frontmatter**

```markdown
---
name: decomposing-ae
description: Decomposes After Effects projects (.aepx files) into HyperFrames HTML compositions. Parses the AE project structure, maps layers/effects/keyframes to HTML/CSS/GSAP equivalents, and generates a complete ready-to-preview project. Use when converting AE templates, recreating motion graphics from After Effects, or porting AE animations to HyperFrames.
---

# Decomposing After Effects

TODO: Implement in Task 12.
```

- [ ] **Step 3: Create parse-aepx.py with main guard and tdmn decoder**

The script MUST use `if __name__ == "__main__"` so functions can be imported for testing without triggering `sys.argv` access.

```python
#!/usr/bin/env python3
"""Parse .aepx (After Effects XML) into clean JSON for HyperFrames decomposition."""
import json
import struct
import sys
import xml.etree.ElementTree as ET


def decode_tdmn(hex_str: str) -> str:
    """Decode hex-encoded ASCII tdmn match name, stripping null padding."""
    raw = bytes.fromhex(hex_str)
    return raw.split(b'\x00')[0].decode('ascii')


def main():
    if len(sys.argv) < 2:
        print("Usage: parse-aepx.py <path-to-aepx>", file=sys.stderr)
        sys.exit(1)
    # TODO: implement
    print(json.dumps({"folders": [], "compositions": {}, "footage": {}, "fonts": [], "warnings": []}))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Create empty stubs for ae-mapping.md, aepx-structure.md, examples/simple-title.md**

- [ ] **Step 5: Verify tdmn decode works**

```bash
python3 -c "
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('parse', '.claude/skills/decomposing-ae/scripts/parse-aepx.py')
mod = module_from_spec(spec)
spec.loader.exec_module(mod)
assert mod.decode_tdmn('4144424520416e63686f7220506f696e740000000000000000000000000000000000000000000000') == 'ADBE Anchor Point'
assert mod.decode_tdmn('41444245204f70616369747900000000000000000000000000000000000000000000000000000000') == 'ADBE Opacity'
print('PASS: tdmn decoding works')
"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/decomposing-ae/
git commit -m "feat: scaffold decomposing-ae skill with script structure and tdmn decoder"
```

---

### Task 2: Parse XML and walk folder/item tree

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py`

- [ ] **Step 1: Write test**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))
assert 'folders' in data
names = []
def collect(items):
    for item in items:
        names.append(item.get('name',''))
        collect(item.get('children',[]))
collect(data['folders'])
assert '01. Edit' in names, f'Missing 01. Edit in {names}'
assert '02. Final Comp' in names, f'Missing 02. Final Comp in {names}'
print('PASS: folder tree parsed')
"
```

Expected: FAIL (main() outputs empty folders)

- [ ] **Step 2: Implement XML parsing and folder tree walking**

- Parse with `ET.parse()`, handle xmlns namespace
- Find `<Fold>` root
- Walk `<Item>` elements: read `<string>` for name, `<Sfdr>` for children
- If has `<cdta>` → composition (store `<iide>` as id, name from `<string>`)
- Output JSON with populated `folders` array

- [ ] **Step 3: Run test — expected PASS**

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "feat(decomposing-ae): parse .aepx XML and walk folder/item tree"
```

---

### Task 3: Decode composition data (`<cdta>`)

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py`

- [ ] **Step 1: Write test**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))
comps = data.get('compositions', {})
assert len(comps) > 0, 'No compositions found'
for cid, comp in comps.items():
    assert 'width' in comp and comp['width'] > 0, f'Bad width in {cid}'
    assert 'height' in comp and comp['height'] > 0, f'Bad height in {cid}'
    assert 'frameRate' in comp, f'Missing frameRate in {cid}'
    assert 'duration' in comp and comp['duration'] > 0, f'Bad duration in {cid}'
    print(f'  {comp[\"name\"]}: {comp[\"width\"]}x{comp[\"height\"]} @ {comp[\"frameRate\"]}fps, {comp[\"duration\"]:.1f}s')
print('PASS: composition data decoded')
"
```

Expected: FAIL

- [ ] **Step 2: Implement `<cdta>` decoding**

Study hex bytes from the test fixture. Use `struct.unpack` to find width, height, frame rate, duration at their byte offsets. Empirically compare hex values against known properties (1920x1080, 25fps). Populate `compositions` dict.

- [ ] **Step 3: Run test — expected PASS**

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "feat(decomposing-ae): decode cdta composition data"
```

---

### Task 4: Decode layer metadata (`<ldta>`)

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py`

Extract layer name, type, in/out point, parent index, blend mode, and track matte type from `<Layr>` and `<ldta>`.

- [ ] **Step 1: Write test**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))
all_layers = []
for cid, comp in data['compositions'].items():
    for layer in comp.get('layers', []):
        assert 'name' in layer, 'Missing name'
        assert 'type' in layer, 'Missing type'
        assert 'inPoint' in layer, 'Missing inPoint'
        assert 'outPoint' in layer, 'Missing outPoint'
        assert 'index' in layer, 'Missing index'
        assert 'parentIndex' in layer or layer.get('parentIndex') is None, 'Missing parentIndex'
        assert 'blendMode' in layer, 'Missing blendMode'
        assert 'trackMatteType' in layer, 'Missing trackMatteType'
        all_layers.append(layer['name'])
assert 'modern promo' in all_layers, f'Missing expected layer. Found: {all_layers[:10]}'
assert 'THANKS FOR WATCHING' in all_layers, f'Missing expected layer'
print(f'PASS: {len(all_layers)} layers extracted')
"
```

Expected: FAIL

- [ ] **Step 2: Implement `<ldta>` decoding and layer extraction**

- Walk `<Layr>` children of each composition
- Decode `<ldta>` binary for: layer type flags, in point, out point, parent index, blend mode
- Read `<string>` sibling for layer name
- Determine layer type from flags (text, shape, solid, null, adjustment, camera, light, footage)
- Extract `trackMatteType` from ldta flags
- Build layer objects with: index, name, type, inPoint, outPoint, parentIndex, blendMode, trackMatteType

- [ ] **Step 3: Run test — expected PASS**

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "feat(decomposing-ae): decode layer metadata from ldta"
```

---

### Task 5: Extract transform properties and keyframes

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py`

Walk `<tdgp>` groups to find `ADBE Transform Group`, extract position, scale, rotation, opacity, anchor point — each with static value or keyframe array.

- [ ] **Step 1: Write test**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))
has_keyframes = False
for cid, comp in data['compositions'].items():
    for layer in comp.get('layers', []):
        t = layer.get('transform', {})
        assert 'position' in t, f'Missing position on {layer[\"name\"]}'
        assert 'scale' in t, f'Missing scale on {layer[\"name\"]}'
        assert 'opacity' in t, f'Missing opacity on {layer[\"name\"]}'
        assert 'anchorPoint' in t, f'Missing anchorPoint on {layer[\"name\"]}'
        # Check values are numbers
        pos = t['position'].get('value', [])
        if pos:
            assert all(isinstance(v, (int, float)) for v in pos), f'Bad position on {layer[\"name\"]}: {pos}'
        if t['position'].get('keyframes'):
            has_keyframes = True
assert has_keyframes, 'No keyframed transforms found (test fixture should have animated layers)'
print('PASS: transform properties and keyframes extracted')
"
```

Expected: FAIL

- [ ] **Step 2: Implement transform extraction**

- Find `ADBE Transform Group` via decoded `<tdmn>`
- For each child property (`ADBE Anchor Point`, `ADBE Position`/`_0`/`_1`/`_2`, `ADBE Scale`, `ADBE Rotate Z`, `ADBE Opacity`):
  - Decode `<tdb4>` for keyframe count
  - Decode `<cdat>` for values using `struct.unpack('>d', ...)`
  - If keyframe count > 0, build keyframes array with time, value, easing
  - If no keyframes, store static value

- [ ] **Step 3: Run test — expected PASS**

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "feat(decomposing-ae): extract transform properties and keyframes"
```

---

### Task 6: Extract text document data

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py`

For text layers, extract content, font family, font size, font color from `ADBE Text Properties` → `ADBE Text Document`.

- [ ] **Step 1: Write test**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))
found_text = False
for cid, comp in data['compositions'].items():
    for layer in comp.get('layers', []):
        if layer['type'] == 'text':
            assert layer.get('textContent'), f'Text layer missing content: {layer[\"name\"]}'
            found_text = True
            print(f'  Text: \"{layer[\"textContent\"]}\" font={layer.get(\"fontFamily\",\"?\")} size={layer.get(\"fontSize\",\"?\")}')
assert found_text, 'No text layers found'
# Check fonts collected at project level
fonts = data.get('fonts', [])
assert len(fonts) > 0, 'No fonts collected'
print(f'  Project fonts: {fonts}')
print('PASS: text data and fonts extracted')
"
```

Expected: FAIL

- [ ] **Step 2: Implement text document extraction**

- For text-type layers, find `ADBE Text Properties` → `ADBE Text Document`
- Decode text content from the binary data in `<cdat>` or the text document structure
- Extract font family, size, color
- Collect all unique font names into the project-level `fonts` array

- [ ] **Step 3: Run test — expected PASS**

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "feat(decomposing-ae): extract text document data and collect fonts"
```

---

### Task 7: Extract effects, masks, expressions, and footage

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py`

- [ ] **Step 1: Write test**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))

# Effects
has_effects = False
for cid, comp in data['compositions'].items():
    for layer in comp.get('layers', []):
        if layer.get('effects'):
            has_effects = True
            for eff in layer['effects']:
                assert 'name' in eff, 'Effect missing name'
                print(f'  Effect: {eff[\"name\"]} on {layer[\"name\"]}')
        # Masks
        assert 'masks' in layer, f'Missing masks key on {layer[\"name\"]}'
        # Expressions
        assert 'expression' in layer or layer.get('expression') is None, f'Missing expression key'
# The test fixture has Fill and Tint effects
assert has_effects, 'No effects found — test fixture should have Fill/Tint effects'

# Warnings
assert isinstance(data['warnings'], list), 'Missing warnings array'
print(f'  Warnings: {len(data[\"warnings\"])}')
print('PASS: effects, masks, expressions extracted')
"
```

Expected: FAIL

- [ ] **Step 2: Implement effect extraction**

Walk `ADBE Effect Parade` group. For each effect, extract match name and parameters.

- [ ] **Step 3: Implement mask extraction**

Walk `ADBE Mask Parade` group. Extract `ADBE Mask Shape` path data for each mask.

- [ ] **Step 4: Implement expression extraction**

For any `<tdbs>` property block that has a `<string>` child containing an AE expression (e.g., `comp("Render").layer(...)`), capture it and associate with the layer.

- [ ] **Step 5: Implement footage collection**

Identify `<Item>` elements that are footage (no `<cdta>`, have media source data). Extract name, type (video/image/audio), path.

- [ ] **Step 6: Run test — expected PASS**

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "feat(decomposing-ae): extract effects, masks, expressions, footage"
```

---

### Task 8: End-to-end validation of `parse-aepx.py`

**Files:**
- Modify: `.claude/skills/decomposing-ae/scripts/parse-aepx.py` (fixes only)

- [ ] **Step 1: Run full output and inspect**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" | python3 -m json.tool | head -100
```

- [ ] **Step 2: Run comprehensive validation**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-test.json
python3 -c "
import json
data = json.load(open('/tmp/ae-test.json'))

assert len(data['folders']) > 0
assert len(data['compositions']) > 0
assert isinstance(data['warnings'], list)
assert isinstance(data['fonts'], list)

all_names = []
for cid, comp in data['compositions'].items():
    for layer in comp.get('layers', []):
        all_names.append(layer['name'])

for expected in ['modern promo', 'clean design', 'THANKS FOR WATCHING']:
    assert expected in all_names, f'Missing: {expected}'

# Verify transforms have numeric values
for cid, comp in data['compositions'].items():
    for layer in comp.get('layers', []):
        t = layer.get('transform', {})
        if t.get('position') and t['position'].get('value'):
            assert all(isinstance(v, (int, float)) for v in t['position']['value'])

print(f'PASS: {len(data[\"compositions\"])} comps, {len(all_names)} layers, {len(data[\"fonts\"])} fonts, {len(data[\"warnings\"])} warnings')
"
```

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Commit if fixes needed**

```bash
git add .claude/skills/decomposing-ae/scripts/parse-aepx.py
git commit -m "fix(decomposing-ae): end-to-end validation fixes"
```

---

### Task 9: Write `aepx-structure.md`

**Files:**
- Modify: `.claude/skills/decomposing-ae/aepx-structure.md`

- [ ] **Step 1: Write the reference file**

Content from spec — "aepx-structure.md Content" section:
- Top-level XML structure (`<AfterEffectsProject>`, `<Fold>`, `<Item>`, `<Sfdr>`)
- Identifying item types (folder vs composition vs footage)
- Composition data (`<cdta>`) — what it contains
- Layer data (`<Layr>` + `<ldta>`) — structure and contents
- Property groups (`<tdgp>`) — `ADBE Transform Group`, `ADBE Text Properties`, `ADBE Effect Parade`, `ADBE Mask Parade`
- Property values (`<tdbs>`) — `<tdb4>`, `<cdat>`, expressions
- Hex decoding guide (tdmn ASCII, cdat IEEE 754 doubles, big-endian)
- Common folder conventions (`01. Edit`, `02. Final Comp`, `03. Others`)

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/decomposing-ae/aepx-structure.md
git commit -m "docs(decomposing-ae): add .aepx format reference"
```

---

### Task 10: Write `ae-mapping.md`

**Files:**
- Modify: `.claude/skills/decomposing-ae/ae-mapping.md`

- [ ] **Step 1: Write all mapping tables**

Content from spec — "ae-mapping.md Content" section:
- Layer types → HyperFrames equivalents
- Transform properties → GSAP/CSS
- Effects → CSS/SVG approximations (all 13 entries)
- Blend modes → `mix-blend-mode` (all 11 entries)
- Track mattes → CSS mask equivalents (all 4 entries)
- Easing presets → GSAP equivalents (5 entries + custom bezier)
- GSAP plugins reference (7 entries)
- **Coordinate system conversion** — include the full formula from the spec's "Coordinate System Conversion" section:
  ```
  CSS left = AE positionX - AE anchorPointX
  CSS top = AE positionY - AE anchorPointY
  CSS transform-origin = anchorPointX + "px " + anchorPointY + "px"
  ```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/decomposing-ae/ae-mapping.md
git commit -m "docs(decomposing-ae): add AE to HyperFrames mapping tables"
```

---

### Task 11: Write `examples/simple-title.md`

**Files:**
- Modify: `.claude/skills/decomposing-ae/examples/simple-title.md`

- [ ] **Step 1: Write worked example**

Show a simple 2-layer AE comp (solid background + text layer with opacity keyframes):
- JSON input snippet (as it would come from parse-aepx.py)
- Expected HyperFrames HTML output: `<template>` composition file with solid `<div>`, text `<div>`, scoped CSS, GSAP timeline with opacity tween
- Annotate each mapping decision inline

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/decomposing-ae/examples/simple-title.md
git commit -m "docs(decomposing-ae): add worked example"
```

---

### Task 12: Write `SKILL.md`

**Files:**
- Modify: `.claude/skills/decomposing-ae/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Structure (target under 500 lines):

1. **Frontmatter** — name: `decomposing-ae`, description from spec
2. **When to use** — trigger phrases: "convert AE template", "decompose After Effects", "port AE to HyperFrames", "recreate motion graphics"
3. **Prerequisites** — `.aepx` file, Python 3 installed
4. **Workflow checklist** — 6 phases with checkbox syntax:
   ```
   - [ ] Step 1: Preprocess .aepx (run parse-aepx.py)
   - [ ] Step 2: Analyze project structure
   - [ ] Step 3: Plan the mapping
   - [ ] Step 4: Generate compositions (leaves to root)
   - [ ] Step 5: Assemble root composition
   - [ ] Step 6: Verify and summarize
   ```
5. **Each step detailed** — from spec Steps 1-6
6. **Rules from compose-video** — enumerate explicitly:
   - Deterministic output (no Math.random, Date.now)
   - GSAP animation conflict avoidance
   - `data-duration` required on all compositions
   - `data-width`/`data-height` required on all compositions
   - `window.__timelines = window.__timelines || {}` before assigning
   - Videos `muted playsinline`, audio as separate `<audio>`
   - Every top-level container must have `data-composition-id`
   - CSS scoped with `[data-composition-id="<id>"]`
   - Template files use `<template id="<comp-id>-template">`
7. **Known limitations (v1)** — enumerate from spec:
   - Time remapping: not converted, pre-comps play at normal speed
   - Complex expressions: logged but not auto-converted
   - 3D camera: approximated with CSS perspective, no depth-of-field
   - Motion blur: not supported, can approximate with directional blur
8. **References** — links to ae-mapping.md, aepx-structure.md, examples/simple-title.md

- [ ] **Step 2: Verify line count**

```bash
wc -l .claude/skills/decomposing-ae/SKILL.md
```

Must be under 500 lines.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/decomposing-ae/SKILL.md
git commit -m "feat(decomposing-ae): write full skill instructions"
```

---

### Task 13: Integration test — full skill validation

**Files:**
- No new files; validation only

- [ ] **Step 1: Run parser against test fixture**

```bash
python3 .claude/skills/decomposing-ae/scripts/parse-aepx.py "/Users/vanceingalls/Downloads/Free_Modern_Fast_Promo_source_90309/After Effects/test.aepx" > /tmp/ae-full-test.json
```

- [ ] **Step 2: Verify JSON completeness**

```bash
python3 -c "
import json
data = json.load(open('/tmp/ae-full-test.json'))
print(f'Folders: {len(data[\"folders\"])}')
print(f'Compositions: {len(data[\"compositions\"])}')
print(f'Fonts: {data[\"fonts\"]}')
print(f'Warnings: {len(data[\"warnings\"])}')
for cid, comp in data['compositions'].items():
    layers = comp.get('layers', [])
    print(f'  {comp[\"name\"]}: {comp[\"width\"]}x{comp[\"height\"]}, {len(layers)} layers')
    for l in layers:
        kf_count = sum(1 for prop in l.get('transform',{}).values() if isinstance(prop, dict) and prop.get('keyframes'))
        extras = []
        if l.get('effects'): extras.append(f'{len(l[\"effects\"])} effects')
        if l.get('masks'): extras.append(f'{len(l[\"masks\"])} masks')
        if l.get('expression'): extras.append('has expression')
        extra_str = f' ({', '.join(extras)})' if extras else ''
        print(f'    [{l[\"type\"]}] {l[\"name\"]} ({l[\"inPoint\"]:.1f}-{l[\"outPoint\"]:.1f}s) {kf_count} animated props{extra_str}')
"
```

- [ ] **Step 3: Verify SKILL.md references resolve**

```bash
# All referenced files must exist
test -f .claude/skills/decomposing-ae/ae-mapping.md && echo "OK: ae-mapping.md" || echo "MISSING"
test -f .claude/skills/decomposing-ae/aepx-structure.md && echo "OK: aepx-structure.md" || echo "MISSING"
test -f .claude/skills/decomposing-ae/examples/simple-title.md && echo "OK: simple-title.md" || echo "MISSING"
test -f .claude/skills/decomposing-ae/scripts/parse-aepx.py && echo "OK: parse-aepx.py" || echo "MISSING"
```

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add .claude/skills/decomposing-ae/
git commit -m "feat(decomposing-ae): complete skill with parser, docs, and examples"
```
