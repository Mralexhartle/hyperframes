# Turbo Render — Multi-Tab Parallel Capture

## Goal

Add a "Turbo" render mode that opens multiple browser tabs (via `window.open` with `noopener`) to achieve true multi-process parallelism for SnapDOM frame capture. Each tab gets its own renderer process with independent main thread + compositor, bypassing the single-thread bottleneck.

## Architecture

```
Studio (main tab)
  └── TurboPool (coordinator)
       ├── BroadcastChannel("hf-turbo-{sessionId}")
       ├── Opens N worker tabs (noopener, minimized offscreen)
       ├── Distributes frame ranges to workers
       ├── Receives PNG-encoded frames via BroadcastChannel
       ├── Decodes to ImageBitmap → reorder buffer → Encoder (existing Web Worker)
       └── Falls back to normal IframePool if popups blocked

Worker Tab (×N, separate renderer processes)
  └── turbo-worker.html
       ├── Listens on BroadcastChannel
       ├── Loads composition in hidden iframe (reuses SnapdomFrameSource)
       ├── Captures assigned frame range
       └── Sends PNG blob data back to coordinator via BroadcastChannel
```

## Concurrency Formula

```ts
const tabCount = Math.max(2, Math.min(Math.floor(navigator.hardwareConcurrency / 2), 6));
```

- 4-core machine: 2 tabs
- 8-core machine: 4 tabs
- 10-core machine: 5 tabs
- 12+ core machine: 6 tabs (cap)

## Communication Protocol

BroadcastChannel does not support transferable objects (ImageBitmap). Worker tabs encode captured frames as PNG blobs and send the base64 data URL via BroadcastChannel. The coordinator decodes back to ImageBitmap via `createImageBitmap(blob)`. The PNG round-trip adds ~5-10ms per frame but keeps the architecture simple and avoids SharedWorker complexity.

### Coordinator → Worker Messages

```ts
// Assign work to a specific worker
{ type: "init", workerId: string, compositionUrl: string, width: number, height: number, dpr: number }

// Capture these frames (contiguous range for this worker)
{ type: "capture", workerId: string, frames: { index: number, time: number }[] }

// Cancel all work
{ type: "abort" }
```

### Worker → Coordinator Messages

```ts
// Worker initialized, composition loaded, ready for frames
{ type: "ready", workerId: string }

// One captured frame (PNG blob as ArrayBuffer for efficiency)
{ type: "frame", workerId: string, index: number, png: ArrayBuffer }

// Worker encountered an error
{ type: "error", workerId: string, message: string }

// Worker finished all assigned frames
{ type: "done", workerId: string }
```

## Files

| File | Purpose |
|---|---|
| `src/capture/turbo-pool.ts` | TurboPool class — opens tabs, distributes frames, receives results, reorder buffer |
| `src/capture/turbo-worker.ts` | Entry point for worker tabs — BroadcastChannel listener, SnapDOM capture loop |
| `public/turbo-worker.html` | Minimal HTML page that loads the bundled worker script |
| `src/renderer.ts` | Add `turbo?: boolean` to RenderConfig, wire TurboPool as alternative to IframePool |
| `src/compat.ts` | Add `isTurboSupported()` — checks BroadcastChannel + popup capability |

## Studio UI

An opt-in "Turbo" toggle (lightning bolt icon) next to the existing Browser export button. When enabled, `useBrowserRender` passes `turbo: true` to the render config.

## Fallback

If `window.open()` returns `null` (popup blocked), TurboPool falls back to normal single-tab IframePool rendering with a console warning. The progress UI is identical in both modes.

## Frame Transfer Format

Worker tabs capture via SnapDOM → canvas → `canvas.toBlob('image/png')` → `ArrayBuffer` via `blob.arrayBuffer()` → send via BroadcastChannel. Coordinator receives ArrayBuffer → `new Blob([data], {type: 'image/png'})` → `createImageBitmap(blob)` → reorder buffer → encoder.

PNG chosen over JPEG for lossless quality. At 1080p, PNG frames are ~2-4MB each, well within BroadcastChannel limits.

## Expected Performance

- Normal mode: ~3-4 FPS (single main thread)
- Turbo mode (4 tabs): ~12-16 FPS (~4x speedup)
- Turbo mode (6 tabs): ~18-24 FPS (~6x speedup)
- 30s 1080p composition: ~4 min normal → ~1 min turbo (4 tabs)

## Limitations

- Popup blockers may prevent tab creation (graceful fallback)
- Each tab uses ~50-100MB RAM (4 tabs = 200-400MB extra)
- Worker tabs appear briefly before being positioned offscreen
- Audio mixing still happens in the coordinator tab (not parallelized, but is fast)
