# Emotion-to-Motion Skill: Iteration 3 Design

## Status
- **Date:** 2026-03-25
- **Iteration:** 3 (previous: iterations 1 & 2 with 8-12s single-scene compositions)
- **Goal:** Support 30-60s multi-scene compositions with mood transitions and intra-scene choreography

## Background

Iterations 1 and 2 validated that the emotion-to-motion skill improves mood alignment in GSAP compositions — custom eases, appropriate plugin choices, and motion that matches emotional intent. However, compositions were short (8-12s) and single-scene. Key findings:

- Playful/fun showed the clearest improvement with choreography principles
- Dramatic and elegant showed subtler differences (restraint is inherent to the mood)
- Short compositions don't give enough room to demonstrate the skill's value
- No support for mood transitions or multi-scene arcs

This iteration addresses all of these by introducing choreography phases, a transition matrix, and intra-scene choreography patterns.

## Design

### 1. Choreography Phases

A composition is decomposed into an ordered list of **phases**. Each phase has:

- **Mood** — one of the canonical moods: dramatic, playful, elegant, energetic, calm, tense, punchy
- **Duration** — seconds this phase occupies in the master timeline
- **Content description** — what's visually happening (elements, text, imagery)
- **Entrance pattern** — how elements arrive (see Section 3)
- **Emphasis pattern** — how the scene holds attention mid-phase (see Section 3)
- **Exit pattern** — how elements leave, feeding into the transition (see Section 3)

#### Mood Synonym Resolution

Prompts often use evocative language that doesn't match canonical mood names. Resolve synonyms before phase decomposition:

| Synonym | Canonical Mood |
|---------|---------------|
| explosive, intense, fierce | punchy |
| serene, peaceful, tranquil | calm |
| triumphant, victorious, celebratory | playful |
| suspenseful, ominous, creeping | tense |
| luxurious, refined, sophisticated | elegant |
| exciting, dynamic, high-energy | energetic |
| cinematic, epic, grand | dramatic |

#### Mood Recipe Reference

Each canonical mood has a recipe (defined in the existing SKILL.md) that provides:
- **Easing curves** — GSAP ease strings (e.g., `"power4.in"`, `CustomEase.create(...)`)
- **Duration range** — min-max seconds per tween (e.g., dramatic: 0.8-2.5s, punchy: 0.1-0.4s)
- **Preferred plugins** — GSAP plugins to load (e.g., dramatic: CustomEase, SplitText; playful: CustomBounce, CustomWiggle)
- **Intensity range** — movement magnitude bounds (e.g., elegant: y 5-20px, rotation 0-2deg; energetic: y 30-80px, rotation 5-15deg)

#### Phase Decomposition Rules

The skill handles two input styles:

**Explicit per-scene moods:** The prompt specifies each scene's mood directly.
> "Scene 1 (tense, 15s): fragments of text drift in darkness. Scene 2 (punchy, 10s): title shatters into view. Scene 3 (calm, 20s): debris floats gently."

The skill extracts mood (resolving synonyms), duration, and content directly from the prompt.

**Arc-based descriptions:** The prompt describes an overall emotional journey.
> "Build from quiet unease to cathartic release to calm aftermath"

The skill decomposes this into phases by:
1. Identifying the mood anchors in the description (quiet unease = tense, cathartic release = dramatic, calm aftermath = calm)
2. Allocating durations using weighted distribution (see table below)
3. Generating content suggestions that serve each mood

**Duration allocation weights** — multiply each phase's weight by the target total, divide by the sum of all weights, round to nearest second:

| Mood | Weight | Rationale |
|------|--------|-----------|
| calm, elegant | 1.2 | Need room to breathe, long durations |
| dramatic, tense | 1.0 | Standard pacing |
| energetic, playful | 0.9 | Sustained energy gets tiring |
| punchy | 0.7 | Impact depends on brevity |

**Minimum phase duration:** 6s. If allocation produces a phase shorter than 6s, clamp to 6s and redistribute the deficit from the longest phase.

For a 30-60s composition, expect 3-5 phases at 8-15s each. Allow up to 7 phases if the prompt explicitly calls for them, but warn that individual phase durations may compress.

#### Edge Cases

