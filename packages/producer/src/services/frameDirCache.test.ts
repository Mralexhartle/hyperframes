import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  __resetMaxFrameIndexCacheForTests,
  clearMaxFrameIndex,
  getMaxFrameIndex,
  getMaxFrameIndexCacheSize,
} from "./frameDirCache.js";

// Frame-directory max-index cache (Chunk 5B / 9E).
//
// These tests exercise the *cross-job isolation contract*: the cache MUST be
// shared inside a single render job (so we don't re-readdir the same directory
// for every frame), but it MUST NOT grow monotonically across renders. The
// render orchestrator achieves this by calling `clearMaxFrameIndex` for every
// directory it registered, in its outer `finally`. Here we verify that the
// primitives that contract relies on actually behave as advertised.

const FRAME_RE_NOTE =
  "directory layout matches what we extract via FFmpeg's `frame_%04d.png` pattern";

function createFrameDir(prefix: string, frameCount: number): string {
  void FRAME_RE_NOTE;
  const dir = mkdtempSync(join(tmpdir(), `frame-dir-${prefix}-`));
  for (let i = 1; i <= frameCount; i++) {
    const name = `frame_${String(i).padStart(4, "0")}.png`;
    writeFileSync(join(dir, name), Buffer.from([0]));
  }
  return dir;
}

function createDirWithMixedFiles(prefix: string): {
  dir: string;
  expectedMax: number;
} {
  const dir = mkdtempSync(join(tmpdir(), `frame-dir-${prefix}-`));
  // Real frame files (max index = 7).
  writeFileSync(join(dir, "frame_0001.png"), Buffer.from([0]));
  writeFileSync(join(dir, "frame_0007.png"), Buffer.from([0]));
  // Files that must be ignored: wrong extension, wrong prefix, no zero pad,
  // double-extension, and a subdirectory.
  writeFileSync(join(dir, "frame_0099.jpg"), Buffer.from([0]));
  writeFileSync(join(dir, "Frame_0100.png"), Buffer.from([0])); // case-sensitive
  writeFileSync(join(dir, "thumb_0050.png"), Buffer.from([0]));
  writeFileSync(join(dir, "frame_0042.png.bak"), Buffer.from([0]));
  writeFileSync(join(dir, "frame_.png"), Buffer.from([0])); // empty index group
  mkdirSync(join(dir, "frame_0500"));
  return { dir, expectedMax: 7 };
}

