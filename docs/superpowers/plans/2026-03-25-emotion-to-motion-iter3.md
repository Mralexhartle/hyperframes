# Emotion-to-Motion Iteration 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-scene choreography phases, mood transitions, and intra-scene choreography patterns to the emotion-to-motion skill, then evaluate with 30-60s compositions.

**Architecture:** The existing SKILL.md gets three new sections appended (phases, transition matrix, intra-scene choreography). A new evals.json replaces the old one with 2 multi-scene test cases. A/B compositions (with_skill vs without_skill) are generated, deployed to HyperFrames Studio, and graded against 8 criteria.

**Tech Stack:** GSAP 3.14.2 (CustomEase, SplitText, CustomBounce, CustomWiggle), HyperFrames composition format, HyperFrames Studio for preview

**Spec:** `docs/superpowers/specs/2026-03-25-emotion-to-motion-iter3-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `~/.claude/skills/emotion-to-motion/SKILL.md` | Add 3 new sections after existing mood recipes |
| Modify | `~/.claude/skills/emotion-to-motion/evals/evals.json` | Replace with 2 multi-scene test cases |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/eval_metadata.json` | Test case 1 metadata |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/outputs/index.html` | Test case 1 with-skill composition |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/outputs/grading.json` | Test case 1 with-skill grading |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/timing.json` | Test case 1 with-skill token/time metrics |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/outputs/index.html` | Test case 1 without-skill composition |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/outputs/grading.json` | Test case 1 without-skill grading |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/timing.json` | Test case 1 without-skill token/time metrics |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/eval_metadata.json` | Test case 2 metadata |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/outputs/index.html` | Test case 2 with-skill composition |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/outputs/grading.json` | Test case 2 with-skill grading |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/timing.json` | Test case 2 with-skill token/time metrics |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/outputs/index.html` | Test case 2 without-skill composition |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/outputs/grading.json` | Test case 2 without-skill grading |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/timing.json` | Test case 2 without-skill token/time metrics |
| Create | `~/.claude/skills/emotion-to-motion-workspace/iteration-3/benchmark.json` | Aggregate scores across both test cases |
| Create | `packages/studio/data/projects/high-contrast-arc-with-skill/index.html` | Studio preview for case 1 with-skill |
| Create | `packages/studio/data/projects/high-contrast-arc-without-skill/index.html` | Studio preview for case 1 without-skill |
| Create | `packages/studio/data/projects/gradual-escalation-with-skill/index.html` | Studio preview for case 2 with-skill |
| Create | `packages/studio/data/projects/gradual-escalation-without-skill/index.html` | Studio preview for case 2 without-skill |

---

### Task 1: Update SKILL.md — Add Choreography Phases Section

**Files:**
- Modify: `~/.claude/skills/emotion-to-motion/SKILL.md` (append after line 269, after the "Punchy / Bold" recipe)

- [ ] **Step 1: Read the existing SKILL.md to confirm current end**

Read `~/.claude/skills/emotion-to-motion/SKILL.md` — verify it ends at line 269 with the Punchy/Bold recipe and there's no existing multi-scene content.

- [ ] **Step 2: Append the Choreography Phases section**

Add the following after the last line of SKILL.md:

```markdown

## Multi-Scene Compositions: Choreography Phases

For compositions longer than 15 seconds or with multiple moods, decompose the prompt into **phases** — ordered segments, each with its own mood and choreography.

### Phase Structure

Each phase has:
- **Mood** — one canonical mood (dramatic, playful, elegant, energetic, calm, tense, punchy)
- **Duration** — seconds in the master timeline
- **Content** — what's visually happening
- **Entrance → Emphasis → Exit** — choreography pattern (see Intra-Scene Choreography below)

### Mood Synonym Resolution

Resolve evocative language to canonical moods before decomposing:

