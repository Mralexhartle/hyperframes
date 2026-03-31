---
name: hyperframes-captions
description: Build tone-adaptive captions from whisper transcripts. Detects script energy (hype, corporate, tutorial, storytelling, social) and applies matching typography, color, and animation. Supports per-word styling for brand names, ALL CAPS, numbers, and CTAs. Use when adding captions, subtitles, or lyrics to a HyperFrames composition. Lyric videos ARE captions — any text synced to audio uses this skill.
trigger: Use this skill whenever a task involves syncing text to audio timing. This includes captions, subtitles, lyrics, karaoke, transcription overlays, and any word-level or phrase-level text timed to speech or music.
---

# Captions

Analyze the spoken content to determine caption style. If the user specifies a style, use that. Otherwise, detect tone from the transcript.

## Transcript Source

The project's `transcript.json` contains word-level timestamps. If no transcript exists, generate one using progressive transcription (see below). Also check for `.srt` or `.vtt` files as fallbacks.

### Progressive Transcription

When transcribing audio, start with the smallest viable model and escalate only if quality checks fail. This saves download time and memory — `small.en` (461MB) handles most content; `medium` (1.4GB) is rarely needed.

**Model ladder:** `small.en` → `small` → `medium`

Use `small.en` first (English-optimized, fastest). If the audio contains non-English speech, fall back to `small` (multilingual). Only escalate to `medium` if quality checks fail on both.

```python
import whisper, json

MODELS = ["small.en", "small", "medium"]

def transcribe_progressive(audio_path, language="en"):
    """Try progressively larger models until quality checks pass."""
    for model_name in MODELS:
        print(f"Trying model: {model_name}")
        model = whisper.load_model(model_name)
        result = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
        )
        words = extract_words(result)
        issues = check_quality(words, audio_path)
        if not issues:
            print(f"✓ {model_name} passed quality checks ({len(words)} words)")
            return result, words
        print(f"✗ {model_name} failed: {', '.join(issues)}")
    # Return best effort (medium) even if it has issues
    print(f"⚠ Using {MODELS[-1]} despite quality issues")
    return result, words

def extract_words(result):
    words = []
    for seg in result["segments"]:
        for w in seg.get("words", []):
            text = w["word"].strip()
            if not text:
                continue
            words.append({"text": text, "start": w["start"], "end": w["end"]})
    return words

def check_quality(words, audio_path):
    """Return list of issues found, or empty list if quality is acceptable."""
    import subprocess, json as j
    issues = []
    if not words:
        return ["no words detected"]

    # 1. Timestamp clustering: >10 words sharing the exact same timestamp = hallucination
    from collections import Counter
    start_counts = Counter(round(w["start"], 2) for w in words)
    worst_cluster = start_counts.most_common(1)[0]
    if worst_cluster[1] > 10:
        issues.append(f"{worst_cluster[1]} words at t={worst_cluster[0]}s (hallucination)")

    # 2. First word too early: if audio has intro music/silence, words shouldn't start at 0.0s
    #    Get audio duration to check if first word is suspiciously at the very start
    #    (only flag if first word is at 0.0s AND there's a big gap to the second word)
    if len(words) >= 2 and words[0]["start"] == 0.0 and words[1]["start"] > 5.0:
        issues.append(f"first word at 0.0s but next at {words[1]['start']}s (likely hallucinated intro)")

    # 3. Repetitive content: same word appearing >30% of total words
    word_counts = Counter(w["text"].lower().strip(",. ") for w in words)
    total = len(words)
    for word, count in word_counts.most_common(3):
        if count > total * 0.3 and word not in ("I", "the", "a", "and", "to", "is"):
            issues.append(f"'{word}' repeated {count}/{total} times ({count/total:.0%})")

    # 4. Zero-duration words: >20% of words with start == end
    zero_dur = sum(1 for w in words if w["start"] == w["end"])
    if zero_dur > total * 0.2:
        issues.append(f"{zero_dur}/{total} zero-duration words ({zero_dur/total:.0%})")

    return issues
```

Run this instead of calling whisper-cli directly. Save the result to `transcript.json` and `words.json`.

**When to skip to `medium` directly:**

