/**
 * Video Frame Injector
 *
 * For each <video> element in the composition, creates a canvas overlay
 * that displays the decoded video frame at the current composition time.
 * SnapDOM can capture <canvas> elements (unlike <video> via foreignObject).
 */

import type { HfMediaElement } from "../types.js";

interface VideoTrack {
  element: HfMediaElement;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export class VideoFrameInjector {
  private tracks: VideoTrack[] = [];
  private iframeDoc: Document | null = null;

  async init(media: HfMediaElement[], iframeDoc: Document): Promise<void> {
    this.iframeDoc = iframeDoc;
    const videoElements = media.filter((m) => {
      const el = iframeDoc.getElementById(m.elementId);
      return el?.tagName === "VIDEO";
    });

    for (const element of videoElements) {
      const videoEl = iframeDoc.getElementById(element.elementId) as HTMLVideoElement | null;
      if (!videoEl) continue;

      // Create a hidden video element for decoding
      const video = iframeDoc.createElement("video");
      video.src = element.src;
      video.muted = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.style.display = "none";
      iframeDoc.body.appendChild(video);

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => resolve(); // graceful — skip broken videos
        video.load();
      });

      // Create canvas overlay matching the video element's position
      const canvas = iframeDoc.createElement("canvas");
      const rect = videoEl.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.position = "absolute";
      canvas.style.left = `${rect.left}px`;
      canvas.style.top = `${rect.top}px`;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.style.zIndex = getComputedStyle(videoEl).zIndex || "1";
      canvas.style.pointerEvents = "none";

      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // Hide the original video element (SnapDOM can't capture it anyway)
      videoEl.style.visibility = "hidden";

      // Insert canvas as sibling
      videoEl.parentElement?.insertBefore(canvas, videoEl.nextSibling);

      this.tracks.push({ element, video, canvas, ctx });
    }
  }

  async injectFrame(compositionTime: number): Promise<void> {
    for (const track of this.tracks) {
      const { element, video, canvas, ctx } = track;

      // Is this video visible at this composition time?
      if (compositionTime < element.startTime || compositionTime >= element.endTime) {
        canvas.style.visibility = "hidden";
        continue;
      }
      canvas.style.visibility = "visible";

      // Calculate the video's local time
      const mediaOffset = element.mediaOffset ?? 0;
      const localTime = compositionTime - element.startTime + mediaOffset;

      // Seek the video to the correct time
      if (Math.abs(video.currentTime - localTime) > 0.01) {
        video.currentTime = localTime;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          setTimeout(resolve, 100); // safety timeout
        });
      }

      // Draw the current video frame onto the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }

  dispose(): void {
    for (const track of this.tracks) {
      track.video.remove();
      track.canvas.remove();
    }
    this.tracks = [];
    this.iframeDoc = null;
  }
}
