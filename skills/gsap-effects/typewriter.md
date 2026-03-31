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

Add a cursor element that blinks while idle and holds steady while typing.

```html
<div style="display:inline-flex; align-items:baseline;">
  <div id="typed-text" style="font-size:48px; font-family:monospace; color:#fff;"></div>
  <div id="cursor" style="font-size:48px; font-family:monospace; color:#fff; opacity:1;">|</div>
</div>
```

```css
/* Blink animation — deterministic, CSS-driven */
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
  animation: blink 1s step-end infinite;
}
.cursor-solid {
  animation: none;
  opacity: 1;
}
```

```js
const text = "Hello, world!";
const cps = 10;
const duration = text.length / cps;
const cursor = document.querySelector("#cursor");

// Cursor blinks before typing starts
cursor.classList.add("cursor-blink");

// Stop blinking during typing
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

// Resume blinking after typing finishes
tl.call(
  () => {
    cursor.classList.replace("cursor-solid", "cursor-blink");
  },
  [],
  startTime + duration,
);
```

## Word Rotation

Type a word, clear it, type the next. Useful for taglines that cycle through options.

```js
const words = ["creative", "powerful", "simple"];
let offset = startTime;

words.forEach((word, i) => {
  const typeDuration = word.length / 10;
  const holdDuration = 1.5;
  const clearDuration = word.length / 20; // Clear is faster than typing

  // Type the word
  tl.to(
    "#typed-text",
    {
      text: { value: word },
      duration: typeDuration,
      ease: "none",
    },
    offset,
  );
  offset += typeDuration + holdDuration;

  // Clear the word (skip clear on the last word)
  if (i < words.length - 1) {
    tl.to(
      "#typed-text",
      {
        text: { value: "" },
        duration: clearDuration,
        ease: "none",
      },
      offset,
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
