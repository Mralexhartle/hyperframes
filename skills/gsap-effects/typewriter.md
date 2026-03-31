# Typewriter Effect

Reveal text character by character with an optional blinking cursor. Uses GSAP's `TextPlugin` to animate the `text` property of an element.

## Required Plugin

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/TextPlugin.min.js"></script>
<script>
  gsap.registerPlugin(TextPlugin);
</script>
```

## Basic Typewriter

Type a sentence into an empty element at a steady pace.

```html
<div id="typed-text" style="font-size:48px; font-family:monospace; color:#fff; opacity:1;"></div>
```

```js
// Characters per second controls the feel:
//   3-5 cps = deliberate, dramatic
//   8-12 cps = conversational
//   15-20 cps = fast, energetic
const text = "Hello, world!";
const cps = 10;
const duration = text.length / cps;

tl.to(
  "#typed-text",
  {
    text: { value: text },
    duration: duration,
    ease: "none", // "none" gives even spacing — use "power2.in" for acceleration
  },
  startTime,
);
```

`ease: "none"` produces evenly-spaced characters. Any other ease changes the typing rhythm — `"power2.in"` starts slow and speeds up, `"power4.out"` types fast then slows to a stop.

## With Blinking Cursor

Add a cursor element that blinks while idle and holds steady while typing. Two rules:

1. **The cursor must always blink when idle** — after typing finishes, after clearing, during hold pauses. A cursor that just sits there solid looks broken.
2. **No gap between text and cursor** — the cursor element must be immediately adjacent to the text element in the HTML (no whitespace, no flex gap). Any space between the last character and `|` looks wrong.

```html
<!-- No whitespace between spans — cursor must sit flush against text -->
<span id="typed-text" style="font-size:48px; font-family:monospace; color:#fff;"></span
><span id="cursor" style="font-size:48px; font-family:monospace; color:#fff;">|</span>
```

```css
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
.cursor-blink {
  animation: blink 0.8s step-end infinite;
}
.cursor-solid {
  animation: none;
  opacity: 1;
}
.cursor-hide {
  animation: none;
  opacity: 0;
}
```

Three states: `cursor-blink` (idle), `cursor-solid` (actively typing), `cursor-hide` (cursor belongs to a different line). The pattern is always: blink → solid → type → solid → blink.

```js
const text = "Hello, world!";
const cps = 10;
const duration = text.length / cps;
const cursor = document.querySelector("#cursor");

// Cursor blinks before typing starts
cursor.classList.add("cursor-blink");

// Solid while typing
tl.call(
  () => {
    cursor.classList.replace("cursor-blink", "cursor-solid");
  },
  [],
  startTime,
);

// Type the text
tl.to(
  "#typed-text",
  {
    text: { value: text },
    duration: duration,
    ease: "none",
  },
  startTime,
);

// Back to blinking when done — never leave it solid
tl.call(
  () => {
    cursor.classList.replace("cursor-solid", "cursor-blink");
  },
  [],
  startTime + duration,
);
```

When handing off between multiple typewriter lines, hide the previous cursor and show the next one:

```js
tl.call(
  () => {
    prevCursor.classList.replace("cursor-blink", "cursor-hide");
    nextCursor.classList.replace("cursor-hide", "cursor-solid");
  },
  [],
  handoffTime,
);
```

## Word Rotation

Type a word, clear it, type the next. Useful for taglines that cycle through options. The cursor must blink during the hold pause between words and after each clear — every idle moment should blink.

```js
const words = ["creative", "powerful", "simple"];
const cursor = document.querySelector("#cursor");
let offset = startTime;

words.forEach((word, i) => {
  const typeDuration = word.length / 10;
  const holdDuration = 1.5;
  const clearDuration = word.length / 20; // Clear is faster than typing

  // Solid while typing
  tl.call(
    () => {
      cursor.classList.replace("cursor-blink", "cursor-solid");
    },
    [],
    offset,
  );
  tl.to(
    "#typed-text",
    {
      text: { value: word },
      duration: typeDuration,
      ease: "none",
    },
    offset,
  );
  // Blink during hold
  tl.call(
    () => {
      cursor.classList.replace("cursor-solid", "cursor-blink");
    },
    [],
    offset + typeDuration,
  );

  offset += typeDuration + holdDuration;

  // Clear the word (skip on the last word)
  if (i < words.length - 1) {
    // Solid while clearing
    tl.call(
      () => {
        cursor.classList.replace("cursor-blink", "cursor-solid");
      },
      [],
      offset,
    );
    tl.to(
      "#typed-text",
      {
        text: { value: "" },
        duration: clearDuration,
        ease: "none",
      },
      offset,
    );
    // Blink after clear
    tl.call(
      () => {
        cursor.classList.replace("cursor-solid", "cursor-blink");
      },
      [],
      offset + clearDuration,
    );
    offset += clearDuration + 0.3;
  }
});
```

## Appending Words

Type words one after another into the same element, building a sentence over time.

```js
const words = ["We", "build", "the", "future."];
let offset = startTime;
let accumulated = "";

words.forEach((word) => {
  const target = accumulated + (accumulated ? " " : "") + word;
  const newChars = target.length - accumulated.length;
  const typeDuration = newChars / 10;

  tl.to(
    "#typed-text",
    {
      text: { value: target },
      duration: typeDuration,
      ease: "none",
    },
    offset,
  );

  accumulated = target;
  offset += typeDuration + 0.3;
});
```

## Timing Guide

| Characters per second | Feel             | Good for                            |
| --------------------- | ---------------- | ----------------------------------- |
| 3-5                   | Slow, deliberate | Dramatic reveals, horror, suspense  |
| 8-12                  | Natural typing   | Dialogue, narration, conversational |
| 15-20                 | Fast, energetic  | Tech demos, code, rapid-fire        |
| 30+                   | Near-instant     | Filling long blocks of text quickly |

## HyperFrames Integration Notes

- `TextPlugin` must be registered with `gsap.registerPlugin(TextPlugin)` in each composition that uses it
- The `text` tween is deterministic — same input produces same output on every render
- Do not use `tl.call()` to set `textContent` directly — always use the `text` plugin so the timeline can seek correctly
- For sub-compositions, include the TextPlugin script tag in the sub-composition HTML, not just the root
