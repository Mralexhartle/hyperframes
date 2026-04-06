/**
 * Mount a Remotion composition inside a HyperFrames HTML composition.
 *
 * Uses @remotion/player to render the component and auto-registers
 * with window.__hfRemotion so HyperFrames' runtime adapter can seek it.
 *
 * Usage in a HyperFrames <script>:
 *
 *   import { mountRemotionComposition } from '@hyperframes/remotion-adapter';
 *   import { MyComposition } from './MyComposition';
 *
 *   mountRemotionComposition({
 *     container: document.getElementById('remotion-root'),
 *     component: MyComposition,
 *     durationInFrames: 300,
 *     fps: 30,
 *     inputProps: { title: 'Hello' },
 *   });
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MountOptions<Props extends Record<string, unknown> = Record<string, unknown>> {
  /** DOM element to render into */
  container: HTMLElement;
  /** Remotion composition component */
  component: React.ComponentType<Props>;
  /** Total frames in the composition */
  durationInFrames: number;
  /** Frames per second */
  fps: number;
  /** Composition width (default: 1920) */
  compositionWidth?: number;
  /** Composition height (default: 1080) */
  compositionHeight?: number;
  /** Props passed to the Remotion component */
  inputProps?: Props;
  /**
   * Auto-register with window.__hfRemotion (default: true).
   * Set to false for manual control only.
   */
  autoRegister?: boolean;
}

export interface MountResult {
  /** Seek to a specific frame */
  seekTo: (frame: number) => void;
  /** Pause playback */
  pause: () => void;
  /** Unmount the composition and clean up */
  destroy: () => void;
  /** Total frames */
  durationInFrames: number;
  /** Frames per second */
  fps: number;
}

// ── Internal bridge component ────────────────────────────────────────────────

interface BridgeProps {
  component: React.ComponentType<any>;
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  inputProps: Record<string, unknown>;
}

interface BridgeHandle {
  seekTo: (frame: number) => void;
  pause: () => void;
}

const RemotionBridge = forwardRef<BridgeHandle, BridgeProps>(function RemotionBridge(props, ref) {
  const playerRef = useRef<PlayerRef>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (frame: number) => {
      playerRef.current?.seekTo(frame);
    },
    pause: () => {
      playerRef.current?.pause();
    },
  }));

  // Pause on mount — HyperFrames drives the timeline
  useEffect(() => {
    playerRef.current?.pause();
  }, []);

  return (
    <Player
      ref={playerRef}
      component={props.component}
      durationInFrames={props.durationInFrames}
      compositionWidth={props.compositionWidth}
      compositionHeight={props.compositionHeight}
      fps={props.fps}
      inputProps={props.inputProps}
      style={{ width: "100%", height: "100%" }}
      controls={false}
      autoPlay={false}
      loop={false}
      allowFullscreen={false}
      clickToPlay={false}
      spaceKeyToPlayOrPause={false}
      moveToBeginningWhenEnded={false}
      showPosterWhenPaused={false}
      showPosterWhenEnded={false}
      showPosterWhenUnplayed={false}
    />
  );
});

// ── Public API ───────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __hfRemotion?: Array<{
      seekTo: (frame: number) => void;
      pause: () => void;
      durationInFrames: number;
      fps: number;
    }>;
  }
}

/**
 * Mount a Remotion composition into a DOM element and register it with
 * HyperFrames' runtime adapter for deterministic frame capture.
 */
export function mountRemotionComposition<
  Props extends Record<string, unknown> = Record<string, unknown>,
>(options: MountOptions<Props>): MountResult {
  const {
    container,
    component,
    durationInFrames,
    fps,
    compositionWidth = 1920,
    compositionHeight = 1080,
    inputProps = {} as Props,
    autoRegister = true,
  } = options;

  const bridgeRef = React.createRef<BridgeHandle>();
  let root: Root | null = createRoot(container);

  root.render(
    <RemotionBridge
      ref={bridgeRef}
      component={component as React.ComponentType<any>}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      inputProps={inputProps as Record<string, unknown>}
    />,
  );

  const result: MountResult = {
    seekTo: (frame: number) => {
      bridgeRef.current?.seekTo(frame);
    },
    pause: () => {
      bridgeRef.current?.pause();
    },
    destroy: () => {
      if (root) {
        root.unmount();
        root = null;
      }
      // Remove from __hfRemotion registry
      if (window.__hfRemotion) {
        const idx = window.__hfRemotion.indexOf(registration);
        if (idx >= 0) window.__hfRemotion.splice(idx, 1);
      }
    },
    durationInFrames,
    fps,
  };

  // Register with HyperFrames' runtime adapter
  const registration = {
    seekTo: result.seekTo,
    pause: result.pause,
    durationInFrames,
    fps,
  };

  if (autoRegister) {
    window.__hfRemotion = window.__hfRemotion || [];
    window.__hfRemotion.push(registration);
  }

  return result;
}
