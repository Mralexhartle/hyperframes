import { forwardRef, useRef, useState } from "react";
import { useMountEffect } from "../../hooks/useMountEffect";
import type { HyperframesPlayer } from "@hyperframes/player";
// NOTE: importing "@hyperframes/player" registers a class extending HTMLElement
// at module load, which throws under SSR. Defer the import to the mount effect
// so it only runs in the browser.

interface PlayerProps {
  projectId?: string;
  directUrl?: string;
  onLoad: () => void;
  portrait?: boolean;
}

/**
 * Records which path the studio used to inject the composition into the
 * player iframe — the inline `srcdoc` fast path introduced in PR #398, or
 * the `src` fallback that lets the iframe initiate its own navigation.
 *
 * Discriminated so the consumer can answer two questions at once:
 *   1. How often does the fast path actually win in the wild? (`path`)
 *   2. When we fall back, why? (`reason`, only present on `src`)
 *
 * `AbortError` is intentionally NOT a fallback reason: those samples mean
 * the component unmounted mid-fetch and the iframe never received a src at
 * all, so they don't represent a user-visible degradation.
 */
type CompositionLoadPathMetric =
  | { path: "srcdoc" }
  | { path: "src"; reason: "fetch-error" | "non-ok-response" };

/**
 * Emit a `performance.mark()` for the composition load path. Surfaces in
 * the DevTools Performance panel and is consumable by any RUM agent that
 * subscribes to `performance.mark` entries via PerformanceObserver. The
 * mark name uses the same dotted convention as runtime telemetry
 * (`hyperframes.runtime.*`) so dashboards can group on prefix.
 *
 * Wrapped in try/catch because `performance.mark()` can throw on strict
 * CSP, when the document is not yet ready, or when `detail` is
 * non-cloneable. Telemetry must never break the load path, so we swallow
 * any error rather than letting it bubble.
 */
function recordCompositionLoadPath(metric: CompositionLoadPathMetric): void {
  try {
    if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
    performance.mark("hyperframes.studio.composition_load_path", { detail: metric });
  } catch {
    // Never let telemetry failures affect the loading path.
  }
}

/**
 * Readiness check for a Lottie animation instance. Duck-types both supported
 * player shapes:
 *
 * - `lottie-web` exposes a boolean `isLoaded` on `AnimationItem`.
 * - `@dotlottie/player-component` doesn't; we infer readiness from
 *   `totalFrames > 0` since that value is only populated once the animation
 *   JSON has been parsed.
 *
 * Kept in sync with the runtime adapter's own checks in
 * `@hyperframes/core/runtime/adapters/lottie.ts` — that module would be a
 * more canonical home for the helper, but importing from the core package's
 * root index pulls Node-only submodules (path, url) into this browser bundle
 * and breaks Vite. If the helper grows, split a browser-safe submodule
 * export in core and switch this to import it.
 */
function isLottieAnimationReady(anim: unknown): boolean {
  if (typeof anim !== "object" || anim === null) return true;
  const maybe = anim as { isLoaded?: boolean; totalFrames?: number };
  if (maybe.isLoaded === true) return true;
  if (typeof maybe.totalFrames === "number" && maybe.totalFrames > 0) return true;
  return false;
}

// Assets are considered ready when every `<video>`/`<audio>` has enough data
// to play through without buffering, and every registered Lottie animation has
// finished loading.
//
// Returns whichever value was returned last on cross-origin / transient DOM
// races so a brief access failure (e.g. an iframe that just swapped src)
// doesn't flicker the overlay state — we keep showing whatever was most
// recently true.
function hasUnloadedAssets(iframe: HTMLIFrameElement, lastResult: boolean): boolean {
  try {
    const win = iframe.contentWindow as unknown as (Window & { __hfLottie?: unknown[] }) | null;
    const doc = iframe.contentDocument;
    if (!win || !doc) return lastResult;

    for (const el of doc.querySelectorAll("video, audio")) {
      if (el instanceof HTMLMediaElement && el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        return true;
      }
    }

    const lotties = win.__hfLottie;
    if (lotties?.length) {
      for (const anim of lotties) {
        if (!isLottieAnimationReady(anim)) return true;
      }
    }

    return false;
  } catch {
    return lastResult;
  }
}