- Audio has heavy background music (concerts, music videos with complex mixing)
- Multiple overlapping speakers
- Non-English audio where `.en` models won't work

### Transcript Format

The output `transcript.json` should contain word-level timestamps:

```json
{
  "transcription": [
    {
      "offsets": { "from": 0, "to": 5000 },
      "text": " Hello world.",
      "tokens": [
        { "text": " Hello", "offsets": { "from": 0, "to": 1000 }, "p": 0.98 },
        { "text": " world", "offsets": { "from": 1000, "to": 2000 }, "p": 0.95 }
      ]
    }
  ]
}
```

Normalize tokens into a word array before grouping:

```js
const words = [];
for (const segment of transcript.transcription) {
  for (const token of segment.tokens || []) {
    const text = token.text.trim();
    if (!text) continue;
    words.push({
      text,
      start: token.offsets.from / 1000,
      end: token.offsets.to / 1000,
    });
  }
}
```

### Transcript Verification

Before building captions, verify timestamps are plausible:

- **First word timing:** Should match when speech actually begins. If audio has intro music/silence, first word must NOT be at 0.0s.
- **Clustering:** If many words share the exact same timestamp, the model hallucinated — escalate.
- **Repetition:** If one non-common word appears in >30% of tokens (e.g., "oh" repeated 100+ times), the model is stuck in a loop — escalate.
- **Spot-check 3 timestamps** against the audio: beginning, middle, and end of the transcript. If any are >2s off, escalate.

## Style Detection (Default — When No Style Is Specified)

Read the full transcript before choosing a style. The style comes from the content, not a template.

### Four Dimensions

**1. Visual feel** — the overall aesthetic personality:

- Corporate/professional scripts → clean, minimal, restrained
- Energetic/marketing scripts → bold, punchy, high-impact
- Storytelling/narrative scripts → elegant, warm, cinematic
- Technical/educational scripts → precise, high-contrast, structured
- Social media/casual scripts → playful, dynamic, friendly

**2. Color palette** — driven by the content's mood:

- Dark backgrounds with bright accents for high energy
- Muted/neutral tones for professional or calm content
- High contrast (white on black, black on white) for clarity
- One accent color for emphasis — not multiple

**3. Font mood** — typography character, not specific font names:

- Heavy/condensed for impact and energy
- Clean sans-serif for modern and professional
- Rounded for friendly and approachable
- Serif for elegance and storytelling

**4. Animation character** — how words enter and exit:

- Scale-pop/slam for punchy energy
- Gentle fade/slide for calm or professional
- Word-by-word reveal for emphasis
- Typewriter for technical or narrative pacing

## Per-Word Styling

Scan the script for words that deserve distinct visual treatment. Not every word is equal — some carry the message.

### What to Detect

- **Brand names / product names** — larger size, unique color, distinct entrance
- **ALL CAPS words** — the author emphasized them intentionally. Scale boost, flash, or accent color.
- **Numbers / statistics** — bold weight, accent color. Numbers are the payload in data-driven content.
- **Emotional keywords** — "incredible", "insane", "amazing", "revolutionary" → exaggerated animation (overshoot, bounce)
- **Proper nouns** — names of people, places, events → distinct accent or italic
- **Call-to-action phrases** — "sign up", "get started", "try it now" → highlight, underline, or color pop

### How to Apply

For each detected word, specify:

- Font size multiplier (e.g., 1.3x for emphasis, 1.5x for hero moments)
- Color override (specific hex value)
- Weight/style change (bolder, italic)
- Animation variant (overshoot entrance, glow pulse, scale pop)

## Script-to-Style Mapping

| Script tone          | Font mood                             | Animation                               | Color                                        | Size                 |
| -------------------- | ------------------------------------- | --------------------------------------- | -------------------------------------------- | -------------------- |
| Hype/launch          | Heavy condensed, 800-900 weight       | Scale-pop, back.out(1.7), fast 0.1-0.2s | Bright accent on dark (cyan, yellow, lime)   | Large 72-96px        |
| Corporate/pitch      | Clean sans-serif, 600-700 weight      | Fade + slide-up, power3.out, 0.3s       | White/neutral on dark, single muted accent   | Medium 56-72px       |
| Tutorial/educational | Mono or clean sans, 500-600 weight    | Typewriter or gentle fade, 0.4-0.5s     | High contrast, minimal color                 | Medium 48-64px       |
| Storytelling/brand   | Serif or elegant sans, 400-500 weight | Slow fade, power2.out, 0.5-0.6s         | Warm muted tones, low opacity (0.85-0.9)     | Smaller 44-56px      |
| Social/casual        | Rounded sans, 700-800 weight          | Bounce, elastic.out, word-by-word       | Playful colors, colored backgrounds on pills | Medium-large 56-80px |