| Synonym | Canonical Mood |
|---------|---------------|
| explosive, intense, fierce | punchy |
| serene, peaceful, tranquil | calm |
| triumphant, victorious, celebratory | playful |
| suspenseful, ominous, creeping | tense |
| luxurious, refined, sophisticated | elegant |
| exciting, dynamic, high-energy | energetic |
| cinematic, epic, grand | dramatic |

### Phase Decomposition

Handle two input styles:

**Explicit per-scene moods** — extract mood (resolving synonyms), duration, and content directly:
> "Scene 1 (tense, 15s): text fragments drift. Scene 2 (punchy, 10s): title shatters. Scene 3 (calm, 20s): debris floats."

**Arc-based descriptions** — decompose into phases:
> "Build from quiet unease to cathartic release to calm aftermath"

1. Map mood anchors: quiet unease → tense, cathartic release → dramatic, calm aftermath → calm
2. Allocate durations by weight:

| Mood | Weight |
|------|--------|
| calm, elegant | 1.2 |
| dramatic, tense | 1.0 |
| energetic, playful | 0.9 |
| punchy | 0.7 |

Formula: `phase_duration = (weight / sum_of_all_weights) * target_total`, rounded to nearest second.

**Minimum phase duration:** 6s — clamp and redistribute from the longest phase.

Expect 3-5 phases for 30-60s compositions. Allow up to 7 if the prompt explicitly calls for more.

### Edge Cases

- **Single mood for 30-60s:** One phase, no transitions. Apply entrance/emphasis/exit across the full duration.
- **Adjacent same-mood phases:** Merge unless content descriptions feature different primary subjects (e.g., "product close-up" vs "lifestyle scene"). If kept separate, use a soft transition.
- **More than 7 phases:** Consolidate phases with similar moods.
```

- [ ] **Step 3: Verify the append**

Read `~/.claude/skills/emotion-to-motion/SKILL.md` from line 269 onward — confirm the Choreography Phases section is present and correctly formatted.

- [ ] **Step 4: Commit**

```bash
cd ~/.claude/skills/emotion-to-motion && git add SKILL.md && git commit -m "feat(skill): add choreography phases section for multi-scene compositions"
```

(If not a git repo, skip commit — this is a local skill file.)

---

### Task 2: Update SKILL.md — Add Transition Matrix Section

**Files:**
- Modify: `~/.claude/skills/emotion-to-motion/SKILL.md` (append after Choreography Phases section)

- [ ] **Step 1: Append the Transition Matrix section**

Add immediately after the Edge Cases subsection:

```markdown

## Transition Matrix

Transitions between phases are inferred from the mood delta. Three categories:

### Hard Transitions (high contrast)
- **Overlap:** 0.3-0.8s
- **Technique:** Scene N's elements snap out (opacity: 0, scale: 0.95) while Scene N+1's elements slam in simultaneously
- **GSAP pattern:**
```js
// Phase N exit — hard snap out
phaseTl.to(".phase-n-elements", { opacity: 0, scale: 0.95, duration: 0.3, ease: "power3.in" }, exitStart);
// Phase N+1 entrance — slam in (overlaps exit by 0.3-0.8s)
nextPhaseTl.from(".phase-n1-elements", { opacity: 0, scale: 1.1, duration: 0.4, ease: "power4.out" }, 0);
```

### Soft Transitions (low contrast)
- **Overlap:** 1.5-3s
- **Technique:** Scene N's elements slowly fade/drift out while Scene N+1's elements gradually emerge underneath
- **GSAP pattern:**
```js
// Phase N exit — slow fade out
phaseTl.to(".phase-n-elements", { opacity: 0, y: -20, duration: 2, ease: "sine.inOut" }, exitStart);
// Phase N+1 entrance — fade in underneath (overlaps by 1.5-3s)
nextPhaseTl.from(".phase-n1-elements", { opacity: 0, y: 20, duration: 2, ease: "sine.inOut" }, 0);
```

