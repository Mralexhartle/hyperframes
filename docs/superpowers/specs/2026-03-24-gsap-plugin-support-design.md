# GSAP Plugin Support for HyperFrames

**Date:** 2026-03-24
**Status:** Draft
**Branch:** `feat/gsap-plugin-support` (worktree off `main`)

## Problem

HyperFrames documents and skills reference GSAP plugins (CustomEase, SplitText, MotionPathPlugin, etc.) but the core framework has zero plugin support. The parser filters out plugin properties, the HTML parser warns on plugin CDN scripts, and the linter can't validate plugin usage. Compositions using plugins work at runtime (GSAP loads them fine) but the framework is blind to them — it can't validate correctness, catch missing CDNs, or recognize plugin-specific properties.

## Scope

### In scope
- 7 video-relevant plugins: CustomEase, SplitText, MotionPathPlugin, MorphSVGPlugin, DrawSVGPlugin, CustomBounce, CustomWiggle
- Plugin registry as single source of truth
- Parser property allowlist expansion
- HTML parser multi-script CDN validation
- Linter plugin-specific validation patterns
- Exports from `@hyperframes/core`
- Tests for all changes

### Out of scope
- Interactive/scroll plugins (ScrollTrigger, Draggable, Observer, Flip, Inertia)
- Round-trip serialization of plugin code (option C) — not needed since LLM authoring doesn't go through the parse→serialize pipeline
- Skill updates (decomposing-ae, composing-video) — done after rebase in follow-up
- Visual editor support — deferred; if built, would use structured data as source of truth, not parser round-trip

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plugin set | 7 video-relevant plugins | Scroll/drag/interactive plugins don't apply to rendered video |
| Support depth | B (Aware) | Validate and recognize, don't round-trip serialize. LLM editing doesn't go through parser pipeline; generator builds fresh scripts from keyframes |
| Property handling | Expand allowlist | Add plugin + CSS properties to `SUPPORTED_PROPS`. Keeps allowlist approach (vs. removing filter) for data model clarity |
| Architecture | Plugin Registry | Single source of truth in `gsapPlugins.ts`, consumed by parser/linter/HTML parser. Avoids scattering plugin knowledge across files |
| Skill updates | Separate follow-up | Core framework ships first; skill branches rebase onto it |

## Architecture

### Plugin Registry (`gsapPlugins.ts`)

New file at `packages/core/src/parsers/gsapPlugins.ts`.

```ts
interface GsapPluginDef {
  name: string;                    // "CustomEase"
  cdnPaths: string[];              // ["CustomEase.min.js", "CustomEase.js"]
  registerCall: string;            // "gsap.registerPlugin(CustomEase)"
  properties: string[];            // tween props this plugin adds
  usagePatterns: RegExp[];         // patterns that indicate this plugin is in use (detection, not validation)
  forbiddenPatterns?: Array<{      // plugin-specific forbidden patterns
    pattern: RegExp;
    message: string;
  }>;
}
```

> **Note on `usagePatterns` vs validation**: The `usagePatterns` field detects plugin usage in raw script text (e.g., `/CustomEase\.create\s*\(/` for CustomEase). Actual structural validation (arg count, value types) lives in linter code, not in the registry, because validation logic is too complex for simple regex patterns.

Registry entries:

| Plugin | CDN paths | Properties added |
|--------|-----------|-----------------|
| CustomEase | `CustomEase.min.js`, `CustomEase.js` | *(none — adds custom easing functions)* |
| SplitText | `SplitText.min.js`, `SplitText.js` | *(none — creates instances for targeting)* |
| MotionPathPlugin | `MotionPathPlugin.min.js`, `MotionPathPlugin.js` | `motionPath` |
| MorphSVGPlugin | `MorphSVGPlugin.min.js`, `MorphSVGPlugin.js` | `morphSVG` |
| DrawSVGPlugin | `DrawSVGPlugin.min.js`, `DrawSVGPlugin.js` | `drawSVG` |
| CustomBounce | `CustomBounce.min.js`, `CustomBounce.js` | *(none — adds custom bounce easing)* |
| CustomWiggle | `CustomWiggle.min.js`, `CustomWiggle.js` | *(none — adds custom wiggle easing)* |

