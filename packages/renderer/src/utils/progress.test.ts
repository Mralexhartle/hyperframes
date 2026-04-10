import { describe, it, expect } from "vitest";
import { ProgressTracker } from "./progress.js";

describe("ProgressTracker", () => {
  it("estimates time remaining based on rate", () => {
    const tracker = new ProgressTracker(100);
    tracker.recordFrame(10, 1000);
    const eta = tracker.estimateTimeRemaining();
    expect(eta).toBeGreaterThan(8000);
    expect(eta).toBeLessThan(10000);
  });

  it("returns capture rate", () => {
    const tracker = new ProgressTracker(100);
    tracker.recordFrame(20, 2000);
    expect(tracker.captureRate()).toBeCloseTo(10, 0);
  });

  it("handles zero frames gracefully", () => {
    const tracker = new ProgressTracker(100);
    expect(tracker.estimateTimeRemaining()).toBeUndefined();
    expect(tracker.captureRate()).toBe(0);
  });
});
