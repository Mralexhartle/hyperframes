# Remotion + HyperFrames Interop Guide

Use Remotion compositions inside HyperFrames, or HyperFrames compositions inside Remotion. No rewrites — both frameworks render in the same video.

## Quick start

### Use a Remotion composition in HyperFrames

```bash
# 1. Create a HyperFrames project
npx hyperframes init my-video

# 2. In a subdirectory, set up your Remotion code
mkdir remotion-src && cd remotion-src
npm init -y
npm install remotion @remotion/player react react-dom esbuild

# 3. Write your Remotion component (see examples below)
# 4. Bundle it for the browser
npx esbuild entry.tsx --bundle --outfile=../dist/bundle.js \
  --format=iife --platform=browser --target=es2020 \
  --jsx=automatic --minify \
  --define:process.env.NODE_ENV='"production"'

# 5. Reference the bundle in your HyperFrames index.html
# 6. Render
cd ..
npx hyperframes render
```

---

## Using Remotion compositions in HyperFrames

### How it works

HyperFrames has a **Remotion runtime adapter** that discovers Remotion instances registered on `window.__hfRemotion` and seeks them frame-by-frame during capture. This is the same mechanism HyperFrames uses for GSAP, Lottie, Three.js, and CSS animations — the adapter converts HyperFrames' time-based seeks into Remotion's frame-based seeks.

```
HyperFrames capture engine
  │
  ├─ GSAP adapter     → timeline.seek(time)
  ├─ Lottie adapter   → anim.goToAndStop(time)
  ├─ Remotion adapter  → player.seekTo(frame)  ← new
  └─ ...
```

### Step 1: Write your Remotion component

Write a standard Remotion composition. It uses `useCurrentFrame`, `interpolate`, `spring`, `Sequence`, `AbsoluteFill` — all the real `@remotion/core` APIs. This component works in both Remotion's renderer and HyperFrames.

```tsx
// remotion-src/MyComposition.tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Sequence } from "remotion";

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 72, fontWeight: 800, color: "#fff", transform: `scale(${scale})`, opacity }}>
        Hello from Remotion
      </div>
    </AbsoluteFill>
  );
};

export const MyComposition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
    <Sequence from={0} durationInFrames={90}>
      <TitleCard />
    </Sequence>
  </AbsoluteFill>
);
```

### Step 2: Create the browser entry point

This file mounts the Remotion Player and registers it with HyperFrames.

```tsx
// remotion-src/entry.tsx
import React, { useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { MyComposition } from "./MyComposition";

const FPS = 30;
const DURATION_IN_FRAMES = 90; // 3 seconds

function App() {
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    // Pause on mount — HyperFrames drives the timeline
    playerRef.current?.pause();

    // Register with HyperFrames' Remotion adapter
    window.__hfRemotion = window.__hfRemotion || [];
    window.__hfRemotion.push({
      seekTo: (frame: number) => playerRef.current?.seekTo(frame),
      pause: () => playerRef.current?.pause(),
      durationInFrames: DURATION_IN_FRAMES,
      fps: FPS,
    });
  }, []);

  return (
    <Player
      ref={playerRef}
      component={MyComposition}
      durationInFrames={DURATION_IN_FRAMES}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={FPS}
      style={{ width: "100%", height: "100%" }}
      controls={false}
      autoPlay={false}
      loop={false}
      clickToPlay={false}
    />
  );
}

const root = createRoot(document.getElementById("remotion-root")!);
root.render(<App />);
```

### Step 3: Bundle for the browser

```bash
npx esbuild remotion-src/entry.tsx --bundle --outfile=dist/bundle.js \
  --format=iife --platform=browser --target=es2020 \
  --jsx=automatic --minify \
  --define:process.env.NODE_ENV='"production"'
```

This produces a single JS file containing React, Remotion Player, and your composition.

### Step 4: Use in HyperFrames HTML

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My Video</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <style>
      body, html { margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden; }
    </style>
  </head>
  <body>
    <div
      id="main-canvas"
      data-composition-id="my-video"
      data-width="1920"
      data-height="1080"
      data-duration="3"
    >
      <!-- Track 0: GSAP background (native HyperFrames) -->
      <div id="bg" class="clip" data-start="0" data-duration="3" data-track-index="0"
           style="position:absolute;inset:0;background:#0a0a0a;">
      </div>

      <!-- Track 1: Remotion composition -->
      <div id="remotion-layer" class="clip" data-start="0" data-duration="3" data-track-index="1"
           style="position:absolute;inset:0;">
        <div id="remotion-root" style="width:1920px;height:1080px;"></div>
      </div>

      <!-- Track 2: GSAP text overlay (native HyperFrames) -->
      <div id="overlay" class="clip" data-start="0" data-duration="3" data-track-index="2"
           style="position:absolute;bottom:40px;width:1920px;text-align:center;">
        <div id="overlay-inner" style="opacity:0;">
          <span style="font-family:monospace;font-size:16px;color:rgba(255,255,255,0.3);">
            REMOTION + GSAP + HYPERFRAMES
          </span>
        </div>
      </div>

      <script>
        const tl = gsap.timeline({ paused: true });
        tl.to('#overlay-inner', { opacity: 1, duration: 1, ease: 'power2.out' }, 0.5);
        window.__timelines = window.__timelines || {};
        window.__timelines['my-video'] = tl;
      </script>

      <!-- Load the bundled Remotion composition -->
      <script src="dist/bundle.js"></script>
    </div>
  </body>