> **Note on premium plugins**: SplitText, MorphSVGPlugin, DrawSVGPlugin, CustomEase, CustomBounce, and CustomWiggle are GSAP Club/Business plugins. Their CDN hosts vary (jsdelivr, cdnjs, gsap.com, CodePen trial URLs, self-hosted paths). Suffix matching by filename intentionally handles all of these — the validator checks the filename, not the host.

Exported helpers:
- `GSAP_PLUGINS`: the full registry array
- `ALL_PLUGIN_PROPERTIES`: flat `Set<string>` of all properties introduced by plugins
- `ALL_PLUGIN_CDN_PATHS`: `Set<string>` of valid CDN filename suffixes (both `.min.js` and `.js` variants)
- `getPluginForProperty(prop: string): GsapPluginDef | undefined`: lookup which plugin a property belongs to

### Changes to `gsapParser.ts`

**`SUPPORTED_PROPS` expansion** — convert from array to `Set<string>` for O(1) lookup (currently uses `.includes()` at 3 call sites). Merge existing list with plugin properties and common CSS-animatable properties:

```ts
// Existing
"opacity", "visibility", "x", "y", "scale", "scaleX", "scaleY",
"rotation", "autoAlpha", "width", "height",

// Transform
"rotationX", "rotationY", "rotationZ", "skewX", "skewY",
"xPercent", "yPercent", "transformOrigin",

// CSS visual
"color", "backgroundColor", "borderColor", "borderRadius",
"borderWidth", "fontSize", "letterSpacing", "lineHeight",
"clipPath", "backgroundPosition",

// Plugin properties (linter-only — see note below)
"motionPath", "morphSVG", "drawSVG",
```

> **Important: plugin properties in `SUPPORTED_PROPS` are for linter/validation only.** The parser's `parseObjectLiteral` regex only matches scalar values (strings, numbers, identifiers). Plugin properties like `motionPath` take object values (e.g., `motionPath: { path: "#p", align: "#p" }`), so they will pass the allowlist filter but their values won't be captured in `GsapAnimation.properties`. This is acceptable at Aware depth — the allowlist expansion benefits the **linter** (which validates raw text via regex) and the **CDN cross-validator**, not the parser's structured output. Similarly, `gsapAnimationsToKeyframes` filters by `SUPPORTED_PROPS` AND `typeof value === "number"`, so non-numeric plugin property values won't appear in keyframe output regardless.

**`SUPPORTED_EASES` expansion** — custom eases registered via `CustomEase.create("name", ...)` are referenced by name. The validator accepts any ease string that either matches the built-in list OR matches a `CustomEase.create` call earlier in the script.

**No changes to parse or serialize logic** — consistent with Aware (B) depth. The parser still only handles `tl.to/from/fromTo/set`. Plugin setup code (`registerPlugin`, `CustomEase.create`, `new SplitText(...)`) passes through unmodified.

### Changes to `htmlParser.ts`

All new validation logic goes in `validateCompositionHtml()` (not `parseHtml()`). The parse function is called during normal editing workflows and should not emit warnings; validation is called explicitly.

**Multi-script tag validation** — replace the current `scripts.length > 2` warning with plugin-aware logic:

- Classify each `<script>` tag: GSAP core CDN, plugin CDN (matched against `ALL_PLUGIN_CDN_PATHS`), inline script, or unknown external
- Valid composition: 1 GSAP core CDN + 0-N plugin CDNs + 1 inline script
- Warn on unrecognized external scripts
- Error on duplicate plugin CDN includes

**CDN ordering validation** — GSAP core must appear before plugin CDNs, plugin CDNs must appear before the inline script. GSAP requires plugins loaded after core but registered before use.

**CDN version mismatch detection** — extract version strings from CDN URLs where possible (e.g., `gsap@3.12.5` from jsdelivr patterns). Warn if plugin CDN version differs from core CDN version, since GSAP plugins must match core version.

**`registerPlugin` cross-validation**:
- Warn if a plugin CDN is included but `gsap.registerPlugin(PluginName)` is never called (dead code)
- **Warn** (not error) if `registerPlugin` references a plugin whose CDN isn't included — this may be valid in self-hosted or bundled setups where the plugin is loaded through a non-CDN mechanism