### Escalation Transitions (building intensity)
- **Overlap:** 0.8-1.5s
- **Technique:** Scene N's elements accelerate their exit, Scene N+1's entrance inherits that momentum
- **GSAP pattern:**
```js
// Phase N exit — accelerating out
phaseTl.to(".phase-n-elements", { opacity: 0, x: -100, duration: 0.8, ease: "power3.in" }, exitStart);
// Phase N+1 entrance — momentum carry (overlaps by 0.8-1.5s)
nextPhaseTl.from(".phase-n1-elements", { opacity: 0, x: 100, duration: 0.6, ease: "power3.out" }, 0);
```

### Lookup Table

| From ↓ To → | dramatic | playful | elegant | energetic | calm | tense | punchy |
|-------------|----------|---------|---------|-----------|------|-------|--------|
| dramatic | soft | hard | soft | escalation | soft | soft | hard |
| playful | hard | soft | hard | soft | hard | hard | hard |
| elegant | soft | hard | soft | escalation | soft | escalation | hard |
| energetic | hard | soft | hard | soft | hard | hard | hard |
| calm | escalation | hard | soft | escalation | soft | escalation | hard |
| tense | escalation | hard | soft | escalation | soft | soft | hard |
| punchy | hard | soft | hard | hard | hard | hard | soft |

**Rationale for non-obvious entries:**
- playful→punchy = hard: flowing → staccato, a cut emphasizes the shift
- energetic→punchy = hard: sustained → staccato, textural change needs a cut
- tense→elegant = soft: both share restraint, low contrast
- punchy→energetic = hard: staccato → sustained, fundamental rhythm change

**Overlap budget constraint:** Transition overlap is drawn from the exit of phase N and entrance of phase N+1 (not additional time). If combined overlap on both sides of a phase exceeds 50% of its entrance + exit allocation, clamp to 50%.
```

- [ ] **Step 2: Verify the append**

Read the SKILL.md from the "## Transition Matrix" heading — confirm all subsections are present and the lookup table renders correctly.

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/skills/emotion-to-motion && git add SKILL.md && git commit -m "feat(skill): add transition matrix for multi-scene mood transitions"
```

---

### Task 3: Update SKILL.md — Add Intra-Scene Choreography Section

**Files:**
- Modify: `~/.claude/skills/emotion-to-motion/SKILL.md` (append after Transition Matrix section)

- [ ] **Step 1: Append the Intra-Scene Choreography section**

Add immediately after the Transition Matrix section:

