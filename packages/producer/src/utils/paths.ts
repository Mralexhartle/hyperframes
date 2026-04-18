/**
 * Path resolution utilities for the render pipeline.
 */

import { resolve, basename, join, relative, isAbsolute } from "node:path";

export interface RenderPaths {
  absoluteProjectDir: string;
  absoluteOutputPath: string;
}

const DEFAULT_RENDERS_DIR =
  process.env.PRODUCER_RENDERS_DIR ??
  resolve(new URL(import.meta.url).pathname, "../../..", "renders");

/**
 * Cross-platform containment check.
 *
 * `child.startsWith(parent + "/")` breaks on Windows because the path
 * separator is `\`, not `/`. This helper uses `path.relative()` which
 * normalises separators per-platform and returns `..`-prefixed output
 * for out-of-tree paths — the canonical way to ask "is `child` inside
 * `parent`?" on every supported OS.
 *
 * Both inputs are normalised via `resolve()` so callers don't need to.
 * Equality counts as "inside" (a directory contains itself).
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  const absChild = resolve(childPath);
  const absParent = resolve(parentPath);
  if (absChild === absParent) return true;
  const rel = relative(absParent, absChild);
  // `relative()` returns "" when paths are equal, ".." or "..\\foo" when child
  // is above the parent, and an absolute path when they live on different
  // drives/volumes (Windows) — none of which count as "inside".
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Build a safe, cross-platform relative key for an absolute asset path
 * that lives outside the project directory.
 *
 * Windows absolute paths (`D:\coder\assets\segment.wav`) break two
 * downstream assumptions when passed as-is to `path.join(compileDir, key)`:
 *   1. The drive letter makes the path absolute, so `join()` silently
 *      discards `compileDir`.
 *   2. The backslashes and colon are invalid inside some OS sandboxes
 *      and HTTP URL encodings.
 *
 * We sanitise into `hf-ext/<drive>/<path>` form using forward slashes
 * and stripping the colon after the drive letter. The result is a pure
 * relative path that joins cleanly on every platform.
 */
export function toExternalAssetKey(absPath: string): string {
  // Normalise to forward slashes first.
  let normalised = absPath.replace(/\\/g, "/");
  // Strip a leading forward slash (Unix absolute).
  normalised = normalised.replace(/^\/+/, "");
  // Strip a leading drive-letter colon (Windows: "D:/coder" → "D/coder").
  normalised = normalised.replace(/^([A-Za-z]):\/?/, "$1/");
  return "hf-ext/" + normalised;
}

export function resolveRenderPaths(
  projectDir: string,
  outputPath: string | null | undefined,
  rendersDir: string = DEFAULT_RENDERS_DIR,
): RenderPaths {
  const absoluteProjectDir = resolve(projectDir);
  const projectName = basename(absoluteProjectDir);
  const resolvedOutputPath = outputPath ?? join(rendersDir, `${projectName}.mp4`);
  const absoluteOutputPath = resolve(resolvedOutputPath);

  return { absoluteProjectDir, absoluteOutputPath };
}
