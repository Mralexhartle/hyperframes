# hdr-regression

Comprehensive regression test that locks down end-to-end **HDR10 (BT.2020 PQ)**
rendering across the most common composition shapes that touch the layered HDR
compositing pipeline. Replaces the older single-shape `hdr-pq` and
`hdr-image-only` suites with a single 20-second timeline that exercises eight
windows back-to-back.

## What it covers

| Window | Time          | Shape                                     | Expected                |
| ------ | ------------- | ----------------------------------------- | ----------------------- |
| A      | 0.0 – 2.0 s   | Baseline HDR video + DOM overlay          | pass                    |
| B      | 2.0 – 4.5 s   | Wrapper opacity fade around HDR video     | pass                    |
| C      | 4.5 – 7.0 s   | Direct `<video>` opacity tween            | pass (fixed by Chunk 1) |
| D      | 7.0 – 9.5 s   | DOM → HDR → DOM z-order sandwich          | pass                    |
| E      | 9.5 – 12.0 s  | Two HDR videos side-by-side (same source) | pass                    |
| F      | 12.0 – 14.5 s | Transform + scale + border-radius         | **known fail (C4)**     |
| G      | 14.5 – 17.0 s | `object-fit: contain` letterbox           | pass                    |
| H      | 17.0 – 20.0 s | Shader transition (HDR video → HDR image) | pass                    |

The test pins the contract that:

- `extractVideoMetadata` reports `bt2020/smpte2084/full` for the HDR clip.
- `parseImageElements` discovers the HDR PQ PNG (window H) and
  `extractStillImageMetadata` reads its `cICP` chunk.
- `isHdrColorSpace` flips the orchestrator into the layered HDR path.
- The HDR sources are decoded once into `rgb48le` and blitted under the SDR
  DOM overlay on every frame.
- Wrapper-opacity (window B) and z-order sandwiches (window D) compose
  correctly through the layered pipeline.
- Multiple HDR sources (window E) deduplicate and decode as expected.
- The shader transition library (`@hyperframes/shader-transitions`,
  `cross-warp-morph`) drives `window.__hf.transitions`, the engine reads that
  metadata, and the CPU-bound shader compositor produces the expected
  `rgb48le` blend across the transition window.
- `hdrEncoder` writes HEVC Main10 / `yuv420p10le` / BT.2020 PQ with HDR10
  mastering display + content light level metadata.

## Known failures

Window **F** (transform + border-radius on the video itself) is intentionally
**expected to fail** until chunk 4 (transform + clipping pipeline) lands. Its
broken state is currently baked into the golden, so the suite is green; when
chunk 4 fixes the rendering path, the golden will be regenerated to match the
correct output.

Window **C** (direct `<video>` opacity) was previously known-failing — it is
now fixed by chunk 1 (videoFrameInjector + screenshotService no longer clobber
GSAP-controlled opacity), and the golden has been regenerated to match the
correct output. `maxFrameFailures` was tightened from 30 → 5 to leave only a
small budget for HEVC encoder noise; any drift larger than that will be
caught immediately.

## Fixtures

- `src/hdr-clip.mp4` — short HEVC Main10 / BT.2020 PQ clip with a moving
  bright gradient (see `NOTICE.md` for attribution). Reused across windows
  A–G and as scene A of the window-H shader transition.
- `src/hdr-photo-pq.png` — 256×144 16-bit RGB PNG with a hand-injected `cICP`
  chunk (primaries=BT.2020, transfer=SMPTE ST 2084, matrix=GBR, range=full).
  Used as scene B of the window-H shader transition.

ffmpeg is **not** used to generate the PNG because it does not embed `cICP`
in PNGs — without that chunk Chromium would not treat the file as HDR and the
test would silently fall back to SDR.

To regenerate the PNG fixture (deterministic, byte-for-byte stable):

```bash
python3 packages/producer/tests/hdr-regression/scripts/generate-hdr-photo-pq.py
```

## Running

```bash
cd packages/producer
bun run test hdr-regression

bun run test:update hdr-regression
```

In CI it runs in the `hdr` shard alongside `hdr-hlg-regression`
(see `.github/workflows/regression.yml`).
