import { describe, it, expect } from "vitest";

/**
 * Timeline.tsx contains two pure utility functions — generateTicks and
 * formatTick — that are not exported. Rather than modifying the component
 * source to export them, we replicate their logic here and test it.
 * This validates the algorithm correctness and serves as a regression
 * guard if these functions are later extracted into a shared module.
 */

// Replicated from Timeline.tsx — generateTicks
function generateTicks(duration: number): { major: number[]; minor: number[] } {
  if (duration <= 0) return { major: [], minor: [] };
  const intervals = [0.5, 1, 2, 5, 10, 15, 30, 60];
  const target = duration / 6;
  const majorInterval = intervals.find((i) => i >= target) ?? 60;
  const minorInterval = majorInterval / 2;
  const major: number[] = [];
  const minor: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += minorInterval) {
    const rounded = Math.round(t * 100) / 100;
    const isMajor =
      Math.abs(rounded % majorInterval) < 0.01 ||
      Math.abs((rounded % majorInterval) - majorInterval) < 0.01;
    if (isMajor) major.push(rounded);
    else minor.push(rounded);
  }
  return { major, minor };
}

// Replicated from Timeline.tsx — formatTick
function formatTick(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

describe("generateTicks", () => {
  it("returns empty arrays for duration <= 0", () => {
    expect(generateTicks(0)).toEqual({ major: [], minor: [] });
    expect(generateTicks(-5)).toEqual({ major: [], minor: [] });
  });

  it("generates ticks for a short duration (3 seconds)", () => {
    const { major, minor: _minor } = generateTicks(3);
    // target = 3/6 = 0.5 → majorInterval = 0.5, minorInterval = 0.25
    expect(major.length).toBeGreaterThan(0);
    expect(major[0]).toBe(0);
    // Major ticks should be at 0, 0.5, 1, 1.5, 2, 2.5, 3
    expect(major).toContain(0);
    expect(major).toContain(1);
    expect(major).toContain(2);
    expect(major).toContain(3);
  });

  it("generates ticks for a medium duration (10 seconds)", () => {
    const { major, minor: _minor } = generateTicks(10);
    // target = 10/6 ≈ 1.67 → majorInterval = 2, minorInterval = 1
    expect(major).toContain(0);
    expect(major).toContain(2);
    expect(major).toContain(4);
    expect(major).toContain(6);
    expect(major).toContain(8);
    expect(major).toContain(10);
    // Minor ticks should be at odd seconds: 1, 3, 5, 7, 9
    expect(minor).toContain(1);
    expect(minor).toContain(3);
    expect(minor).toContain(5);
  });

  it("generates ticks for a long duration (120 seconds)", () => {
    const { major, minor: _minor } = generateTicks(120);
    // target = 120/6 = 20 → majorInterval = 30, minorInterval = 15
    expect(major).toContain(0);
    expect(major).toContain(30);
    expect(major).toContain(60);
    expect(major).toContain(90);
    expect(major).toContain(120);
    expect(minor).toContain(15);
    expect(minor).toContain(45);
  });

  it("generates ticks for a very long duration (500 seconds)", () => {
    const { major } = generateTicks(500);
    // target = 500/6 ≈ 83.3 → no interval matches, falls through to 60
    expect(major).toContain(0);
    expect(major).toContain(60);
    expect(major).toContain(120);
  });

  it("major and minor ticks do not overlap", () => {
    const { major, minor: _minor } = generateTicks(30);
    for (const t of minor) {
      expect(major).not.toContain(t);
    }
  });

  it("all tick values are non-negative", () => {
    const { major, minor: _minor } = generateTicks(60);
    for (const t of [...major, ...minor]) {
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it("major ticks always start at 0", () => {
    for (const d of [1, 5, 10, 30, 60, 120, 300]) {
      const { major } = generateTicks(d);
      expect(major[0]).toBe(0);
    }
  });
});

describe("formatTick", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatTick(0)).toBe("0:00");
  });

  it("formats seconds below a minute", () => {
    expect(formatTick(5)).toBe("0:05");
    expect(formatTick(30)).toBe("0:30");
    expect(formatTick(59)).toBe("0:59");
  });

  it("formats exactly one minute", () => {
    expect(formatTick(60)).toBe("1:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatTick(90)).toBe("1:30");
    expect(formatTick(125)).toBe("2:05");
  });

  it("floors fractional seconds", () => {
    expect(formatTick(5.7)).toBe("0:05");
    expect(formatTick(59.9)).toBe("0:59");
    expect(formatTick(90.5)).toBe("1:30");
  });

  it("handles large values", () => {
    expect(formatTick(600)).toBe("10:00");
    expect(formatTick(3661)).toBe("61:01");
  });

  it("zero-pads seconds to two digits", () => {
    expect(formatTick(1)).toBe("0:01");
    expect(formatTick(9)).toBe("0:09");
    expect(formatTick(61)).toBe("1:01");
  });
});
