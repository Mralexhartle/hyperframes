/**
 * Eager image-decode binding for the runtime. See GH #317:
 * compositions with many `<img>` elements stutter on first paint because
 * each image decodes synchronously the first time it enters the paint
 * tree. `img.decode()` runs the decode on the browser's decoder thread
 * so the first paint lands on pre-decoded bitmaps.
 *
 * `decoding="async"` is set belt-and-suspenders in case the browser
 * falls back to sync-decode on later paints. Lazy images
 * (`loading="lazy"`) are deliberately not force-loaded.
 */

export interface BindImageDecodesContext {
  /** DOM root to scan. Tests pass a stub. */
  root?: Pick<Document, "querySelectorAll">;
  /**
   * Set of already-bound elements — caller owns this so the tracker
   * survives across repeated binds without `createBinder` ceremony.
   * Use `WeakSet` in production so removed images can be GC'd; tests
   * can pass `Set` when they need `.has()` introspection.
   */
  bound: WeakSet<HTMLImageElement> | Set<HTMLImageElement>;
  /** Abort signal for teardown — listeners registered here detach automatically. */
  signal?: AbortSignal;
}

/**
 * Scan `root` for `<img>` elements and kick `img.decode()` on each once.
 * Safe to call repeatedly — binding is idempotent via the `bound` set.
 */
export function bindImageDecodes(ctx: BindImageDecodesContext): void {
  const root = ctx.root ?? (typeof document !== "undefined" ? document : null);
  if (!root) return;
  if (ctx.signal?.aborted) return;

  const imgs = root.querySelectorAll("img");
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i] as HTMLImageElement;
    if (ctx.bound.has(img)) continue;
    ctx.bound.add(img);
    img.decoding = "async";

    const start = () => {
      if (ctx.signal?.aborted) return;
      if (!img.isConnected) return;
      if (!img.currentSrc) return;
      // decode() rejects for CORS / corrupt / 404 — the existing
      // asset-error diagnostic pipeline reports those via the "error"
      // event, so swallowing the rejection here is correct.
      img.decode().catch(() => {});
    };

    if (img.complete && img.currentSrc) {
      start();
    } else {
      img.addEventListener("load", start, { once: true, signal: ctx.signal });
    }
  }
}
