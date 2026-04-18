// Regression coverage for GH #317. Stubbed DOM keeps the test fast.

import { describe, expect, it, vi } from "vitest";

import { bindImageDecodes } from "./imageDecode";

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

describe("bindImageDecodes", () => {
  it("forces decoding='async' and kicks decode() on loaded images", () => {
    const img = makeStubImg({ decoding: "auto" });
    const bound = new Set<HTMLImageElement>();
    bindImageDecodes({ root: makeRoot([img]), bound });
    expect(img.decoding).toBe("async");
    expect(img.decode).toHaveBeenCalledTimes(1);
    expect(img.addEventListener).not.toHaveBeenCalled();
  });

  it("defers decode() until 'load' fires when the image hasn't loaded yet", () => {
    const img = makeStubImg({ complete: false, currentSrc: "" });
    const bound = new Set<HTMLImageElement>();
    bindImageDecodes({ root: makeRoot([img]), bound });
    expect(img.addEventListener).toHaveBeenCalledTimes(1);
    expect(img.addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      expect.objectContaining({ once: true }),
    );
    expect(img.decode).not.toHaveBeenCalled();
  });

  it("skips images already in the bound set — idempotent across calls", () => {
    const img = makeStubImg();
    const bound = new Set<HTMLImageElement>();
    bindImageDecodes({ root: makeRoot([img]), bound });
    bindImageDecodes({ root: makeRoot([img]), bound });
    expect(img.decode).toHaveBeenCalledTimes(1);
  });

  it("no-ops when the signal is already aborted", () => {
    const img = makeStubImg();
    const bound = new Set<HTMLImageElement>();
    const ac = new AbortController();
    ac.abort();
    bindImageDecodes({ root: makeRoot([img]), bound, signal: ac.signal });
    expect(img.decode).not.toHaveBeenCalled();
    expect(img.addEventListener).not.toHaveBeenCalled();
  });

  it("picks up newly-added images on subsequent calls", () => {
    const first = makeStubImg();
    const imgs = [first];
    const root = {
      querySelectorAll: vi.fn(() => imgs as unknown as NodeListOf<Element>),
    };
    const bound = new Set<HTMLImageElement>();

    bindImageDecodes({ root, bound });
    expect(first.decode).toHaveBeenCalledTimes(1);

    const second = makeStubImg();
    imgs.push(second);
    bindImageDecodes({ root, bound });
    expect(second.decode).toHaveBeenCalledTimes(1);
    expect(first.decode).toHaveBeenCalledTimes(1);
  });
});
