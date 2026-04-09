import { describe, it, expect } from "vitest";
import { generateFrameTimes, distributeFrames } from "./timing.js";

describe("generateFrameTimes", () => {
  it("generates correct frame times for 1s at 30fps", () => {
    const times = generateFrameTimes(1.0, 30);
    expect(times).toHaveLength(30);
    expect(times[0]).toBe(0);
    expect(times[1]).toBeCloseTo(1 / 30);
    expect(times[29]).toBeCloseTo(29 / 30);
  });

  it("generates correct frame times for 0.5s at 60fps", () => {
    const times = generateFrameTimes(0.5, 60);
    expect(times).toHaveLength(30);
    expect(times[0]).toBe(0);
  });

  it("returns empty array for zero duration", () => {
    expect(generateFrameTimes(0, 30)).toHaveLength(0);
  });
});

describe("distributeFrames", () => {
  it("distributes 10 frames across 3 workers", () => {
    const ranges = distributeFrames(10, 3);
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ start: 0, end: 3 });
    expect(ranges[1]).toEqual({ start: 4, end: 6 });
    expect(ranges[2]).toEqual({ start: 7, end: 9 });
    const totalFrames = ranges.reduce((s, r) => s + (r.end - r.start + 1), 0);
    expect(totalFrames).toBe(10);
  });

  it("handles fewer frames than workers", () => {
    const ranges = distributeFrames(2, 5);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 0, end: 0 });
    expect(ranges[1]).toEqual({ start: 1, end: 1 });
  });

  it("handles single worker", () => {
    const ranges = distributeFrames(100, 1);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 0, end: 99 });
  });
});
