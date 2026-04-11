/**
 * Feature detection for client-side rendering.
 */

export function isSupported(): boolean {
  return (
    typeof globalThis.VideoEncoder !== "undefined" &&
    typeof globalThis.OffscreenCanvas !== "undefined" &&
    typeof globalThis.AudioContext !== "undefined" &&
    typeof globalThis.createImageBitmap !== "undefined"
  );
}

export function isTurboSupported(): boolean {
  return (
    typeof BroadcastChannel !== "undefined" && typeof window?.open === "function" && isSupported()
  );
}

export function detectBestFrameSource(): "draw-element-image" | "tab-capture" | "snapdom" {
  if (
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype
  ) {
    return "draw-element-image";
  }
  if (
    typeof navigator?.mediaDevices?.getDisplayMedia === "function" &&
    typeof ImageCapture !== "undefined"
  ) {
    return "tab-capture";
  }
  return "snapdom";
}
