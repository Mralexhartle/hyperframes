/**
 * Tests for the eager image-decode binder.
 *
 * Regression coverage for GH #317 — compositions with many images
 * stuttered during preview because each image decoded synchronously on
 * first paint. The binder forces every `<img>` through `decode()` off
 * the main thread so the first paint lands on pre-decoded bitmaps.
 *
 * We exercise the binder with a tiny hand-rolled DOM stub rather than
 * spinning up jsdom — the surface is small enough (three method calls)
 * that a stub keeps the test fast and the assertions legible.
 */

import { describe, expect, it, vi } from "vitest";

import { createImageDecodeBinder } from "./imageDecode";

interface StubImg {
  decoding: string;
  complete: boolean;
  currentSrc: string;
  isConnected: boolean;
  decode: () => Promise<void>;
  addEventListener: (type: string, handler: () => void, opts?: AddEventListenerOptions) => void;
}

function makeStubImg(overrides: Partial<StubImg> = {}): StubImg {
  return {
    decoding: "auto",
    complete: true,
    currentSrc: "https://example.com/a.png",
    isConnected: true,
    decode: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    ...overrides,
  };
}

function makeRoot(imgs: StubImg[]) {
  return {
    querySelectorAll: vi.fn().mockReturnValue(imgs as unknown as NodeListOf<Element>),
  };
}

describe("createImageDecodeBinder", () => {
  it("sets decoding='async' on every img it finds", () => {
    const img = makeStubImg({ decoding: "auto" });
    const binder = createImageDecodeBinder({ root: makeRoot([img]) });
    binder.bind();
    expect(img.decoding).toBe("async");
  });

  it("calls decode() immediately on images that are already loaded", () => {
    const img = makeStubImg({ complete: true, currentSrc: "https://x/y.png" });
    const binder = createImageDecodeBinder({ root: makeRoot([img]) });
    binder.bind();
    expect(img.decode).toHaveBeenCalledTimes(1);
    expect(img.addEventListener).not.toHaveBeenCalled();
  });

  it("waits for 'load' on images that haven't finished loading yet", () => {
    const img = makeStubImg({ complete: false, currentSrc: "" });
    const addListener = vi.fn((_el: StubImg, _type: "load", handler: () => void) => {
      // Simulate the browser firing `load` after a network fetch.
      setTimeout(() => {
        img.complete = true;
        img.currentSrc = "https://x/y.png";
        handler();
      }, 0);
    });
    const binder = createImageDecodeBinder({
      root: makeRoot([img]),
      addEventListener: addListener as unknown as NonNullable<
        Parameters<typeof createImageDecodeBinder>[0]
      >["addEventListener"],
    });

    binder.bind();
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(addListener.mock.calls[0][1]).toBe("load");
    // decode() deferred until after the load handler fires.
    expect(img.decode).not.toHaveBeenCalled();
  });

  it("is idempotent — calling bind() twice does not re-bind the same img", () => {
    const img = makeStubImg();
    const binder = createImageDecodeBinder({ root: makeRoot([img]) });
    binder.bind();
    binder.bind();
    expect(img.decode).toHaveBeenCalledTimes(1);
    expect(binder.size()).toBe(1);
  });

  it("no-ops when tornDown predicate returns true", () => {
    const img = makeStubImg();
    const binder = createImageDecodeBinder({
      root: makeRoot([img]),
      tornDown: () => true,
    });
    binder.bind();
    expect(img.decode).not.toHaveBeenCalled();
    expect(img.addEventListener).not.toHaveBeenCalled();
    expect(binder.size()).toBe(0);
  });

  it("swallows decode() rejections silently (real failures surface via the 'error' event)", async () => {
    const img = makeStubImg({
      decode: vi.fn().mockRejectedValue(new Error("CORS blocked")),
    });
    const binder = createImageDecodeBinder({ root: makeRoot([img]) });
    binder.bind();
    // Let the microtask for the rejected promise run. No throw should reach us.
    await Promise.resolve();
    await Promise.resolve();
    expect(img.decode).toHaveBeenCalled();
    // The fact that no unhandled rejection leaked is what we're asserting.
  });

  it("does not trigger decode() for images without a currentSrc", () => {
    const img = makeStubImg({ complete: true, currentSrc: "" });
    const binder = createImageDecodeBinder({ root: makeRoot([img]) });
    binder.bind();
    // complete=true but currentSrc="" means the browser has no bitmap;
    // decoding it would reject. We wait for `load` instead.
    expect(img.decode).not.toHaveBeenCalled();
    expect(img.addEventListener).toHaveBeenCalled();
  });

  it("binds multiple images in a single pass", () => {
    const a = makeStubImg();
    const b = makeStubImg();
    const c = makeStubImg();
    const binder = createImageDecodeBinder({ root: makeRoot([a, b, c]) });
    binder.bind();
    expect(a.decode).toHaveBeenCalledTimes(1);
    expect(b.decode).toHaveBeenCalledTimes(1);
    expect(c.decode).toHaveBeenCalledTimes(1);
    expect(binder.size()).toBe(3);
  });

  it("picks up newly-added images on subsequent bind() calls", () => {
    const first = makeStubImg();
    const imgs = [first];
    const root = {
      querySelectorAll: vi.fn(() => imgs as unknown as NodeListOf<Element>),
    };
    const binder = createImageDecodeBinder({ root });

    binder.bind();
    expect(binder.size()).toBe(1);
    expect(first.decode).toHaveBeenCalledTimes(1);

    // A composition adds an image dynamically (sub-composition mount,
    // author-inserted content). Next bind() must pick it up.
    const second = makeStubImg();
    imgs.push(second);
    binder.bind();
    expect(binder.size()).toBe(2);
    expect(second.decode).toHaveBeenCalledTimes(1);
    // The already-bound image isn't re-decoded.
    expect(first.decode).toHaveBeenCalledTimes(1);
  });
});