```markdown

## Intra-Scene Choreography

Each phase has three acts: **entrance**, **emphasis**, and **exit**. The mood determines the default pattern for each.

### Act Duration Proportions

| Mood | Entrance | Emphasis | Exit |
|------|----------|----------|------|
| dramatic | 25% | 55% | 20% |
| playful | 20% | 60% | 20% |
| elegant | 20% | 65% | 15% |
| energetic | 15% | 65% | 20% |
| calm | 20% | 65% | 15% |
| tense | 25% | 50% | 25% |
| punchy | 15% | 60% | 25% |

### Entrance Patterns

**Cascade** (energetic, playful): Rapid staggered entrances, 0.05-0.1s gaps between elements.
```js
tl.from(".phase-elements", {
  opacity: 0, y: 30, scale: 0.9,
  duration: 0.4, ease: "back.out(1.7)",
  stagger: { each: 0.07, from: "center" }  // playful: from center; energetic: from start
}, entranceStart);
```

**Slow reveal** (dramatic, tense): Elements emerge one at a time with long pauses between.
```js
elements.forEach((el, i) => {
  tl.from(el, {
    opacity: 0, y: 15, duration: 0.8, ease: "power2.out"
  }, entranceStart + i * 1.2);  // 1.2s between each — builds anticipation
});
```

**Ensemble** (elegant, calm): Elements fade in together or in 2-3 groups.
```js
tl.from(".phase-elements-group1", {
  opacity: 0, y: 10, duration: 1.2, ease: "sine.inOut"
}, entranceStart);
tl.from(".phase-elements-group2", {
  opacity: 0, y: 10, duration: 1.2, ease: "sine.inOut"
}, entranceStart + 0.4);  // slight offset, but feels unified
```

**Impact** (punchy): Hero element hits first and hard, supporting elements follow in quick succession.
```js
tl.from("#hero", {
  opacity: 0, scale: 1.3, duration: 0.15, ease: "power4.out"
}, entranceStart);
tl.from(".supporting", {
  opacity: 0, y: 20, duration: 0.2, ease: "power3.out",
  stagger: 0.04
}, entranceStart + 0.1);
```

### Emphasis Patterns

**Pulse** (energetic, punchy): Subtle scale or brightness oscillation on key elements.
```js
tl.to("#hero", {
  scale: 1.02, duration: 0.4, ease: "sine.inOut",
  repeat: -1, yoyo: true
}, emphasisStart);
// Note: use repeat count based on emphasis duration, not -1, in compositions
```

**Drift** (calm, elegant): Slow continuous motion — gentle float, rotation, or parallax shift.
```js
tl.to(".bg-element", { y: -15, duration: emphasisDuration, ease: "sine.inOut" }, emphasisStart);
tl.to(".mid-element", { y: -8, rotation: 0.5, duration: emphasisDuration, ease: "sine.inOut" }, emphasisStart);
```

**Tension hold** (tense, dramatic): Near-stillness with micro-tremor on one element.
```js
gsap.registerPlugin(CustomWiggle);
CustomWiggle.create("microTremor", { wiggles: 12, type: "uniform" });
tl.to("#tension-element", {
  x: 2, ease: "microTremor", duration: emphasisDuration
}, emphasisStart);
```

**Play** (playful): Secondary action — idle wobbles, bounces, rotation on supporting elements.
```js
gsap.registerPlugin(CustomWiggle);
CustomWiggle.create("wobble", { wiggles: 4, type: "easeOut" });
tl.to(".supporting", {
  rotation: 3, ease: "wobble", duration: 1.5,
  stagger: { each: 0.3, repeat: -1 }
}, emphasisStart);
// Floating idle on decorative elements
tl.to(".decorative", {
  y: -8, duration: 1.2, ease: "sine.inOut",
  yoyo: true, repeat: -1
}, emphasisStart);
```

### Exit Patterns

**Scatter** (playful, energetic): Elements exit in different directions with stagger.
```js
tl.to(".phase-elements", {
  opacity: 0, x: "random(-100,100)", y: "random(-80,80)",
  rotation: "random(-15,15)", duration: 0.5, ease: "power2.in",
  stagger: 0.05
}, exitStart);
```

**Fade recede** (calm, elegant): Opacity + slight scale down, elements sink back.
```js
tl.to(".phase-elements", {
  opacity: 0, scale: 0.95, y: 10,
  duration: 1.2, ease: "sine.inOut", stagger: 0.1
}, exitStart);
```

**Snap out** (dramatic, punchy): Hard opacity to 0, no ease out — just gone.
```js
tl.to(".phase-elements", {
  opacity: 0, duration: 0.08, ease: "none"
}, exitStart);
```

**Compress** (tense): Elements slowly contract inward before the next scene hits.
```js
tl.to(".phase-elements", {
  scale: 0.9, x: 0, y: 0, opacity: 0.3,
  duration: 1.5, ease: "power4.in"
}, exitStart);
```

### Mood-to-Default-Pattern Mapping

| Mood | Entrance | Emphasis | Exit |
|------|----------|----------|------|
| dramatic | slow reveal | tension hold | snap out |
| playful | cascade | play | scatter |
| elegant | ensemble | drift | fade recede |
| energetic | cascade | pulse | scatter |
| calm | ensemble | drift | fade recede |
| tense | slow reveal | tension hold | compress |
| punchy | impact | pulse | snap out |

Prompt-level overrides take precedence: if the prompt says "the title slams in," use impact entrance regardless of mood default.

### Timeline Assembly

Compose phases into a single master timeline:

```js
const master = gsap.timeline({ paused: true });