/**
 * Renders a composition preview using the <hyperframes-player> web component.
 *
 * The web component handles iframe scaling, dimension detection, and
 * ResizeObserver internally. This wrapper bridges its inner iframe to the
 * forwarded ref so useTimelinePlayer can access it for clip manifest parsing,
 * timeline probing, and DOM inspection.
 */
export const Player = forwardRef<HTMLIFrameElement, PlayerProps>(
  ({ projectId, directUrl, onLoad, portrait }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const loadCountRef = useRef(0);
    const assetPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [assetsLoading, setAssetsLoading] = useState(false);

    useMountEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let canceled = false;
      let cleanup: (() => void) | undefined;
      // Hoisted so the outer cleanup can cancel an in-flight composition fetch
      // when the user navigates away mid-load (e.g. switches projects while a
      // sub-composition is still being fetched).
      const abortController = new AbortController();
      const url = directUrl || `/api/projects/${projectId}/preview`;

      // Dynamic import registers the custom element in the browser only.
      import("@hyperframes/player").then(async () => {
        if (canceled) return;

        // Fetch composition HTML up-front so we can pass it via `srcdoc`
        // instead of setting `src`. The iframe then loads the document from
        // an inline buffer rather than initiating its own navigation request,
        // saving the navigation/preconnect overhead on every composition
        // switch and letting the parent's HTTP cache hit be reused across
        // player remounts.
        //
        // On any failure (network error, non-2xx, abort) we fall back to the
        // `src` path — same code path the player has always taken — so this
        // optimization never makes things worse than before. The studio's
        // preview routes are same-origin (`/api/projects/...`), so CORS isn't
        // a concern for the fetch itself.
        let html: string | null = null;
        // Captured so the `src` branch below can tag the perf metric with the
        // exact cause without having to re-derive it. Intentionally not set
        // for AbortError (early return) or the success path (`html !== null`).
        let fallbackReason: "fetch-error" | "non-ok-response" | null = null;
        try {
          const res = await fetch(url, { signal: abortController.signal });
          if (res.ok) {
            html = await res.text();
          } else {
            fallbackReason = "non-ok-response";
          }
        } catch (err) {
          // The cleanup path aborts the controller, which rejects the fetch
          // with AbortError. Bail without touching the DOM in that case —
          // the component is unmounting.
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Other errors (offline, DNS, body decode, etc.) fall through to
          // the src fallback. We can't distinguish "fetch never started" from
          // "body decode failed" without more plumbing, and the reviewer ask
          // is about srcdoc-vs-src adoption rates — one bucket is enough.
          fallbackReason = "fetch-error";
        }
        if (canceled) return;

        // Create the web component imperatively to avoid JSX custom-element typing.
        const player = document.createElement("hyperframes-player") as HyperframesPlayer;
        // Set srcdoc/src BEFORE appendChild so the iframe never loads an
        // intermediate `about:blank` document. That matters for two reasons:
        //   1. The first iframe `load` event must fire for the real
        //      composition; the handler below treats `loadCountRef > 1` as a
        //      hot-reload and replays the reveal animation. An extra
        //      about:blank load would trip the reveal on initial mount.
        //   2. useTimelinePlayer hangs setup off the first load — having that
        //      run against an empty document would just be wasted work.
        if (html !== null) {
          player.setAttribute("srcdoc", html);
          recordCompositionLoadPath({ path: "srcdoc" });
        } else {
          player.setAttribute("src", url);
          // `fallbackReason` is set on every code path that lands here (the
          // AbortError path returns above). The `?? "fetch-error"` is a
          // belt-and-suspenders default in case a future refactor adds a new
          // path that forgets to set it — better to over-attribute to
          // fetch-error than to drop the sample entirely.
          recordCompositionLoadPath({
            path: "src",
            reason: fallbackReason ?? "fetch-error",
          });
        }
        player.setAttribute("width", String(portrait ? 1080 : 1920));
        player.setAttribute("height", String(portrait ? 1920 : 1080));
        player.style.width = "100%";
        player.style.height = "100%";
        player.style.display = "block";
        container.appendChild(player);

        // Bridge the inner iframe to the forwarded ref for useTimelinePlayer.
        const iframe = player.iframeElement;
        if (typeof ref === "function") {
          ref(iframe);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLIFrameElement | null>).current = iframe;
        }

        // Prevent the web component's built-in click-to-toggle behavior.
        // The studio manages playback exclusively via useTimelinePlayer.
        const preventToggle = (e: Event) => e.stopImmediatePropagation();
        player.addEventListener("click", preventToggle, { capture: true });

        // Forward the iframe's native load event to the studio's onIframeLoad.
        const handleLoad = () => {
          loadCountRef.current++;
          // Reveal animation on reload (hot-reload, composition switch)
          if (loadCountRef.current > 1) {
            container.classList.remove("preview-revealing");
            void container.offsetWidth;
            container.classList.add("preview-revealing");
            const onEnd = () => container.classList.remove("preview-revealing");
            container.addEventListener("animationend", onEnd, { once: true });
          }
          onLoad();

          // Show a loading overlay until every `<video>`/`<audio>` and Lottie
          // asset is ready. Without this users can click play before audio has
          // buffered — the runtime is resilient (queued play() resolves once
          // data arrives), but the overlay communicates why the first frame
          // or first audio beat may lag.
          //
          // Poll with a 10 s safety cap (100 ticks × 100 ms). If the cap
          // trips we hide the overlay so the UI doesn't appear stuck forever,
          // but we log a debug warning so the case is diagnosable — a long
          // cold video or a broken asset can legitimately exceed 10 s on a
          // slow network.
          if (assetPollRef.current) clearInterval(assetPollRef.current);
          let lastUnloaded = hasUnloadedAssets(iframe, false);
          if (lastUnloaded) {
            setAssetsLoading(true);
            let attempts = 0;
            assetPollRef.current = setInterval(() => {
              attempts += 1;
              lastUnloaded = hasUnloadedAssets(iframe, lastUnloaded);
              if (!lastUnloaded || attempts > 100) {
                if (assetPollRef.current) clearInterval(assetPollRef.current);
                assetPollRef.current = null;
                setAssetsLoading(false);
                if (lastUnloaded) {
                  console.debug(
                    "[Player] Asset-loading overlay timed out after 10s; hiding anyway. Check network or asset integrity.",
                  );
                }
              }
            }, 100);
          } else {
            setAssetsLoading(false);
          }
        };
        iframe.addEventListener("load", handleLoad);

        cleanup = () => {
          iframe.removeEventListener("load", handleLoad);
          player.removeEventListener("click", preventToggle, { capture: true });
          if (assetPollRef.current) clearInterval(assetPollRef.current);
          assetPollRef.current = null;
          container.removeChild(player);
          // Clear the forwarded ref
          if (typeof ref === "function") {
            ref(null);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLIFrameElement | null>).current = null;
          }
        };
      });

      return () => {
        canceled = true;
        // Abort an in-flight composition fetch. Safe to call after the fetch
        // resolved — abort on a settled signal is a no-op.
        abortController.abort();
        cleanup?.();
      };
    });

    return (
      <div className="relative w-full h-full max-w-full max-h-full overflow-hidden bg-black flex items-center justify-center">
        <div ref={containerRef} className="w-full h-full" />
        {assetsLoading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 pointer-events-none">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-white/60 text-xs mt-3">Loading assets…</span>
          </div>
        )}
      </div>
    );
  },
);

Player.displayName = "Player";
