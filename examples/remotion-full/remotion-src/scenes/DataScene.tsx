import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";

const STATS = [
  { label: "Render Speed", value: 150, suffix: "fps", color: "#8b5cf6" },
  { label: "File Size", value: 87, suffix: "%", sublabel: "smaller", color: "#06b6d4" },
  { label: "Frameworks", value: 2, suffix: "", sublabel: "unified", color: "#f59e0b" },
];

const StatCard: React.FC<{
  label: string;
  value: number;
  suffix: string;
  sublabel?: string;
  color: string;
  delay: number;
}> = ({ label, value, suffix, sublabel, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 180 } });
  const countTo = Math.round(
    interpolate(frame, [delay, delay + 40], [0, value], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: appear,
        transform: `scale(${appear}) translateY(${(1 - appear) * 30}px)`,
        width: 320,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          color,
          fontFamily: "system-ui, sans-serif",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {countTo}
        <span style={{ fontSize: 48 }}>{suffix}</span>
      </div>
      <div
        style={{
          fontSize: 24,
          color: "rgba(255,255,255,0.7)",
          fontFamily: "system-ui, sans-serif",
          marginTop: 8,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "system-ui, sans-serif",
            marginTop: 4,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};

export const DataScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Scene title
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
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
      <div
        style={{
          fontSize: 32,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "system-ui, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          marginBottom: 60,
          opacity: titleOpacity,
        }}
      >
        Why HyperFrames
      </div>

      <div style={{ display: "flex", gap: 80 }}>
        {STATS.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={i * 12 + 10} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