</html>
```

### Step 5: Render

```bash
npx hyperframes lint
npx hyperframes render --fps 30
```

### Mixing GSAP and Remotion

GSAP and Remotion layers coexist in the same composition. HyperFrames seeks both adapters in sync on every frame:

- Use **GSAP** for backgrounds, overlays, captions, motion graphics
- Use **Remotion** for complex procedural animations, data-driven content, anything that benefits from React's component model
- Use **both** in the same frame — they render independently on separate tracks

---

## Using HyperFrames compositions in Remotion

You can embed a HyperFrames HTML composition inside a Remotion project using an iframe.

### How it works

HyperFrames' runtime listens for `postMessage` control messages (this is how the HyperFrames studio works). A Remotion component can load a HyperFrames composition in an iframe and seek it by posting messages on each frame.

### The Remotion component

```tsx
// src/HyperFramesLayer.tsx
import React, { useRef, useEffect, useCallback } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

interface HyperFramesLayerProps {
  /** URL serving the HyperFrames composition (e.g., http://localhost:3002) */
  src: string;
  /** Width of the HyperFrames composition */
  width?: number;
  /** Height of the HyperFrames composition */
  height?: number;
}

export const HyperFramesLayer: React.FC<HyperFramesLayerProps> = ({
  src,
  width = 1920,
  height = 1080,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Seek the HyperFrames composition to the current frame
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage(
      {
        source: "hf-parent",
        type: "control",
        action: "seek",
        frame,
        seekMode: "commit",
      },
      "*",
    );
  }, [frame]);

  // Pause on mount
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const onLoad = () => {
      iframe.contentWindow!.postMessage(
        { source: "hf-parent", type: "control", action: "pause" },
        "*",
      );
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, []);

  return (
    <AbsoluteFill>
      <iframe
        ref={iframeRef}
        src={src}
        width={width}
        height={height}
        style={{
          border: "none",
          width: "100%",
          height: "100%",
        }}
      />
    </AbsoluteFill>
  );
};
```

### Usage in a Remotion composition

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { HyperFramesLayer } from "./HyperFramesLayer";

// 1. Start the HyperFrames preview server:
//    npx hyperframes preview my-hf-project --port 3002

// 2. Use it in your Remotion composition:
export const MyVideo: React.FC = () => (
  <HyperFramesLayer src="http://localhost:3002" />
);

export const Root: React.FC = () => (
  <Composition
    id="MyVideo"
    component={MyVideo}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

### Workflow

```bash
# Terminal 1: Start HyperFrames preview
npx hyperframes preview my-hf-project --port 3002

# Terminal 2: Start Remotion studio
npx remotion studio
```

> **Note:** For Remotion's server-side rendering (`npx remotion render`), the iframe approach requires the HyperFrames preview server to be running. For production use, consider converting HyperFrames compositions to Remotion components instead.

---

## The adapter registration contract

The entire bridge between Remotion and HyperFrames is this interface:

```typescript
interface RemotionInstance {
  seekTo: (frame: number) => void;
  pause: () => void;
  durationInFrames: number;
  fps: number;
}

// Register in your browser script:
window.__hfRemotion = window.__hfRemotion || [];
window.__hfRemotion.push(instance);
```

HyperFrames' runtime adapter discovers these instances and calls `seekTo(frame)` during capture. That's the entire protocol.

### Multiple Remotion compositions

You can mount multiple Remotion compositions in the same HyperFrames project. Each one registers independently:

```html
<div id="scene-a" class="clip" data-start="0" data-duration="3" data-track-index="1">
  <div id="remotion-root-a" style="width:1920px;height:1080px;"></div>
</div>
<div id="scene-b" class="clip" data-start="3" data-duration="3" data-track-index="1">
  <div id="remotion-root-b" style="width:1920px;height:1080px;"></div>
</div>
```

Each bundle registers its own `__hfRemotion` entry. The adapter seeks all instances in sync.

---

## When to use which

| Scenario | Use |
|----------|-----|
| New project, simple animations | HyperFrames (HTML + GSAP) |
| Complex procedural/data-driven animation | Remotion (React) |
| Existing Remotion project, want HyperFrames rendering | Remotion adapter (this guide) |
| Existing HyperFrames project, want to add React components | Remotion adapter (this guide) |
| Captions, overlays on top of Remotion content | GSAP layers + Remotion layer in same HyperFrames composition |
| Gradual migration from Remotion | Start with adapter, rewrite scenes one at a time |

## Project structure

A typical hybrid project:

```
my-video/
  index.html              ← HyperFrames composition (orchestration)
  compositions/
    captions.html          ← Native HyperFrames captions
  remotion-src/
    MyComposition.tsx      ← Remotion component
    entry.tsx              ← Browser entry point
    package.json           ← Remotion + React deps
  dist/
    bundle.js              ← Bundled Remotion (generated)
  assets/
    audio.mp3
```

HyperFrames handles orchestration, captions, backgrounds, and rendering. Remotion handles complex animated scenes. Both render in the same video.
