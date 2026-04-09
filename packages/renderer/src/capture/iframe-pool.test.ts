import { describe, it, expect } from "vitest";
import { calculateConcurrency } from "./iframe-pool.js";

describe("calculateConcurrency", () => {
  it("returns at least 1", () => {
    expect(calculateConcurrency(0)).toBe(1);
  });

  it("caps at 8", () => {
    expect(calculateConcurrency(100)).toBeLessThanOrEqual(8);
  });

  it("leaves 1 core for encoding", () => {
    expect(calculateConcurrency(4)).toBe(3);
  });

  it("handles single-core", () => {
    expect(calculateConcurrency(1)).toBe(1);
  });
});