## Word Grouping by Tone

Group size affects pacing. Fast content needs fast caption turnover.

- **High energy:** 2-3 words per group. Quick turnover matches rapid delivery.
- **Conversational:** 3-5 words per group. Natural phrase length.
- **Measured/calm:** 4-6 words per group. Longer groups match slower pace.

Break groups on sentence boundaries (`.` `?` `!`), pauses (>150ms gap), or max word count — whichever comes first.

## Positioning

- **Landscape (1920x1080):** Bottom 80-120px, centered
- **Portrait (1080x1920):** Lower middle ~600-700px from bottom, centered
- Never cover the subject's face
- Use `position: absolute` — never relative (causes overflow)
- One caption group visible at a time

## Text Overflow Prevention

Captions must never clip off-screen. Apply these rules:

- Set `max-width: 1600px` (landscape) or `max-width: 900px` (portrait) on caption container
- Add `overflow: hidden` as a safety net
- **Auto-scale font size** based on character count:
  - ≤18 chars → full size (e.g., 78px)
  - 19–25 chars → reduce ~15% (e.g., 68px)
  - 26+ chars → reduce ~25% (e.g., 58px)
- Reduce `letter-spacing` for long text (switch from `-0.02em` to `-0.04em`)
- Give the caption container an explicit `height` (e.g., `200px`) — don't rely on content sizing with absolute children
- Use `position: absolute` on all caption elements — `position: relative` causes overflow

## Caption Exit Guarantee

Captions that stick on screen are the most common caption bug. Every caption group **must** have a hard kill after its exit animation.

**The pattern:**

```js
// Animate exit (soft — can fail if tweens conflict)
tl.to(groupEl, { opacity: 0, scale: 0.95, duration: 0.12, ease: "power2.in" }, group.end - 0.12);

// Hard kill at group.end (belt-and-suspenders — guarantees invisible)
tl.set(groupEl, { opacity: 0, visibility: "hidden" }, group.end);
```

**Why both?** The `tl.to` exit can fail to fully hide a group when:

- Karaoke word-level tweens (`scale`, `color`) on child elements conflict with the parent exit tween
- `fromTo` entrance tweens lock start/end values that override later tweens on the same property
- Timeline scrubbing lands between the exit start and end

The `tl.set` at `group.end` is a deterministic kill — it fires at an exact time, doesn't animate, and can't be overridden by other tweens at different times.

**Self-lint rule:** After building the timeline, verify every caption group has a hard kill. Run this check before registering the timeline:

```js
// Caption lint: verify every group has a hard kill
GROUPS.forEach(function (group, gi) {
  var el = document.getElementById("cg-" + gi);
  if (!el) return;
  // Check that the element will be hidden after its end time
  // by seeking the timeline past the group's end and checking opacity
  tl.seek(group.end + 0.01);
  var computed = window.getComputedStyle(el);
  if (computed.opacity !== "0" && computed.visibility !== "hidden") {
    console.warn(
      "[caption-lint] group " +
        gi +
        " ('" +
        group.text +
        "') is still visible at t=" +
        (group.end + 0.01).toFixed(2) +
        "s",
    );
  }
});
tl.seek(0); // reset after lint
```

Place this **before** `window.__timelines[id] = tl` so it runs at composition init. Warnings appear in the browser console during `hyperframes dev`.

## Constraints

- **Deterministic.** No `Math.random()`, no `Date.now()`.
- **Sync to transcript timestamps.** Words appear when spoken.
- **One group visible at a time.** No overlapping caption groups.
- **Every caption group must have a hard `tl.set` kill at `group.end`.** Exit animations alone are not sufficient.
- **Check project root** for font files before defaulting to Google Fonts.
