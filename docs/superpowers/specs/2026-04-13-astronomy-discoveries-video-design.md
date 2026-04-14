# Astronomy Discoveries Video — Design Spec

## Overview

A 50-second cinematic short-form video (1920x1080) counting down the 4 most exciting astronomical discoveries of the past 20 years. Voiceover narration with bold text reveals and GSAP-animated supporting graphics. Dark, epic tone — deep space aesthetic.

## Content

### Discoveries (countdown order)

| Rank | Discovery | Year | Hook |
|------|-----------|------|------|
| #4 | Gravitational Waves (LIGO) | 2015 | "We heard the universe for the first time" |
| #3 | Water on Mars (NASA) | 2015 | "Life's ingredient, right next door" |
| #2 | First Black Hole Image (EHT) | 2019 | "The impossible, made visible" |
| #1 | James Webb Deep Field | 2022 | "We looked back to the beginning of time" |

### Voiceover Script (~65 words)

> *[Intro]* "In twenty years, we've seen things no human ever imagined."
>
> *[#4]* "In 2015, LIGO detected gravitational waves — we heard the universe for the first time."
>
> *[#3]* "That same year, NASA confirmed water on Mars. Life's ingredient, right next door."
>
> *[#2]* "In 2019, we photographed a black hole. The impossible, made visible."
>
> *[#1]* "And in 2022, James Webb looked back 13 billion years — to the beginning of time."
>
> *[Outro]* "What will we see next?"

## Visual Design

### Color Palette

- Background: near-black (#0A0A12)
- Primary text: white (#FFFFFF)
- Accent glow: electric blue (#4D9FFF)
- Warm accent: gold (#FFB830)

### Typography

- Countdown numbers: bold sans-serif, oversized (fills ~60% of frame)
- Discovery titles: bold sans-serif, large
- Supporting text: lighter weight of same family

### Animation Pattern (per discovery, ~10s each)

1. Countdown number slams in from scale 0 → full with glow pulse (0.3s)
2. Number shrinks and slides up, title text fades in below (0.5s)
3. Supporting graphic element fades in behind (0.5s)
4. Hold for voiceover duration
5. Quick fade-to-black transition (0.3s)

### Supporting Graphics (CSS/GSAP, no external images)

- **Gravitational Waves:** animated concentric ripple rings expanding outward
- **Water on Mars:** subtle particle drift (water/ice feel)
- **Black Hole:** radial gradient glow with accretion disk ring
- **JWST Deep Field:** scattered dot-stars that slowly drift

## Architecture

### Project Structure

```
astronomy-discoveries/
  src/
    index.html              — orchestrator (timeline, audio, 1920x1080)
    compositions/
      intro.html            — "The Universe Changed" title slam
      countdown.html        — 4 discovery reveals in sequence
      outro.html            — "What will we see next?" closer
  audio/
    narration.wav           — TTS output (af_heart, speed 0.95)
```

### Timeline

| Time | Composition | Content |
|------|-------------|---------|
| 0-3s | intro | Title slam + intro voiceover |
| 3-13s | countdown | #4 Gravitational Waves |
| 13-23s | countdown | #3 Water on Mars |
| 23-33s | countdown | #2 Black Hole Image |
| 33-45s | countdown | #1 JWST Deep Field (longer hold) |
| 45-50s | outro | Closing line + fade to black |

### Technical Notes

- All timed elements use `class="clip"`
- GSAP timeline registered via `window.__GSAP_TIMELINE`
- Sub-compositions keep concerns separated (intro/countdown/outro)
- countdown.html uses GSAP timeline labels for each discovery segment
- Resolution: 1920x1080 (landscape)
- Frame rate: 30fps

## Audio

- **Voice:** HyperFrames TTS, `af_heart` voice, speed 0.95
- **Music:** Not included (user can add a dramatic track separately)

## Out of Scope

- Background music/soundtrack (licensing concern)
- External image assets (all graphics are CSS/GSAP generated)
- Captions/subtitles (voiceover only)
