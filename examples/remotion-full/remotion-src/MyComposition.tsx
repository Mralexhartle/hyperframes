import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TitleScene } from "./scenes/TitleScene";
import { DataScene } from "./scenes/DataScene";
import { OutroScene } from "./scenes/OutroScene";

/**
 * A real Remotion composition using standard Remotion primitives:
 * - AbsoluteFill for full-frame layers
 * - Sequence for timed scene transitions
 * - useCurrentFrame + interpolate + spring inside each scene
 *
 * This component works in both Remotion's renderer AND HyperFrames.
 */
export const MyComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f1a" }}>
      {/* Scene 1: Title — frames 0-89 (3s at 30fps) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Data viz — frames 75-179 (overlaps for transition) */}
      <Sequence from={75} durationInFrames={105}>
        <DataScene />
      </Sequence>

      {/* Scene 3: Outro — frames 165-269 */}
      <Sequence from={165} durationInFrames={105}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