// Phase 1 (0s - 15s)
const phase1 = gsap.timeline();
// ... entrance/emphasis/exit choreography for phase 1 ...
master.add(phase1, 0);

// Transition 1 overlap: phase1 exit overlaps phase2 entrance
// Look up transition type from matrix: e.g., tense→punchy = hard (0.3-0.8s)
const t1Overlap = 0.5; // within hard range

// Phase 2 (14.5s - 24.5s) — starts t1Overlap before phase1 ends
const phase2 = gsap.timeline();
// ... entrance/emphasis/exit choreography for phase 2 ...
master.add(phase2, 15 - t1Overlap);

// Continue for remaining phases...
```

Each phase is a nested `gsap.timeline()` added to master at the correct position. This keeps phase choreography self-contained while the master timeline handles inter-phase timing.
```

- [ ] **Step 2: Verify the full SKILL.md**

Read the SKILL.md and verify:
1. Original 12 principles + mood recipes are intact (lines 1-269)
2. Choreography Phases section follows
3. Transition Matrix section follows
4. Intra-Scene Choreography section follows with all patterns and GSAP code examples
5. No duplicate content or broken markdown

- [ ] **Step 3: Add the script placement reminder**

Append at the very end of SKILL.md:

```markdown

## Important: Script Placement

All `<script>` tags go at the end of `<body>`, never in `<head>`. Always call `gsap.registerPlugin()` for every plugin loaded via CDN before using it.

```js
<!-- At end of <body> -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/CustomEase.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/SplitText.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/CustomBounce.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/CustomWiggle.min.js"></script>
<script>
  gsap.registerPlugin(CustomEase, SplitText, CustomBounce, CustomWiggle);
  // ... timeline code ...
</script>
```
```

- [ ] **Step 4: Commit**

```bash
cd ~/.claude/skills/emotion-to-motion && git add SKILL.md && git commit -m "feat(skill): add intra-scene choreography patterns and script placement guide"
```

---

### Task 4: Update evals.json with Multi-Scene Test Cases

**Files:**
- Modify: `~/.claude/skills/emotion-to-motion/evals/evals.json`

- [ ] **Step 1: Read the existing evals.json**

Read `~/.claude/skills/emotion-to-motion/evals/evals.json` — note the existing format so we match it.

- [ ] **Step 2: Replace evals.json with iteration-3 test cases**

Write the following (replaces entire file — iteration 1/2 evals are preserved in the workspace):

```json
{
  "skill_name": "emotion-to-motion",
  "iteration": 3,
  "evals": [
    {
      "id": 0,
      "name": "high-contrast-arc",
      "prompt": "A thriller title sequence: open with creeping unease as fragments of text drift in darkness, then SNAP — explosive reveal of the title with shattering glass, then settle into calm aftermath with slow floating debris. Total duration ~45 seconds. The title is 'SHATTERED'. Dark background, white and red accents.",
      "expected_phases": [
        { "mood": "tense", "duration_s": 15, "entrance": "slow reveal", "emphasis": "tension hold", "exit": "compress" },
        { "mood": "punchy", "duration_s": 10, "entrance": "impact", "emphasis": "pulse", "exit": "snap out" },
        { "mood": "calm", "duration_s": 20, "entrance": "ensemble", "emphasis": "drift", "exit": "fade recede" }
      ],
      "expected_transitions": [
        { "from": "tense", "to": "punchy", "type": "hard", "overlap_range": [0.3, 0.8] },
        { "from": "punchy", "to": "calm", "type": "hard", "overlap_range": [0.3, 0.8] }
      ],
      "grading_criteria": [
        "phase-presence",
        "entrance-choreography",
        "emphasis-choreography",
        "exit-choreography",
        "transition-technique",
        "duration-fidelity",
        "mood-appropriate-easing",
        "valid-hyperframes"
      ]
    },
    {
      "id": 1,
      "name": "gradual-escalation",
      "prompt": "A luxury fitness brand launch: begin with elegant product beauty shots of a sleek fitness tracker called 'APEX', slowly build energy as athletes appear in motion, crescendo into triumphant celebration with the brand tagline 'Rise Above'. Total duration ~40 seconds. Black and gold palette, modern sans-serif typography.",
      "expected_phases": [
        { "mood": "elegant", "duration_s": 15, "entrance": "ensemble", "emphasis": "drift", "exit": "fade recede" },
        { "mood": "energetic", "duration_s": 12, "entrance": "cascade", "emphasis": "pulse", "exit": "scatter" },
        { "mood": "playful", "duration_s": 13, "entrance": "cascade", "emphasis": "play", "exit": "scatter" }
      ],
      "expected_transitions": [
        { "from": "elegant", "to": "energetic", "type": "escalation", "overlap_range": [0.8, 1.5] },
        { "from": "energetic", "to": "playful", "type": "soft", "overlap_range": [1.5, 3.0] }
      ],
      "grading_criteria": [
        "phase-presence",
        "entrance-choreography",
        "emphasis-choreography",
        "exit-choreography",
        "transition-technique",
        "duration-fidelity",
        "mood-appropriate-easing",
        "valid-hyperframes"
      ]
    }
  ]
}
```