- **Single-mood prompts:** If the prompt describes one mood for 30-60s, treat as one phase with no transitions. Apply entrance/emphasis/exit choreography across the full duration.
- **Adjacent same-mood phases:** If two consecutive phases share the same canonical mood, merge them into one phase unless their content descriptions feature different primary subjects or visual elements (e.g., "product close-up" vs. "lifestyle scene"). If kept separate, use a soft transition.
- **More than 7 phases:** Suggest consolidating phases with similar moods. The agent should not produce more than 7 phases in a single composition.

### 2. Transition Matrix

Transitions between phases are inferred from the **mood delta** — how different adjacent phases feel. Three categories:

#### Hard Transitions (high contrast mood shifts)
- **Overlap:** 0.3-0.8s
- **Technique:** Scene N's elements snap out (opacity 0, scale 0.95) while Scene N+1's elements slam in simultaneously
- **Feels like:** A film cut — the energy shift IS the transition
- **When:** tense→punchy, calm→punchy, elegant→energetic, any shift where the moods are fundamentally opposed

#### Soft Transitions (low contrast mood shifts)
- **Overlap:** 1.5-3s
- **Technique:** Scene N's elements slowly fade/drift out while Scene N+1's elements gradually emerge underneath
- **Feels like:** A long crossfade — elements from both scenes coexist briefly
- **When:** elegant→calm, dramatic→tense, calm→elegant, any shift between adjacent emotional temperatures

#### Escalation Transitions (building intensity)
- **Overlap:** 0.8-1.5s
- **Technique:** Scene N's elements accelerate their exit (speeding up ease curves), Scene N+1's entrance inherits that momentum
- **Feels like:** A tempo ramp — motion gets faster before the new scene lands
- **When:** calm→energetic, tense→dramatic, elegant→punchy, any shift that increases intensity

#### Full Transition Lookup Table

| From \ To   | dramatic   | playful    | elegant    | energetic  | calm       | tense      | punchy     |
|-------------|------------|------------|------------|------------|------------|------------|------------|
| dramatic    | soft       | hard       | soft       | escalation | soft       | soft       | hard       |
| playful     | hard       | soft       | hard       | soft       | hard       | hard       | hard       |
| elegant     | soft       | hard       | soft       | escalation | soft       | escalation | hard       |
| energetic   | hard       | soft       | hard       | soft       | hard       | hard       | hard       |
| calm        | escalation | hard       | soft       | escalation | soft       | escalation | hard       |
| tense       | escalation | hard       | soft       | escalation | soft       | soft       | hard       |
| punchy      | hard       | soft       | hard       | hard       | hard       | hard       | soft       |

**Matrix rationale for non-obvious entries:**
- playful→punchy = hard: playful is flowing, punchy is staccato — a cut emphasizes the character shift
- energetic→punchy = hard: both are high-energy but sustained vs. staccato — a cut marks the textural shift
- tense→elegant = soft: both share restraint and controlled motion, low contrast warrants a crossfade
- punchy→energetic = hard: staccato to sustained flow is a fundamental rhythm change

### 3. Intra-Scene Choreography Patterns

Each phase gets choreography patterns for its three acts (entrance, emphasis, exit), derived from its mood.

#### Entrance Choreography — how elements arrive

| Pattern      | Moods              | Description                                                                 |
|--------------|--------------------|-----------------------------------------------------------------------------|
| Cascade      | energetic, playful | Rapid staggered entrances, each element slightly offset (0.05-0.1s gaps)   |
| Slow reveal  | dramatic, tense    | Elements emerge one at a time with long pauses between, building anticipation |
| Ensemble     | elegant, calm      | Elements fade in together or in 2-3 groups, no single element demands attention |
| Impact       | punchy             | Hero element hits first and hard, supporting elements follow in quick succession |

#### Emphasis Choreography — how the scene holds attention mid-phase

| Pattern       | Moods              | Description                                                                 |
|---------------|--------------------|--------------------------------------------------------------------|
| Pulse         | energetic, punchy  | Subtle scale or brightness oscillation on key elements, keeps rhythm        |
| Drift         | calm, elegant      | Slow continuous motion — gentle float, rotation, or parallax shift          |
| Tension hold  | tense, dramatic    | Near-stillness with micro-tremor on one element, building unease            |
| Play          | playful            | Secondary action — idle wobbles, bounces, rotation on supporting elements   |

#### Exit Choreography — how elements leave (feeds into transition)

