import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Logo spring in
  const logoScale = spring({ frame, fps, config: { damping: 10, stiffness: 150 } });

  // CTA fade in
  const ctaOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaY = interpolate(frame, [20, 40], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rotating accent
  const rotation = interpolate(frame, [0, durationInFrames], [0, 180]);

  // Exit fade
  const exitOpacity = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "transparent",
        opacity: exitOpacity,
      }}
    >
      {/* Rotating accent ring */}
      <div
        style={{
          position: "absolute",
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: "3px solid rgba(139, 92, 246, 0.3)",
          borderTopColor: "#8b5cf6",
          transform: `rotate(${rotation}deg) scale(${logoScale})`,
        }}
      />

      {/* Logo text */}
      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.02em",
          transform: `scale(${logoScale})`,
        }}
      >
        HF
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: 140,
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#a78bfa",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          github.com/heygen-com/hyperframes
        </div>
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "system-ui, sans-serif",
            marginTop: 8,
          }}
        >
          Write HTML, render video.
        </div>
      </div>
    </AbsoluteFill>
  );
};