- [ ] **Step 3: Verify the JSON is valid**

```bash
python3 -c "import json; json.load(open('$HOME/.claude/skills/emotion-to-motion/evals/evals.json'))" && echo "Valid JSON"
```

Expected: `Valid JSON`

- [ ] **Step 4: Commit**

```bash
cd ~/.claude/skills/emotion-to-motion && git add evals/evals.json && git commit -m "feat(evals): update test cases for iteration 3 multi-scene compositions"
```

---

### Task 5: Create Iteration-3 Workspace and Eval Metadata

**Files:**
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/eval_metadata.json`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/eval_metadata.json`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p ~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/{with_skill/outputs,without_skill/outputs}
mkdir -p ~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/{with_skill/outputs,without_skill/outputs}
```

- [ ] **Step 2: Create eval_metadata.json for high-contrast-arc**

Write to `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/eval_metadata.json`:

```json
{
  "eval_id": 0,
  "eval_name": "high-contrast-arc",
  "prompt": "A thriller title sequence: open with creeping unease as fragments of text drift in darkness, then SNAP — explosive reveal of the title with shattering glass, then settle into calm aftermath with slow floating debris. Total duration ~45 seconds. The title is 'SHATTERED'. Dark background, white and red accents.",
  "expected_phases": ["tense (15s)", "punchy (10s)", "calm (20s)"],
  "expected_transitions": ["tense→punchy: hard", "punchy→calm: hard"]
}
```

- [ ] **Step 3: Create eval_metadata.json for gradual-escalation**

Write to `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/eval_metadata.json`:

```json
{
  "eval_id": 1,
  "eval_name": "gradual-escalation",
  "prompt": "A luxury fitness brand launch: begin with elegant product beauty shots of a sleek fitness tracker called 'APEX', slowly build energy as athletes appear in motion, crescendo into triumphant celebration with the brand tagline 'Rise Above'. Total duration ~40 seconds. Black and gold palette, modern sans-serif typography.",
  "expected_phases": ["elegant (15s)", "energetic (12s)", "playful (13s)"],
  "expected_transitions": ["elegant→energetic: escalation", "energetic→playful: soft"]
}
```

- [ ] **Step 4: Verify directory structure**

```bash
find ~/.claude/skills/emotion-to-motion-workspace/iteration-3 -type f | sort
```

Expected output shows both `eval_metadata.json` files and the empty output directories.

---

### Task 6: Generate "High Contrast Arc" WITHOUT Skill

**Files:**
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/outputs/index.html`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/timing.json`

**Important:** This composition must be generated by a **fresh subagent that does NOT have access to the emotion-to-motion SKILL.md**. The subagent should only receive the prompt and the HyperFrames composition format requirements.

- [ ] **Step 1: Dispatch a fresh subagent with ONLY the prompt**

The subagent receives:
- The prompt from eval_metadata.json
- HyperFrames composition format rules: `data-composition-id` attribute, `gsap.timeline({ paused: true })`, `window.__timelines["id"] = tl`, 1920x1080 viewport, GSAP 3.14.2 from jsdelivr CDN, all `<script>` tags at end of `<body>`, `gsap.registerPlugin()` for all plugins
- **NO** emotion-to-motion skill content

Record the token count and duration in timing.json.

- [ ] **Step 2: Save the output**

Save the generated HTML to `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/outputs/index.html`

- [ ] **Step 3: Save timing metrics**

Write timing.json:
```json
{
  "total_tokens": <actual>,
  "duration_ms": <actual>,
  "total_duration_seconds": <actual>
}
```

- [ ] **Step 4: Validate the output**

Verify the HTML:
1. Contains `data-composition-id` attribute
2. Contains `window.__timelines` assignment
3. Uses `gsap.timeline({ paused: true })`
4. GSAP scripts are at end of `<body>`
5. Total timeline duration is approximately 45s

---

### Task 7: Generate "High Contrast Arc" WITH Skill

**Files:**
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/outputs/index.html`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/timing.json`

**Important:** This composition must be generated by a **fresh subagent that HAS the full emotion-to-motion SKILL.md** loaded. The subagent receives the prompt AND the skill.

- [ ] **Step 1: Dispatch a fresh subagent with the prompt AND the full SKILL.md content**

The subagent receives:
- The prompt from eval_metadata.json
- The **full content** of `~/.claude/skills/emotion-to-motion/SKILL.md` (all 12 principles, mood recipes, choreography phases, transition matrix, intra-scene choreography)
- HyperFrames composition format rules (same as Task 6)

Record the token count and duration.

- [ ] **Step 2: Save the output**

Save the generated HTML to `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/outputs/index.html`

- [ ] **Step 3: Save timing metrics**

Write timing.json with actual values.

- [ ] **Step 4: Validate the output**

Same validation as Task 6, PLUS:
1. Contains 3 distinct phases (tense, punchy, calm)
2. Uses CustomEase for tension curves
3. Has transition choreography between phases
4. Entrance/emphasis/exit patterns are present per phase

---

### Task 8: Generate "Gradual Escalation" WITHOUT Skill

**Files:**
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/outputs/index.html`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/timing.json`

Same approach as Task 6 but with the gradual-escalation prompt. **No skill loaded.**

- [ ] **Step 1: Dispatch fresh subagent with only the prompt**
- [ ] **Step 2: Save output to index.html**
- [ ] **Step 3: Save timing.json**
- [ ] **Step 4: Validate output** (data-composition-id, __timelines, paused timeline, scripts at end of body, ~40s duration)

---

### Task 9: Generate "Gradual Escalation" WITH Skill

**Files:**
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/outputs/index.html`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/timing.json`

Same approach as Task 7 but with the gradual-escalation prompt. **Full SKILL.md loaded.**

- [ ] **Step 1: Dispatch fresh subagent with prompt AND full SKILL.md**
- [ ] **Step 2: Save output to index.html**
- [ ] **Step 3: Save timing.json**
- [ ] **Step 4: Validate output** (same as Task 8 PLUS: 3 phases elegant→energetic→playful, escalation + soft transitions, choreography patterns per phase)

---

### Task 10: Grade All 4 Compositions

**Files:**
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/outputs/grading.json`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/outputs/grading.json`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/outputs/grading.json`
- Create: `~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/outputs/grading.json`

