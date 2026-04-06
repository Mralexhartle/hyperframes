import type { RuntimeDeterministicAdapter } from "../types";

/**
 * Remotion adapter for HyperFrames
 *
 * Bridges Remotion compositions into HyperFrames' deterministic capture pipeline.
 * Remotion components run inside React; this adapter seeks them frame-by-frame
 * so HyperFrames' BeginFrame capture can snapshot each frame.
 *
 * ## Usage in a composition
 *
 * Bundle your Remotion component with React + a thin mount helper, then register:
 *
 * ```html
 * <div id="remotion-scene" data-start="0" data-duration="10" data-track-index="1">
 *   <div id="remotion-root"></div>
 * </div>
 * <script type="module">
 *   // After mounting your Remotion Player or custom root:
 *   window.__hfRemotion = window.__hfRemotion || [];
 *   window.__hfRemotion.push({
 *     // Seek to a specific frame number
 *     seekTo: (frame) => playerRef.current.seekTo(frame),
 *     // Pause playback
 *     pause: () => playerRef.current.pause(),
 *     // Total frames in the composition
 *     durationInFrames: 300,
 *     // Frames per second
 *     fps: 30,
 *   });
 * </script>
 * ```
 *
 * Multiple Remotion instances are supported — all are seeked in sync.
 *
 * ## How it works
 *
 * HyperFrames' runtime calls `seek({ time })` with a time in seconds.
 * This adapter converts seconds → frame number using the instance's fps,
 * then calls `seekTo(frame)` which triggers a React re-render at that frame.
 * HyperFrames' BeginFrame capture then snapshots the resulting DOM.
 */
export function createRemotionAdapter(): RuntimeDeterministicAdapter {
  return {
    name: "remotion",

    discover: () => {
      // Nothing to auto-discover — compositions register explicitly
      // via window.__hfRemotion.push(). This matches Remotion's model
      // where compositions are explicitly defined.
    },

    seek: (ctx) => {
      const time = Math.max(0, Number(ctx.time) || 0);
      const instances = (window as RemotionWindow).__hfRemotion;
      if (!instances || instances.length === 0) return;

      for (const instance of instances) {
        try {
          const fps = instance.fps || 30;
          const frame = Math.round(time * fps);
          const maxFrame = (instance.durationInFrames || Infinity) - 1;
          const clampedFrame = Math.min(frame, maxFrame);
          instance.seekTo(clampedFrame);
        } catch {
          // ignore per-instance failures — keep going for other instances
        }
      }
    },

    pause: () => {
      const instances = (window as RemotionWindow).__hfRemotion;
      if (!instances || instances.length === 0) return;

      for (const instance of instances) {
        try {
          instance.pause();
        } catch {
          // ignore
        }
      }
    },

    revert: () => {
      // Don't clear __hfRemotion — the instances are owned by the composition.
    },
  };
}

// ── Minimal type shapes (no remotion package dependency) ─────────────────────

interface RemotionInstance {
  seekTo: (frame: number) => void;
  pause: () => void;
  durationInFrames: number;
  fps: number;
}

interface RemotionWindow extends Window {
  __hfRemotion?: RemotionInstance[];
}