| Pattern       | Moods              | Description                                                                 |
|---------------|--------------------|--------------------------------------------------------------------|
| Scatter       | playful, energetic | Elements exit in different directions with stagger                          |
| Fade recede   | calm, elegant      | Opacity + slight scale down, elements sink back                             |
| Snap out      | dramatic, punchy   | Hard opacity to 0, no ease out — just gone                                  |
| Compress      | tense              | Elements slowly contract inward before the next scene hits                  |

#### Mood-to-Default-Pattern Mapping

| Mood       | Entrance    | Emphasis      | Exit         |
|------------|-------------|---------------|--------------|
| dramatic   | slow reveal | tension hold  | snap out     |
| playful    | cascade     | play          | scatter      |
| elegant    | ensemble    | drift         | fade recede  |
| energetic  | cascade     | pulse         | scatter      |
| calm       | ensemble    | drift         | fade recede  |
| tense      | slow reveal | tension hold  | compress     |
| punchy     | impact      | pulse         | snap out     |

Prompt-level overrides take precedence: if the prompt says "the title slams in," use impact entrance regardless of mood default.

### 4. Timeline Assembly

The master GSAP timeline is composed as follows:

```
masterTimeline
  ├── phase1Timeline (0s - 15s)
  │   ├── entrance (0s - 3s)
  │   ├── emphasis (3s - 12s)
  │   └── exit (12s - 15s)
  ├── transition1 (overlaps phase1 exit + phase2 entrance)
  ├── phase2Timeline (14.2s - 24.2s)
  │   ├── entrance (14.2s - 17s)
  │   ├── emphasis (17s - 21.5s)
  │   └── exit (21.5s - 24.2s)
  ├── transition2 (overlaps phase2 exit + phase3 entrance)
  └── phase3Timeline (23s - 43s)
      ├── entrance (23s - 26s)
      ├── emphasis (26s - 40s)
      └── exit (40s - 43s)
```

- Transitions overlap the exit of phase N and entrance of phase N+1
- Overlap duration comes from the transition matrix category
- Transition overlap is drawn from the exit duration of phase N and entrance duration of phase N+1 (not additional time). If the combined overlap on both sides of a phase exceeds 50% of its entrance + exit allocation, clamp to 50% and shorten the overlap
- Each phase timeline is a nested `gsap.timeline()` added to the master at the correct position
- Phase entrance/emphasis/exit durations scale proportionally to the phase's total duration using these defaults:

| Mood       | Entrance | Emphasis | Exit  | Rationale |
|------------|----------|----------|-------|-----------|
| dramatic   | 25%      | 55%      | 20%   | Slow reveal needs more entrance time |
| playful    | 20%      | 60%      | 20%   | Balanced — emphasis carries the fun |
| elegant    | 20%      | 65%      | 15%   | Long drift emphasis, gentle fade exit |
| energetic  | 15%      | 65%      | 20%   | Fast cascade entrance, sustained pulse |
| calm       | 20%      | 65%      | 15%   | Gentle ensemble in, long drift, soft exit |
| tense      | 25%      | 50%      | 25%   | Slow reveal + long compress exit for buildup |
| punchy     | 15%      | 60%      | 25%   | Impact entrance is fast, snap out exit needs setup |

### 5. Skill File Changes

The existing `~/.claude/skills/emotion-to-motion/SKILL.md` gets three new sections appended:

1. **Choreography Phases** — phase decomposition rules for explicit and arc-based prompts
2. **Transition Matrix** — the full lookup table with overlap durations and technique descriptions
3. **Intra-Scene Choreography** — entrance/emphasis/exit pattern definitions with mood-to-default mapping

Existing mood recipes remain unchanged — they provide the easing curves, duration ranges, and plugin choices that the new choreography patterns reference.

### 6. Known Issue: Subagent Script Placement

From iteration 1/2 learnings: subagents sometimes place `<script>` tags in `<head>` instead of body and forget `gsap.registerPlugin()`. The skill update should include an explicit reminder:

> All `<script>` tags go at the end of `<body>`. Always call `gsap.registerPlugin()` for every plugin loaded via CDN before using it.

## Evaluation

### Test Cases

#### Case 1: High Contrast Arc (~45s)

**Prompt:**
> "A thriller title sequence: open with creeping unease as fragments of text drift in darkness, then SNAP — explosive reveal of the title with shattering glass, then settle into calm aftermath with slow floating debris"