### Changes to `hyperframeLinter.ts`

**Plugin-specific validation** — new checks driven by the registry's `validationPatterns`:

- `CustomEase.create()` — verify 2 args (name string, SVG path string). Warn if name shadows a built-in ease.
- `new SplitText()` — verify target is a valid CSS selector. Warn if used without SplitText CDN.
- `motionPath` property — verify value is an object with `path` or `values` key.
- `morphSVG` property — verify value is a selector string or shape data.
- `drawSVG` property — verify value is a string (e.g., `"0% 100%"`) or boolean.

**CDN-usage cross-validation** — if the inline script uses a plugin property (e.g., `motionPath`) but no corresponding plugin CDN `<script>` is present, emit error: "motionPath requires MotionPathPlugin — include its CDN script".

**No changes to existing forbidden patterns** — determinism rules (no callbacks, no random, no setTimeout) apply regardless of plugins.

> **Note on `onUpdate` tension**: The existing `FORBIDDEN_GSAP_PATTERNS` blocks `onUpdate:` callbacks, but `serializeGsapAnimations` with `includeMediaSync: true` generates an `eventCallback("onUpdate", ...)` call. This is a pre-existing inconsistency not introduced by this work. The linter validates raw script text from compositions, not generated output, so it doesn't fire on the generator's output. However, if the new cross-validation touches generated scripts in the future, this tension must be resolved (likely by exempting `eventCallback` from the `onUpdate` pattern, since it's a different API than the `onUpdate:` tween callback).

### Exports from `@hyperframes/core`

Add to `index.ts`:
- `GSAP_PLUGINS`
- `ALL_PLUGIN_PROPERTIES`
- `getPluginForProperty`
- `GsapPluginDef` (type export)

### Files unchanged

- `adapters/gsap.ts` — frame seeking is plugin-agnostic
- `runtime/init.ts`, `runtime/player.ts` — runtime doesn't care about plugins
- `generators/hyperframes.ts` — builds from keyframe data, no plugin awareness needed yet. Note: the generator currently emits a single `<script src="${GSAP_CDN}">` tag. If the generator needs to emit plugin-based compositions in the future, it will need to add plugin CDN tags. This is out of scope for this work.
- `.claude/skills/decomposing-ae/` — updated in follow-up after rebase
- `.claude/skills/composing-video/` — updated in follow-up after rebase

## Testing

| Test file | Coverage |
|-----------|----------|
| `gsapPlugins.test.ts` (new) | Registry lookups, property-to-plugin mapping, CDN path set (both `.min.js` and `.js` variants), helper functions |
| `gsapParser.test.ts` | New scalar props pass allowlist (`rotationX`, `backgroundColor`, etc.), plugin object-value props pass allowlist but yield undefined in parsed output (documenting the Aware limitation), custom ease names accepted |
| `htmlParser.test.ts` | Valid multi-script compositions pass, missing CDN errors, unrecognized CDN warnings, duplicate CDN errors, script ordering (core before plugins before inline), version mismatch warnings, self-hosted plugin paths matched by suffix |
| `hyperframeLinter.test.ts` | Plugin usage without CDN errors, `CustomEase.create` validation, `SplitText` validation, property-CDN cross-validation, existing `FORBIDDEN_GSAP_PATTERNS` still fire when plugins are present, `registerPlugin` without CDN warns (not errors) |

## Risks

- **GSAP CDN URL format changes** — CDN paths are pattern-matched by filename suffix, not exact URLs. Handles different CDN hosts (jsdelivr, cdnjs, gsap.com) and self-hosted paths.
- **Plugin API changes in future GSAP versions** — validation patterns are intentionally loose (Aware depth). They catch structural errors, not API version mismatches.
- **Custom easing name collisions** — warning only, not an error. Users may intentionally override built-in eases.
- **Core/plugin version mismatches** — GSAP plugins must match core version. CDN version detection is best-effort (works for jsdelivr-style versioned URLs, not for self-hosted). Warning only.
- **Plugin properties with object values** — `motionPath`, `morphSVG` take object values that the parser's `parseObjectLiteral` regex can't capture. These properties are in the allowlist for linter/validation benefit only; they will not appear in `GsapAnimation.properties` structured output. This is an accepted limitation of Aware depth.
