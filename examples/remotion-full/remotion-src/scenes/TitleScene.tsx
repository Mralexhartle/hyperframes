import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title springs in
  const titleScale = spring({ frame, fps, config: { damping: 12, stiffness: 200 } });
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtitle fades in from below
  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleY = interpolate(frame, [15, 35], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Decorative line expands
  const lineWidth = interpolate(frame, [10, 40], [0, 400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "transparent",
      }}
    >
      {/* Decorative line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          backgroundColor: "#8b5cf6",
          borderRadius: 2,
          marginBottom: 32,
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: 80,
          fontWeight: 800,
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: "-0.03em",
          transform: `scale(${titleScale})`,
          opacity: titleOpacity,
        }}
      >
        Remotion + HyperFrames
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 36,
          color: "#a78bfa",
          fontFamily: "system-ui, sans-serif",
          marginTop: 20,
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
        }}
      >
        Full interoperability between frameworks
      </div>
    </AbsoluteFill>
  );
};
