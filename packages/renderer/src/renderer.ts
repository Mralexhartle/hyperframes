/**
 * HyperframesRenderer
 *
 * Main orchestrator for the client-side rendering pipeline.
 * Coordinates iframe pool, frame capture, encoding, audio mixing,
 * and muxing into a final MP4/WebM Blob.
 */

import { calculateConcurrency, IframePool } from "./capture/iframe-pool.js";
import { Encoder } from "./encoding/encoder.js";
import { SnapdomFrameSource } from "./sources/snapdom.js";
import { TabCaptureFrameSource, isTabCaptureSupported } from "./sources/tab-capture.js";
import {
  DrawElementImageFrameSource,
  isDrawElementImageSupported,
} from "./sources/draw-element-image.js";
import { mixAudio } from "./audio/mixer.js";
import { generateFrameTimes } from "./utils/timing.js";
import { ProgressTracker } from "./utils/progress.js";
import { isSupported, detectBestFrameSource } from "./compat.js";
import type {
  FrameSource,
  RenderConfig,
  RenderProgress,
  RenderResult,
  AudioSource,
  HfMediaElement,
} from "./types.js";

// ── Codec mapping ─────────────────────────────────────────────────────────────

const CODEC_MAP: Record<"h264" | "vp9", "avc1.640028" | "vp09.00.31.08"> = {
  h264: "avc1.640028",
  vp9: "vp09.00.31.08",
};

// ── Bitrate heuristic ─────────────────────────────────────────────────────────

function calculateBitrate(width: number, height: number): number {
  // 4 Mbps baseline for 1080p (1920×1080 = 2_073_600 pixels)
  const baselinePixels = 1920 * 1080;
  const pixels = width * height;
  return Math.round((4_000_000 * pixels) / baselinePixels);
}

// ── CancelledError ────────────────────────────────────────────────────────────

export class CancelledError extends Error {
  constructor() {
    super("Render cancelled");
    this.name = "CancelledError";
  }
}

// ── HyperframesRenderer ───────────────────────────────────────────────────────

export class HyperframesRenderer {
  private config: RenderConfig;
  private cancelled = false;
  private pool: IframePool | null = null;
  private tabCapture: TabCaptureFrameSource | null = null;
  private encoder: Encoder | null = null;
  private abortController: AbortController | null = null;

  constructor(config: RenderConfig) {
    this.config = config;
  }

  cancel(): void {
    this.cancelled = true;
    this.abortController?.abort();
  }