**Expected phases:**
- Phase 1 — tense (15s): text fragments drift, darkness, slow reveal entrance, tension hold emphasis, compress exit
- Phase 2 — punchy (10s): title shatter, impact entrance, pulse emphasis, snap out exit (synonym: "explosive" → punchy)
- Phase 3 — calm (20s): floating debris, ensemble entrance, drift emphasis, fade recede exit

**Expected transitions:**
- tense → punchy: hard (0.3-0.8s overlap, compressed elements snap away as title slams in)
- punchy → calm: hard (0.3-0.8s overlap, title snaps out as debris fades in — high contrast shift)

#### Case 2: Gradual Escalation (~40s)

**Prompt:**
> "A luxury fitness brand launch: begin with elegant product beauty shots, slowly build energy as athletes appear in motion, crescendo into triumphant celebration with the brand tagline"

**Expected phases:**
- Phase 1 — elegant (15s): product shots, ensemble entrance, drift emphasis, fade recede exit
- Phase 2 — energetic (12s): athletes in motion, cascade entrance, pulse emphasis, scatter exit
- Phase 3 — playful (13s): celebration + tagline, cascade entrance, play emphasis, scatter exit (synonym: "triumphant" → playful)

**Expected transitions:**
- elegant → energetic: escalation (0.8-1.5s overlap, product shots accelerate out as athletes carry momentum in)
- energetic → playful: soft (1.5-3s overlap, athletes blend into celebration)

### Grading Criteria (8 per case)

Each criterion is scored: **0** (absent), **1** (partially present), **2** (fully present). Total possible: 16.

| # | Criterion | 0 (absent) | 1 (partial) | 2 (full) |
|---|-----------|------------|-------------|----------|
| 1 | **Phase presence** | One flat mood throughout | Mood shifts exist but phases aren't distinct (no clear boundaries) | Distinct phases with identifiable mood shifts and clear boundaries |
| 2 | **Entrance choreography** | Elements appear with no entrance animation | Entrances exist but don't match mood pattern (e.g., cascade on a tense phase) | Mood-appropriate entrance pattern per the mapping table |
| 3 | **Emphasis choreography** | Dead air mid-phase — elements are static | Some motion exists but doesn't match mood (e.g., pulse on a calm phase) | Mood-appropriate emphasis pattern sustains attention through the phase |
| 4 | **Exit choreography** | Elements hard-disappear or stay until next scene overwrites them | Exit animations exist but don't coordinate with the transition | Elements leave with mood-appropriate exit pattern that feeds into the transition |
| 5 | **Transition technique** | No transitions — phases are hard cuts with no choreography | Transitions exist but wrong type for the mood delta (e.g., soft crossfade between tense→punchy) | Transition matches expected category from the matrix (hard/soft/escalation) |
| 6 | **Duration fidelity** | Total under 25s or over 70s | Total is 30-60s but phase proportions don't match the prompt | Total is 30-60s and phases are proportioned appropriately |
| 7 | **Mood-appropriate easing** | Generic eases only (power1, linear) across all phases | Some mood-specific eases but inconsistent | Each phase uses eases from its mood recipe (CustomEase for dramatic, elastic for playful, etc.) |
| 8 | **Valid HyperFrames** | Missing GSAP, broken HTML, or scripts in head | Valid HTML + GSAP but missing registerPlugin or wrong version | Well-formed HTML, GSAP 3.14.2, all plugins registered, scripts at end of body |

### Evaluation Structure

```
emotion-to-motion-workspace/
  iteration-3/
    high-contrast-arc/
      with_skill/
        outputs/
          index.html
          grading.json
        timing.json
      without_skill/
        outputs/
          index.html
          grading.json
        timing.json
      eval_metadata.json
    gradual-escalation/
      with_skill/
        outputs/
          index.html
          grading.json
        timing.json
      without_skill/
        outputs/
          index.html
          grading.json
        timing.json
      eval_metadata.json
    benchmark.json
```

## Out of Scope

- Changes to HyperFrames core packages — this is purely a skill-level update
- New GSAP plugins beyond what's already supported
- Audio/music synchronization
- Interactive or scroll-driven compositions

## Dependencies

- GSAP 3.14.2 on jsdelivr CDN (all plugins available)
- GSAP plugin support branch merged or available (feat/gsap-plugin-support — code complete, 95 tests)
