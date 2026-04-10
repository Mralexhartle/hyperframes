/**
 * Tab Capture Frame Source
 *
 * Uses getDisplayMedia({ preferCurrentTab: true }) to capture pixel-perfect
 * frames from Chrome's actual compositor output. This produces identical
 * output to BeginFrame because it reads the same compositor pixels.
 *
 * Requires a user gesture (clicking a "Render" button) to acquire the
 * capture stream. After that, frame capture is fully automated.
 *
 * Browser support: Chrome 107+ (preferCurrentTab), Firefox (with picker).
 * Falls back to SnapDOM if getDisplayMedia is denied or unavailable.
 */

import type { FrameSource, FrameSourceConfig, HfMediaElement } from "../types.js";

// ImageCapture is in the spec but not all TS lib versions include grabFrame().
// We declare our own interface to avoid type errors.
interface GrabCapture {
  grabFrame(): Promise<ImageBitmap>;
}
function createGrabCapture(track: MediaStreamTrack): GrabCapture {
  return new (
    globalThis as unknown as { ImageCapture: new (t: MediaStreamTrack) => GrabCapture }
  ).ImageCapture(track);
}

interface HfProtocol {
  duration: number;
  seek(time: number): void;
  media?: HfMediaElement[];
}

export class TabCaptureFrameSource implements FrameSource {
  readonly name = "tab-capture";

  private iframe: HTMLIFrameElement | null = null;
  private config: FrameSourceConfig | null = null;
  private hf: HfProtocol | null = null;
  private _duration = 0;
  private _media: HfMediaElement[] = [];
  private stream: MediaStream | null = null;
  private imageCapture: GrabCapture | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private captureCtx: CanvasRenderingContext2D | null = null;

  get duration(): number {
    return this._duration;
  }

  get media(): HfMediaElement[] {
    return this._media;
  }

  async init(config: FrameSourceConfig): Promise<void> {
    this.config = config;

    // Create the iframe — must be VISIBLE for tab capture to see it.
    // Position it to fill the viewport exactly.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = `${config.width}px`;
    iframe.style.height = `${config.height}px`;
    iframe.style.border = "none";
    iframe.style.zIndex = "999999";
    document.body.appendChild(iframe);
    this.iframe = iframe;

    // Load the composition
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Composition load timeout (10s)")), 10_000);
      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load composition: ${config.compositionUrl}`));
      };
      iframe.src = config.compositionUrl;
    });

    // Wait for __hf protocol
    const hf = await this.waitForHfProtocol(iframe);
    this.hf = hf;
    this._duration = hf.duration;
    this._media = hf.media ?? [];

    // Acquire tab capture stream.
    // preferCurrentTab auto-selects this tab without the picker dialog (Chrome 107+).
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
        width: { ideal: config.width },
        height: { ideal: config.height },
        frameRate: { ideal: 60 },
      },
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      systemAudio: "exclude",
    } as DisplayMediaStreamOptions);

    const track = this.stream.getVideoTracks()[0];
    if (!track) {
      throw new Error("No video track from getDisplayMedia");
    }

    this.imageCapture = createGrabCapture(track);

    // Create an offscreen canvas for cropping frames to the iframe region
    this.captureCanvas = document.createElement("canvas");
    this.captureCanvas.width = config.width;
    this.captureCanvas.height = config.height;
    this.captureCtx = this.captureCanvas.getContext("2d");
  }

  async capture(time: number): Promise<ImageBitmap> {
    if (!this.iframe || !this.hf || !this.config || !this.imageCapture || !this.captureCtx) {
      throw new Error("TabCaptureFrameSource not initialized — call init() first");
    }

    // Seek the composition to the target time
    this.hf.seek(time);

    // Wait for the compositor to render the new frame.
    // Two rAF cycles: one for the JS update, one for the compositor.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    // Grab the current frame from the capture stream
    const bitmap = await this.imageCapture.grabFrame();

    // The captured bitmap is the full tab viewport. Crop to the iframe area.
    // Since the iframe is positioned at (0,0) and sized to match the composition,
    // we draw the captured bitmap and crop to the composition dimensions.
    const dpr = window.devicePixelRatio || 1;
    const srcWidth = this.config.width * dpr;
    const srcHeight = this.config.height * dpr;

    this.captureCtx.clearRect(0, 0, this.config.width, this.config.height);
    this.captureCtx.drawImage(
      bitmap,
      0,
      0,
      srcWidth,
      srcHeight, // source rect (top-left of tab, at device pixel ratio)
      0,
      0,
      this.config.width,
      this.config.height, // dest rect
    );
    bitmap.close();

    return createImageBitmap(this.captureCanvas!);
  }

  async dispose(): Promise<void> {
    // Stop the capture stream
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.imageCapture = null;
    this.captureCanvas = null;
    this.captureCtx = null;

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.hf = null;
    this.config = null;
    this._duration = 0;
    this._media = [];
  }

  private waitForHfProtocol(iframe: HTMLIFrameElement, timeoutMs = 10_000): Promise<HfProtocol> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = () => {
        const win = iframe.contentWindow as (Window & { __hf?: HfProtocol }) | null;
        if (win?.__hf && typeof win.__hf.seek === "function" && win.__hf.duration > 0) {
          resolve(win.__hf);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for window.__hf protocol"));
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
    });
  }
}

/**
 * Check if Tab Capture is available.
 * Requires getDisplayMedia and ImageCapture APIs.
 */
export function isTabCaptureSupported(): boolean {
  return (
    typeof navigator?.mediaDevices?.getDisplayMedia === "function" &&
    typeof ImageCapture !== "undefined"
  );
}
