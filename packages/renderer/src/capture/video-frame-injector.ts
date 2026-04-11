/**
 * Video Frame Injector
 *
 * Seeks each <video> element in the composition to the correct frame
 * before SnapDOM captures the DOM. SnapDOM natively handles <video>
 * elements by drawing them to a temp canvas via drawImage(), so we
 * just need to ensure the video is at the right currentTime with
 * the frame fully decoded.
 */

import type { HfMediaElement } from "../types.js";

interface VideoTrack {
  element: HfMediaElement;
  videoEl: HTMLVideoElement;
}

export class VideoFrameInjector {
  private tracks: VideoTrack[] = [];

  async init(media: HfMediaElement[], iframeDoc: Document): Promise<void> {
    const videoElements = media.filter((m) => {
      const el = iframeDoc.getElementById(m.elementId);
      return el?.tagName === "VIDEO";
    });

    for (const element of videoElements) {
      const videoEl = iframeDoc.getElementById(element.elementId) as HTMLVideoElement | null;
      if (!videoEl) continue;

      // Ensure the video is loaded and paused for frame-accurate seeking
      videoEl.muted = true;
      videoEl.pause();
      videoEl.preload = "auto";

      if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve) => {
          videoEl.onloadeddata = () => resolve();
          videoEl.onerror = () => resolve();
          // Trigger load if not started
          if (videoEl.readyState === 0) videoEl.load();
          else setTimeout(resolve, 2000);
        });
      }

      this.tracks.push({ element, videoEl });
    }
  }

  async injectFrame(compositionTime: number): Promise<void> {
    const seekPromises: Promise<void>[] = [];

    for (const track of this.tracks) {
      const { element, videoEl } = track;

      // Is this video visible at this composition time?
      if (compositionTime < element.startTime || compositionTime >= element.endTime) {
        continue;
      }

      // Calculate the video's local time
      const mediaOffset = element.mediaOffset ?? 0;
      const localTime = compositionTime - element.startTime + mediaOffset;

      // Always seek — the runtime uses a 0.3s tolerance which skips most frames
      seekPromises.push(this.seekVideo(videoEl, localTime));
    }

    await Promise.all(seekPromises);
  }

  private seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
    // Skip if already at the exact time (within one frame at 60fps)
    if (Math.abs(video.currentTime - time) < 0.008) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const TIMEOUT = 2000;
      let settled = false;

      const done = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };

      const onSeeked = () => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          done();
        } else {
          // Frame not decoded yet — poll until ready.
          // Uses setTimeout so it works in background tabs.
          const poll = () => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              done();
            } else {
              setTimeout(poll, 4);
            }
          };
          setTimeout(poll, 4);
        }
      };

      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = time;
      setTimeout(done, TIMEOUT);
    });
  }

  dispose(): void {
    this.tracks = [];
  }
}
