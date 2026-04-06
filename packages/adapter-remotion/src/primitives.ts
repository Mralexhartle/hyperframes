/**
 * Standalone Remotion-compatible animation primitives.
 *
 * These work without @remotion/core installed. Use them to write
 * Remotion-style frame-driven animations in HyperFrames compositions.
 *
 * API-compatible with Remotion's interpolate() and spring().
 */

// ── interpolate ──────────────────────────────────────────────────────────────

type ExtrapolateType = "clamp" | "extend" | "identity";

interface InterpolateOptions {
  extrapolateLeft?: ExtrapolateType;
  extrapolateRight?: ExtrapolateType;
  easing?: (t: number) => number;
}

/**
 * Maps a value from one range to another, with optional clamping and easing.
 * API-compatible with Remotion's interpolate().
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: InterpolateOptions,
): number {
  if (inputRange.length !== outputRange.length) {
    throw new Error(
      `inputRange (${inputRange.length}) and outputRange (${outputRange.length}) must have the same length`,
    );
  }
  if (inputRange.length < 2) {
    throw new Error("inputRange and outputRange must have at least 2 elements");
  }

  const { extrapolateLeft = "clamp", extrapolateRight = "clamp", easing } = options ?? {};

  // Find the segment
  let segmentIndex = 0;
  for (let i = 0; i < inputRange.length - 1; i++) {
    if (input >= inputRange[i]!) {
      segmentIndex = i;
    }
  }
  segmentIndex = Math.min(segmentIndex, inputRange.length - 2);

  const inputLow = inputRange[segmentIndex]!;
  const inputHigh = inputRange[segmentIndex + 1]!;
  const outputLow = outputRange[segmentIndex]!;
  const outputHigh = outputRange[segmentIndex + 1]!;

  let t = inputHigh === inputLow ? 0 : (input - inputLow) / (inputHigh - inputLow);

  // Handle extrapolation
  if (t < 0) {
    if (extrapolateLeft === "clamp") t = 0;
    else if (extrapolateLeft === "identity") return input;
  }
  if (t > 1) {
    if (extrapolateRight === "clamp") t = 1;
    else if (extrapolateRight === "identity") return input;
  }

  // Apply easing
  if (easing && t >= 0 && t <= 1) {
    t = easing(t);
  }

  return outputLow + t * (outputHigh - outputLow);
}

// ── spring ───────────────────────────────────────────────────────────────────

interface SpringConfig {
  damping?: number;
  mass?: number;
  stiffness?: number;
  overshootClamping?: boolean;
}

interface SpringOptions {
  frame: number;
  fps: number;
  config?: SpringConfig;
  from?: number;
  to?: number;
  durationInFrames?: number;
  durationRestThreshold?: number;
  delay?: number;
}

/**
 * Physics-based spring animation.
 * API-compatible with Remotion's spring().
 */
export function spring(options: SpringOptions): number {
  const { frame, fps, config = {}, from = 0, to = 1, delay = 0 } = options;

  const { damping = 10, mass = 1, stiffness = 100, overshootClamping = false } = config;

  const adjustedFrame = frame - delay;
  if (adjustedFrame < 0) return from;

  const dt = 1 / fps;
  let position = 0; // displacement from target (starts at `from - to`)
  let velocity = 0;
  const displacement = from - to;
  position = displacement;

  // Simulate the spring physics
  const steps = Math.max(0, Math.ceil(adjustedFrame));
  for (let i = 0; i < steps; i++) {
    const springForce = -stiffness * position;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;
    velocity += acceleration * dt;
    position += velocity * dt;

    if (overshootClamping) {
      if ((from < to && position + to > to) || (from > to && position + to < to)) {
        position = 0;
        velocity = 0;
      }
    }
  }

  return to + position;
}

// ── Easing functions ─────────────────────────────────────────────────────────

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => cubicBezier(0.25, 0.1, 0.25, 1, t),
  easeIn: (t: number) => cubicBezier(0.42, 0, 1, 1, t),
  easeOut: (t: number) => cubicBezier(0, 0, 0.58, 1, t),
  easeInOut: (t: number) => cubicBezier(0.42, 0, 0.58, 1, t),
  bezier: (x1: number, y1: number, x2: number, y2: number) => (t: number) =>
    cubicBezier(x1, y1, x2, y2, t),
} as const;

function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  // Newton-Raphson approximation
  let x = t;
  for (let i = 0; i < 8; i++) {
    const bx = bezierPoint(x1, x2, x) - t;
    const dbx = bezierDerivative(x1, x2, x);
    if (Math.abs(bx) < 1e-6) break;
    x -= bx / dbx;
  }
  return bezierPoint(y1, y2, x);
}

function bezierPoint(p1: number, p2: number, t: number): number {
  return 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
}

function bezierDerivative(p1: number, p2: number, t: number): number {
  return 3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2);
}