- [ ] **Step 1: Read all 4 index.html files**

Read each composition output to analyze against the 8 grading criteria.

- [ ] **Step 2: Grade high-contrast-arc/with_skill**

Analyze the composition against the 8 criteria using the 0/1/2 scoring rubric from the spec (see `docs/superpowers/specs/2026-03-25-emotion-to-motion-iter3-design.md`, Grading Criteria section). Write grading.json:

```json
{
  "eval_name": "high-contrast-arc",
  "variant": "with_skill",
  "criteria": [
    { "name": "phase-presence", "score": <0|1|2>, "evidence": "<specific evidence from the HTML>" },
    { "name": "entrance-choreography", "score": <0|1|2>, "evidence": "<...>" },
    { "name": "emphasis-choreography", "score": <0|1|2>, "evidence": "<...>" },
    { "name": "exit-choreography", "score": <0|1|2>, "evidence": "<...>" },
    { "name": "transition-technique", "score": <0|1|2>, "evidence": "<...>" },
    { "name": "duration-fidelity", "score": <0|1|2>, "evidence": "<...>" },
    { "name": "mood-appropriate-easing", "score": <0|1|2>, "evidence": "<...>" },
    { "name": "valid-hyperframes", "score": <0|1|2>, "evidence": "<...>" }
  ],
  "total_score": <sum>,
  "max_score": 16
}
```