  async render(): Promise<RenderResult> {
    if (!isSupported()) {
      throw new Error(
        "Client-side rendering not supported. Requires WebCodecs (Chrome 94+, Firefox 130+, Safari 26+).",
      );
    }

    const totalStart = performance.now();
    this.cancelled = false;

    // ── Resolve config defaults ───────────────────────────────────────────────
    const fps = this.config.fps ?? 30;
    const width = this.config.width ?? 1920;
    const height = this.config.height ?? 1080;
    const format = this.config.format ?? "mp4";
    const codecKey = this.config.codec ?? "h264";
    const codec = CODEC_MAP[codecKey];
    const bitrate = this.config.bitrate ?? calculateBitrate(width, height);
    const concurrency =
      this.config.concurrency ??
      calculateConcurrency(typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4);
    const devicePixelRatio = this.config.devicePixelRatio ?? 1;

    const report = (progress: RenderProgress) => this.config.onProgress?.(progress);

    report({ stage: "initializing", progress: 0 });

    this.throwIfCancelled();

    // ── Step 1: Initialise frame source ────────────────────────────────────────
    const selectedSource = this.config.frameSource ?? detectBestFrameSource();
    const useDrawElement = selectedSource === "draw-element-image" && isDrawElementImageSupported();
    const useTabCapture =
      !useDrawElement && selectedSource === "tab-capture" && isTabCaptureSupported();
    // Single-source modes bypass the iframe pool (drawElementImage / tab-capture)
    const useSingleSource = useDrawElement || useTabCapture;
    let singleSource: FrameSource | null = null;

    let duration: number;
    let media: HfMediaElement[];

    if (useDrawElement) {
      // drawElementImage mode: pixel-perfect via html-in-canvas API
      const source = new DrawElementImageFrameSource();
      singleSource = source;
      await source.init({
        compositionUrl: this.config.composition,
        width,
        height,
        devicePixelRatio,
      });
      duration = source.duration;
      media = source.media;
    } else if (useTabCapture) {
      // Tab capture mode: single iframe, pixel-perfect via getDisplayMedia
      const source = new TabCaptureFrameSource();
      this.tabCapture = source;
      singleSource = source;
      await source.init({
        compositionUrl: this.config.composition,
        width,
        height,
        devicePixelRatio,
      });
      duration = source.duration;
      media = source.media;
    } else {
      // Iframe pool mode: parallel capture via SnapDOM
      const pool = new IframePool();
      this.pool = pool;
      const result = await pool.init({
        compositionUrl: this.config.composition,
        width,
        height,
        devicePixelRatio,
        concurrency,
        createFrameSource: () => new SnapdomFrameSource(),
      });
      duration = result.duration;
      media = result.media;
    }

    this.throwIfCancelled();

    // ── Step 2: Generate frame timestamps ─────────────────────────────────────
    const frameTimes = generateFrameTimes(duration, fps);
    const totalFrames = frameTimes.length;

    if (totalFrames === 0) {
      if (this.pool) await this.pool.dispose();
      if (this.tabCapture) await this.tabCapture.dispose();
      throw new Error("Composition has zero duration — nothing to render");
    }

    const progressTracker = new ProgressTracker(totalFrames);
    const abortController = new AbortController();
    this.abortController = abortController;

    // ── Pre-compute audio sources (needed for hasAudio flag) ─────────────────
    const audioSources: AudioSource[] = media
      .filter((m) => m.hasAudio === true)
      .map((m) => ({
        src: m.src,
        startTime: m.startTime,
        endTime: m.endTime,
        mediaOffset: m.mediaOffset,
        volume: m.volume,
      }));

    // ── Step 3: Initialise encoder ────────────────────────────────────────────
    // Track encoding separately — we only surface encoding progress after capture finishes
    let encodedCount = 0;
    let captureFinished = false;

    const encoder = new Encoder({
      width,
      height,
      fps,
      codec,
      bitrate,
      format,
      hasAudio: audioSources.length > 0,
      workerUrl: this.config.workerUrl,
      onFrameEncoded: (index) => {
        encodedCount = index + 1;
        // Only report encoding progress after capture is done to avoid
        // interleaved progress jumps (capture 5%→10% vs encoding 10%→70%)
        if (captureFinished) {
          report({
            stage: "encoding",
            progress: 0.5 + (encodedCount / totalFrames) * 0.2,
            currentFrame: encodedCount,
            totalFrames,
          });
        }
      },
    });
    this.encoder = encoder;

    await encoder.init();
    this.throwIfCancelled();

    // ── Step 4: Capture frames + stream to encoder with reorder buffer ─────────
    const captureStart = performance.now();

    report({ stage: "capturing", progress: 0.05, currentFrame: 0, totalFrames });

    // Reorder buffer: frames arrive out of order from parallel iframes.
    // We buffer them and flush runs of consecutive frames to the encoder.
    const reorderBuffer = new Map<number, ImageBitmap>();
    let nextExpected = 0;
    let capturedCount = 0;

    const frameDuration = 1 / fps;

    const flushBuffer = () => {
      while (reorderBuffer.has(nextExpected)) {
        const bitmap = reorderBuffer.get(nextExpected)!;
        reorderBuffer.delete(nextExpected);
        const timestamp = Math.round(nextExpected * frameDuration * 1_000_000); // microseconds
        encoder.sendFrame(bitmap, nextExpected, timestamp);
        nextExpected++;
      }
    };

    if (useSingleSource && singleSource) {
      // Single-source mode (drawElementImage or tab-capture): sequential, no reorder
      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) break;
        const bitmap = await singleSource.capture(frameTimes[i]!);
        const timestamp = Math.round(i * frameDuration * 1_000_000);
        encoder.sendFrame(bitmap, i, timestamp);
        capturedCount++;
        progressTracker.recordFrame(capturedCount, performance.now() - captureStart);
        report({
          stage: "capturing",
          progress: 0.05 + (capturedCount / totalFrames) * 0.45,
          currentFrame: capturedCount,
          totalFrames,
          estimatedTimeRemaining: progressTracker.estimateTimeRemaining(),
          captureRate: progressTracker.captureRate(),
        });
      }
    } else if (this.pool) {
      // Iframe pool mode: parallel capture with reorder buffer
      await this.pool.captureAll(
        frameTimes,
        ({ bitmap, index }) => {
          if (this.cancelled) {
            bitmap.close();
            return;
          }
          reorderBuffer.set(index, bitmap);
          capturedCount++;
          progressTracker.recordFrame(capturedCount, performance.now() - captureStart);
          report({
            stage: "capturing",
            progress: 0.05 + (capturedCount / totalFrames) * 0.45,
            currentFrame: capturedCount,
            totalFrames,
            estimatedTimeRemaining: progressTracker.estimateTimeRemaining(),
            captureRate: progressTracker.captureRate(),
          });
          flushBuffer();
        },
        abortController.signal,
      );
      flushBuffer();
    }

    captureFinished = true;
    // Flush any remaining encoding progress now that capture is done
    if (encodedCount < totalFrames) {
      report({
        stage: "encoding",
        progress: 0.5 + (encodedCount / totalFrames) * 0.2,
        currentFrame: encodedCount,
        totalFrames,
      });
    }

    const captureMs = performance.now() - captureStart;

    // Dispose capture resources
    if (singleSource) {
      await singleSource.dispose();
    }
    if (this.tabCapture) {
      await this.tabCapture.dispose();
      this.tabCapture = null;
    }
    if (this.pool) {
      await this.pool.dispose();
      this.pool = null;
    }

    this.throwIfCancelled();

    // ── Step 5: Mix audio ─────────────────────────────────────────────────────
    const audioStart = performance.now();

    report({ stage: "mixing-audio", progress: 0.7 });

    if (audioSources.length > 0) {
      const mixResult = await mixAudio({
        duration,
        sources: audioSources,
      });

      const channelData: Float32Array[] = [];
      for (let c = 0; c < mixResult.channels; c++) {
        channelData.push(mixResult.buffer.getChannelData(c));
      }
      encoder.setAudio(channelData, mixResult.sampleRate);
    }

    const audioMs = performance.now() - audioStart;

    this.throwIfCancelled();

    // ── Step 6: Mux video + audio ─────────────────────────────────────────────
    report({ stage: "muxing", progress: 0.85 });

    const encodeStart = performance.now();
    const blob = await encoder.finalize();
    const encodeMs = performance.now() - encodeStart;

    encoder.dispose();
    this.encoder = null;

    // ── Step 7: Return result ─────────────────────────────────────────────────
    const totalMs = performance.now() - totalStart;
    const framesPerSecond = totalFrames / (totalMs / 1000);
    const mimeType = format === "mp4" ? "video/mp4" : "video/webm";

    report({ stage: "complete", progress: 1, totalFrames });

    return {
      blob,
      mimeType,
      durationMs: totalMs,
      perf: {
        captureMs,
        encodeMs,
        audioMs,
        muxMs: encodeMs,
        totalMs,
        framesPerSecond,
      },
    };
  }

  private throwIfCancelled(): void {
    if (this.cancelled) {
      this.pool?.dispose().catch(() => {});
      this.tabCapture?.dispose().catch(() => {});
      this.encoder?.dispose();
      throw new CancelledError();
    }
  }
}
