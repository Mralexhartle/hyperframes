/**
 * drawElementImage Frame Source
 *
 * Uses the WICG html-in-canvas API to capture pixel-perfect frames.
 * The composition loads in an <iframe> that is a direct child of
 * <canvas layoutsubtree>. drawElementImage(iframe) captures the
 * browser's native compositor output — identical to BeginFrame.
 *
 * Requires: Chrome with --enable-blink-features=CanvasDrawElement
 */

import type { FrameSource, FrameSourceConfig, HfMediaElement } from "../types.js";

interface HfProtocol {
  duration: number;
  seek(time: number): void;
  media?: HfMediaElement[];
}

interface DrawElementImageCtx extends CanvasRenderingContext2D {
  drawElementImage(element: Element, dx: number, dy: number, dw?: number, dh?: number): DOMMatrix;
}

export class DrawElementImageFrameSource implements FrameSource {
  readonly name = "draw-element-image";

  private canvas: HTMLCanvasElement | null = null;
  private ctx: DrawElementImageCtx | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private config: FrameSourceConfig | null = null;
  private hf: HfProtocol | null = null;
  private _duration = 0;
  private _media: HfMediaElement[] = [];

  get duration(): number {
    return this._duration;
  }

  get media(): HfMediaElement[] {
    return this._media;
  }

  async init(config: FrameSourceConfig): Promise<void> {
    this.config = config;

    if (!("drawElementImage" in CanvasRenderingContext2D.prototype)) {
      throw new Error(
        "drawElementImage not available. Launch Chrome with --enable-blink-features=CanvasDrawElement",
      );
    }

    // Create <canvas layoutsubtree> with an <iframe> as direct child.
    // drawElementImage can render iframe elements — this gives us native
    // composition loading (proper script execution, document context)
    // plus pixel-perfect capture via the compositor.
    this.canvas = document.createElement("canvas");
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    this.canvas.setAttribute("layoutsubtree", "");
    this.canvas.style.position = "fixed";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.zIndex = "999999";
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d") as DrawElementImageCtx;
    if (!this.ctx) throw new Error("Failed to create 2D canvas context");

    // Create iframe as direct child of canvas
    this.iframe = document.createElement("iframe");
    this.iframe.style.width = `${config.width}px`;
    this.iframe.style.height = `${config.height}px`;
    this.iframe.style.border = "none";
    this.canvas.appendChild(this.iframe);

    // Load the composition
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Composition load timeout (15s)")), 15_000);
      this.iframe!.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.iframe!.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load composition: ${config.compositionUrl}`));
      };
      this.iframe!.src = config.compositionUrl;
    });

    // Wait for __hf protocol
    const hf = await this.waitForHfProtocol();
    this.hf = hf;
    this._duration = hf.duration;
    this._media = hf.media ?? [];
  }

  async capture(time: number): Promise<ImageBitmap> {
    if (!this.canvas || !this.ctx || !this.hf || !this.config || !this.iframe) {
      throw new Error("DrawElementImageFrameSource not initialized — call init() first");
    }

    this.hf.seek(time);

    // Yield to event loop + wait for compositor to render the seeked state
    await new Promise<void>((resolve) => setTimeout(resolve, 4));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    // Capture the iframe via drawElementImage — pixel-perfect compositor output
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);
    this.ctx.drawElementImage(this.iframe, 0, 0, this.config.width, this.config.height);

    return createImageBitmap(this.canvas);
  }

  async dispose(): Promise<void> {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.iframe = null;
    this.ctx = null;
    this.hf = null;
    this.config = null;
    this._duration = 0;
    this._media = [];
  }

  private waitForHfProtocol(timeoutMs = 15_000): Promise<HfProtocol> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = () => {
        const win = this.iframe?.contentWindow as (Window & { __hf?: HfProtocol }) | null;
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

export function isDrawElementImageSupported(): boolean {
  return (
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype
  );
}