- [ ] **Step 3: Grade high-contrast-arc/without_skill**

Same format, same rubric.

- [ ] **Step 4: Grade gradual-escalation/with_skill**

Same format, same rubric.

- [ ] **Step 5: Grade gradual-escalation/without_skill**

Same format, same rubric.

- [ ] **Step 6: Create benchmark.json**

Write to `~/.claude/skills/emotion-to-motion-workspace/iteration-3/benchmark.json`:

```json
{
  "iteration": 3,
  "date": "2026-03-25",
  "cases": [
    {
      "name": "high-contrast-arc",
      "with_skill_score": <total>,
      "without_skill_score": <total>,
      "delta": <with - without>
    },
    {
      "name": "gradual-escalation",
      "with_skill_score": <total>,
      "without_skill_score": <total>,
      "delta": <with - without>
    }
  ],
  "average_with_skill": <avg>,
  "average_without_skill": <avg>,
  "average_delta": <avg delta>
}
```

---

### Task 11: Deploy to HyperFrames Studio for Visual Review

**Files:**
- Create: `packages/studio/data/projects/high-contrast-arc-with-skill/index.html`
- Create: `packages/studio/data/projects/high-contrast-arc-without-skill/index.html`
- Create: `packages/studio/data/projects/gradual-escalation-with-skill/index.html`
- Create: `packages/studio/data/projects/gradual-escalation-without-skill/index.html`

- [ ] **Step 1: Copy compositions to studio projects**

```bash
cp ~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/with_skill/outputs/index.html packages/studio/data/projects/high-contrast-arc-with-skill/index.html
cp ~/.claude/skills/emotion-to-motion-workspace/iteration-3/high-contrast-arc/without_skill/outputs/index.html packages/studio/data/projects/high-contrast-arc-without-skill/index.html
cp ~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/with_skill/outputs/index.html packages/studio/data/projects/gradual-escalation-with-skill/index.html
cp ~/.claude/skills/emotion-to-motion-workspace/iteration-3/gradual-escalation/without_skill/outputs/index.html packages/studio/data/projects/gradual-escalation-without-skill/index.html
```

(Create the project directories first with `mkdir -p` if they don't exist.)

- [ ] **Step 2: Verify studio picks up the projects**

Start or refresh the studio dev server. All 4 projects should appear in the project list.

- [ ] **Step 3: Present results to user**

Report:
1. Benchmark scores (with vs without, per case and average)
2. Key qualitative differences observed during grading
3. Studio URLs for visual review
4. Recommendations for next iteration based on results

---

### Task 12: Update Memory

**Files:**
- Modify: `~/.claude/projects/-Users-vanceingalls-src-hyperframes/memory/project_emotion_to_motion_skill.md`

- [ ] **Step 1: Update the project memory with iteration 3 status**

Update the memory file to reflect:
- Iteration 3 complete
- Multi-scene choreography phases, transition matrix, and intra-scene choreography added to SKILL.md
- 2 test cases (high-contrast-arc, gradual-escalation) at 40-45s duration
- Benchmark scores (fill in actual scores)
- Any learnings or issues discovered during generation
