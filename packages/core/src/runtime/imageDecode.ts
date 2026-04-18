/**
 * Eager image-decode binding.
 *
 * Compositions with many `<img>` elements (reported in GH #317) stutter
 * during the first ~second of preview because each image decodes
 * synchronously the first time it enters the paint tree. Forcing every
 * image through `HTMLImageElement.decode()` off the main thread ahead of
 * paint eliminates that cost.
 *
 * `img.decode()` is the canonical platform primitive for this:
 *   - resolves when the pixels are in the decoded bitmap cache
 *   - is a fast no-op for already-decoded images
 *   - runs on the decoder thread, never blocks the main thread
 *
 * We also set `decoding="async"` so the browser never falls back to
 * sync-decode on subsequent paints. We deliberately do NOT flip
 * `loading="lazy"` images — if the author asked for them to be deferred,
 * we respect that; they'll decode when they're actually needed.
 *
 * Binding is idempotent: each img is tracked in a WeakSet so repeated
 * polling calls from the runtime's observation loop are free after the
 * first bind.
 */

export interface BindImageDecodeOptions {
  /**
   * Document root to scan. Defaults to the globally-available `document`.
   * Injectable so unit tests can pass a constructed DOM.
   */
  root?: Pick<Document, "querySelectorAll">;
  /**
   * Poison pill — when true, the binder is a no-op. Wired to the
   * runtime's `state.tornDown` flag so teardown races don't leak
   * listeners into an already-disposed runtime.
   */
  tornDown?: () => boolean;
  /**
   * Listener registration. Defaults to `el.addEventListener`. Injected
   * for tests so they can drive the `load` event synchronously.
   */
  addEventListener?: (
    el: HTMLImageElement,
    type: "load",
    handler: () => void,
    opts?: AddEventListenerOptions,
  ) => void;
}

export interface ImageDecodeBinder {
  /**
   * Scan the document for new `<img>` elements and bind each one once.
   * Safe to call repeatedly — bound images are tracked and skipped.
   */
  bind(): void;
  /** Number of images currently tracked (for tests + observability). */
  size(): number;
}

/**
 * Create a binder. Separated from the runtime's init.ts so the behaviour
 * is testable in isolation without constructing the full runtime.
 */
export function createImageDecodeBinder(options: BindImageDecodeOptions = {}): ImageDecodeBinder {
  const root = options.root ?? (typeof document !== "undefined" ? document : null);
  const isTornDown = options.tornDown ?? (() => false);
  const addListener =
    options.addEventListener ??
    ((el, type, handler, opts) => el.addEventListener(type, handler, opts));

  // Use Set (not WeakSet) so we can report size() for tests + diagnostics.
  // In long-lived runtimes a WeakSet would be preferable to avoid retaining
  // removed images, but document-lifetime retention is acceptable here:
  // images that are removed from the DOM don't hold pixel memory once the
  // browser's decoded-bitmap cache evicts them, and the set entries are
  // pointer-sized.
  const bound = new Set<HTMLImageElement>();

  return {
    bind(): void {
      if (isTornDown()) return;
      if (!root) return;
      const imgs = root.querySelectorAll("img");
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i] as HTMLImageElement;
        if (bound.has(img)) continue;
        bound.add(img);

        if (img.decoding !== "async") img.decoding = "async";

        const start = () => {
          if (isTornDown()) return;
          if (!img.isConnected) return;
          if (!img.currentSrc) return;
          // `decode()` rejects for decode failures (CORS, 404, corrupt).
          // We intentionally swallow — actual load failures are reported
          // through the runtime's asset-error diagnostic pipeline, which
          // listens on the "error" event, not on decode rejections.
          img.decode().catch(() => {
            /* see comment above */
          });
        };

        if (img.complete && img.currentSrc) {
          start();
        } else {
          addListener(img, "load", start, { once: true });
        }
      }
    },
    size(): number {
      return bound.size;
    },
  };
}
