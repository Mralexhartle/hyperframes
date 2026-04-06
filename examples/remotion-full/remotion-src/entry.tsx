/**
 * Browser entry point.
 *
 * This file gets bundled by esbuild into dist/bundle.js.
 * It mounts the Remotion composition using the HyperFrames adapter.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { MyComposition } from "./MyComposition";

const FPS = 30;
const DURATION_IN_FRAMES = 270; // 9 seconds

// Wait for DOM
function init() {
  const container = document.getElementById("remotion-root");
  if (!container) {
    console.error("[remotion-adapter] #remotion-root not found");
    return;
  }

  // We render the Player directly and grab the ref for seeking
  const playerRef = React.createRef<PlayerRef>();

  const root = createRoot(container);

  const Bridge: React.FC = () => {
    React.useEffect(() => {
      // Pause on mount — HyperFrames drives the timeline
      if (playerRef.current) {
        playerRef.current.pause();
      }
    }, []);

    return (
      <Player
        ref={playerRef}
        component={MyComposition}
        durationInFrames={DURATION_IN_FRAMES}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={FPS}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        autoPlay={false}
        loop={false}
        allowFullscreen={false}
        clickToPlay={false}
        spaceKeyToPlayOrPause={false}
        moveToBeginningWhenEnded={false}
      />
    );
  };

  root.render(<Bridge />);

  // Register with HyperFrames' Remotion adapter
  // Small delay to let React mount the Player
  requestAnimationFrame(() => {
    window.__hfRemotion = window.__hfRemotion || [];
    window.__hfRemotion.push({
      seekTo: (frame: number) => {
        playerRef.current?.seekTo(frame);
      },
      pause: () => {
        playerRef.current?.pause();
      },
      durationInFrames: DURATION_IN_FRAMES,
      fps: FPS,
    });
  });
}

// Type declaration for HyperFrames adapter
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
