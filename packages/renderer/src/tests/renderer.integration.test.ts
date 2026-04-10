/**
 * End-to-end integration test for the renderer.
 *
 * Requires a browser environment with WebCodecs support.
 * Skipped in jsdom/node environments.
 */
import { describe, it, expect } from "vitest";
import { render, isSupported } from "../index.js";

const SKIP = typeof globalThis.VideoEncoder === "undefined";

describe.skipIf(SKIP)("Renderer E2E", () => {
  it("renders a basic composition to MP4", async () => {
    const progressStages: string[] = [];

    const result = await render({
      composition: new URL("./fixtures/basic-composition.html", import.meta.url).href,
      fps: 30,
      width: 1920,
      height: 1080,
      concurrency: 1,
      onProgress: (p) => {
        if (!progressStages.includes(p.stage)) {
          progressStages.push(p.stage);
        }
      },
    });

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.mimeType).toBe("video/mp4");
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.perf.totalMs).toBeGreaterThan(0);
    expect(result.perf.framesPerSecond).toBeGreaterThan(0);
    expect(progressStages).toContain("initializing");
    expect(progressStages).toContain("capturing");
    expect(progressStages).toContain("complete");
  }, 60_000);

  it("isSupported returns true in browser with WebCodecs", () => {
    expect(isSupported()).toBe(true);
  });
});