describe("frameDirMaxIndexCache", () => {
  const dirsToClean: string[] = [];

  beforeEach(() => {
    __resetMaxFrameIndexCacheForTests();
  });

  afterEach(() => {
    __resetMaxFrameIndexCacheForTests();
    while (dirsToClean.length > 0) {
      const dir = dirsToClean.pop();
      if (!dir) continue;
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort tmp cleanup — tests still pass if rm fails (e.g. macOS
        // SIP, root-owned files left over from a crashed prior run).
      }
    }
  });

  it("returns the correct max frame index for a populated directory", () => {
    const dir = createFrameDir("populated", 150);
    dirsToClean.push(dir);

    expect(getMaxFrameIndex(dir)).toBe(150);
  });

  it("ignores files that do not match the frame_NNNN.png pattern", () => {
    const { dir, expectedMax } = createDirWithMixedFiles("mixed");
    dirsToClean.push(dir);

    expect(getMaxFrameIndex(dir)).toBe(expectedMax);
  });

  it("returns 0 for an empty directory and caches that result", () => {
    const dir = mkdtempSync(join(tmpdir(), "frame-dir-empty-"));
    dirsToClean.push(dir);

    expect(getMaxFrameIndex(dir)).toBe(0);
    expect(getMaxFrameIndexCacheSize()).toBe(1);
    // Second call must still be 0 and must not grow the cache.
    expect(getMaxFrameIndex(dir)).toBe(0);
    expect(getMaxFrameIndexCacheSize()).toBe(1);
  });

  it("returns 0 for a missing directory and caches that result", () => {
    const missing = join(tmpdir(), `frame-dir-missing-${Date.now()}-${Math.random()}`);

    expect(getMaxFrameIndex(missing)).toBe(0);
    expect(getMaxFrameIndexCacheSize()).toBe(1);
  });

  it("caches the first read so subsequent readdir-mutations are not observed", () => {
    const dir = createFrameDir("cached", 10);
    dirsToClean.push(dir);

    expect(getMaxFrameIndex(dir)).toBe(10);
    // Add more frames *after* the first read. Because we cache aggressively,
    // the next call must still return the original max — this is the
    // intra-job invariant the orchestrator relies on for performance, and is
    // exactly why we MUST clear entries between jobs.
    writeFileSync(join(dir, "frame_0500.png"), Buffer.from([0]));
    writeFileSync(join(dir, "frame_0999.png"), Buffer.from([0]));
    expect(getMaxFrameIndex(dir)).toBe(10);
  });

  it("clearMaxFrameIndex forces a re-read on the next call", () => {
    const dir = createFrameDir("clear-then-reread", 5);
    dirsToClean.push(dir);

    expect(getMaxFrameIndex(dir)).toBe(5);
    expect(getMaxFrameIndexCacheSize()).toBe(1);

    writeFileSync(join(dir, "frame_0050.png"), Buffer.from([0]));
    // Without clearing we still get the cached value.
    expect(getMaxFrameIndex(dir)).toBe(5);

    expect(clearMaxFrameIndex(dir)).toBe(true);
    expect(getMaxFrameIndexCacheSize()).toBe(0);

    // After clearing, the cache reads the directory again and picks up the
    // newly-added frame.
    expect(getMaxFrameIndex(dir)).toBe(50);
  });

  it("clearMaxFrameIndex returns false when the path was not cached", () => {
    const dir = createFrameDir("never-cached", 3);
    dirsToClean.push(dir);

    expect(clearMaxFrameIndex(dir)).toBe(false);
    expect(getMaxFrameIndexCacheSize()).toBe(0);
  });

  it("isolates entries across multiple directories", () => {
    const dirA = createFrameDir("iso-a", 10);
    const dirB = createFrameDir("iso-b", 25);
    const dirC = createFrameDir("iso-c", 100);
    dirsToClean.push(dirA, dirB, dirC);

    expect(getMaxFrameIndex(dirA)).toBe(10);
    expect(getMaxFrameIndex(dirB)).toBe(25);
    expect(getMaxFrameIndex(dirC)).toBe(100);
    expect(getMaxFrameIndexCacheSize()).toBe(3);

    // Clearing one entry must not affect the others.
    expect(clearMaxFrameIndex(dirB)).toBe(true);
    expect(getMaxFrameIndexCacheSize()).toBe(2);

    expect(getMaxFrameIndex(dirA)).toBe(10);
    expect(getMaxFrameIndex(dirC)).toBe(100);
    expect(getMaxFrameIndexCacheSize()).toBe(2);
  });

  // ── Cross-job isolation (the contract Chunk 5B added) ────────────────────
  //
  // The render orchestrator registers one frame directory per HDR video and
  // is required to clear every entry it added in its outer `finally`. The
  // following tests model that lifecycle and verify the cache returns to
  // empty between jobs, which is what guarantees the cache cannot leak
  // memory across many consecutive renders.

  it("cross-job isolation: cache is empty between jobs when callers honor the contract", () => {
    // Job 1: register two HDR video frame directories.
    const job1A = createFrameDir("job1-a", 30);
    const job1B = createFrameDir("job1-b", 60);
    dirsToClean.push(job1A, job1B);

    expect(getMaxFrameIndex(job1A)).toBe(30);
    expect(getMaxFrameIndex(job1B)).toBe(60);
    expect(getMaxFrameIndexCacheSize()).toBe(2);

    // Job 1 cleanup (outer `finally` in renderOrchestrator).
    clearMaxFrameIndex(job1A);
    clearMaxFrameIndex(job1B);
    expect(getMaxFrameIndexCacheSize()).toBe(0);

    // Job 2: starts with a clean cache, registers a different directory.
    const job2 = createFrameDir("job2", 90);
    dirsToClean.push(job2);

    expect(getMaxFrameIndex(job2)).toBe(90);
    expect(getMaxFrameIndexCacheSize()).toBe(1);

    clearMaxFrameIndex(job2);
    expect(getMaxFrameIndexCacheSize()).toBe(0);
  });

  it("cross-job isolation: cache does not grow monotonically across many jobs", () => {
    // Simulate 20 consecutive HDR renders, each registering 3 video frame
    // directories. If `clearMaxFrameIndex` is called for each one in the
    // job's cleanup path, the cache size must not exceed the size of a
    // single job's working set (3) at the steady-state checkpoint, and must
    // be empty after the final cleanup.
    for (let job = 0; job < 20; job++) {
      const dirs = [
        createFrameDir(`job${job}-a`, 10 + job),
        createFrameDir(`job${job}-b`, 20 + job),
        createFrameDir(`job${job}-c`, 30 + job),
      ];
      dirsToClean.push(...dirs);

      for (const dir of dirs) getMaxFrameIndex(dir);
      // Steady-state during the job: exactly the working set, never the
      // accumulated total across all prior jobs.
      expect(getMaxFrameIndexCacheSize()).toBe(3);

      for (const dir of dirs) clearMaxFrameIndex(dir);
      expect(getMaxFrameIndexCacheSize()).toBe(0);
    }
  });

  it("cross-job isolation: a job that forgets to clear leaks exactly its own entries (regression bound)", () => {
    // This test documents (and pins) the failure mode the contract guards
    // against. A buggy job that registers directories without calling
    // `clearMaxFrameIndex` MUST leak only the entries it owned — not the
    // entries of unrelated, well-behaved jobs. If this invariant ever
    // breaks (e.g. because someone adds a global side effect to the
    // cache), this test will catch it.
    const wellBehavedDir = createFrameDir("well-behaved", 5);
    dirsToClean.push(wellBehavedDir);
    getMaxFrameIndex(wellBehavedDir);
    clearMaxFrameIndex(wellBehavedDir);
    expect(getMaxFrameIndexCacheSize()).toBe(0);

    const leakyA = createFrameDir("leaky-a", 11);
    const leakyB = createFrameDir("leaky-b", 22);
    dirsToClean.push(leakyA, leakyB);
    getMaxFrameIndex(leakyA);
    getMaxFrameIndex(leakyB);
    // Buggy job exits without calling clearMaxFrameIndex. The cache leaks
    // exactly the two entries the leaky job added — no more, no fewer.
    expect(getMaxFrameIndexCacheSize()).toBe(2);
  });
});
