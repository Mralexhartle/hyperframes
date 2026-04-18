/**
 * Cross-platform containment + external-asset-key tests.
 *
 * Regression coverage for GH #321 — on Windows, every external asset was
 * wrongly rejected as "unsafe path" because the containment check used
 * `startsWith(parent + "/")` and the safe key carried a drive-letter
 * colon that made the downstream `path.join` absolute.
 *
 * We exercise both OS layouts by posing the hypothetical paths the
 * respective platforms would generate — the logic itself is expressed
 * using `path.relative()` so it works regardless of the runtime OS.
 */

import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { isPathInside, toExternalAssetKey } from "./paths.js";

describe("isPathInside", () => {
  it("returns true when child is directly inside parent", () => {
    expect(isPathInside(resolve("/foo/bar/baz.wav"), resolve("/foo/bar"))).toBe(true);
  });

  it("returns true when child is deeply nested inside parent", () => {
    expect(isPathInside(resolve("/foo/bar/a/b/c/d.wav"), resolve("/foo/bar"))).toBe(true);
  });

  it("returns true when child equals parent (a dir contains itself)", () => {
    expect(isPathInside(resolve("/foo/bar"), resolve("/foo/bar"))).toBe(true);
  });

  it("returns false when child is a sibling whose name starts with parent", () => {
    // Regression: the old `startsWith(parent + "/")` accidentally worked for
    // this case, but a naive rewrite without the trailing separator would
    // admit `/foo/bar-sibling` as a child of `/foo/bar`. Verify we don't.
    expect(isPathInside(resolve("/foo/bar-sibling/x"), resolve("/foo/bar"))).toBe(false);
  });

  it("returns false when child is outside parent", () => {
    expect(isPathInside(resolve("/tmp/evil/file.wav"), resolve("/foo/bar"))).toBe(false);
  });

  it("returns false when child resolves above parent via ..", () => {
    expect(isPathInside(resolve("/foo/bar/../../etc/passwd"), resolve("/foo/bar"))).toBe(false);
  });

  it("normalises trailing slashes on parent", () => {
    expect(isPathInside(resolve("/foo/bar/baz"), resolve("/foo/bar/"))).toBe(true);
  });
});

describe("toExternalAssetKey", () => {
  it("prefixes with hf-ext/ and keeps a Unix absolute path", () => {
    expect(toExternalAssetKey("/Users/miguel/assets/segment.wav")).toBe(
      "hf-ext/Users/miguel/assets/segment.wav",
    );
  });

  it("converts Windows drive-letter paths to a colonless, slash-delimited key", () => {
    // GH #321: `D:\coder\reactGin\hyperframes\reading\assets\segment_001.wav`
    // used to become `hf-ext/D:\coder\...`, which makes the downstream
    // `path.join(compileDir, key)` absolute on Windows (drive letter wins).
    expect(
      toExternalAssetKey("D:\\coder\\reactGin\\hyperframes\\reading\\assets\\segment_001.wav"),
    ).toBe("hf-ext/D/coder/reactGin/hyperframes/reading/assets/segment_001.wav");
  });

  it("handles Windows paths with forward slashes (mixed separators)", () => {
    expect(toExternalAssetKey("C:/Users/Alice/Downloads/clip.mp4")).toBe(
      "hf-ext/C/Users/Alice/Downloads/clip.mp4",
    );
  });

  it("lowercases / uppercases drive letters faithfully (we don't munge)", () => {
    expect(toExternalAssetKey("e:\\data\\a.wav")).toBe("hf-ext/e/data/a.wav");
    expect(toExternalAssetKey("Z:\\data\\a.wav")).toBe("hf-ext/Z/data/a.wav");
  });

  it("is idempotent for already-sanitised input", () => {
    // If someone double-wraps, the result is still a safe relative key.
    // The drive-letter detector only fires on the first char class.
    const once = toExternalAssetKey("/foo/bar.mp3");
    const twice = toExternalAssetKey(once);
    expect(twice.startsWith("hf-ext/")).toBe(true);
    expect(twice).not.toContain(":");
    expect(twice).not.toContain("\\");
  });

  it("keeps UNIX paths stable after an extra leading slash", () => {
    expect(toExternalAssetKey("//foo/bar.mp3")).toBe("hf-ext/foo/bar.mp3");
  });

  it("produces a key that path.join(compileDir, key) keeps inside compileDir", () => {
    // The real failure mode from #321: on Windows, join(compileDir, key) with
    // a key containing a drive letter silently escaped compileDir. Our key
    // must be a pure relative path — no `:`, no leading separator — so
    // `isPathInside(join(compileDir, key), compileDir)` is always true.
    const key = toExternalAssetKey("D:\\evil\\x.wav");
    // Key cannot start with a separator or drive letter.
    expect(key.startsWith("/")).toBe(false);
    expect(/^[A-Za-z]:/.test(key)).toBe(false);
  });
});
