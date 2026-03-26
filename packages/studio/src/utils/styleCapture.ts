/**
 * Style Capture — Reads live computed styles from an iframe document at the
 * current GSAP playhead position. Used during clip splits to snapshot the
 * exact visual state of every element so the clone (second half) can render
 * correctly without replaying entrance animations.
 */

/**
 * CSS properties that GSAP commonly animates on HTML elements.
 */
export const CAPTURE_PROPERTIES: readonly string[] = [
  "opacity",
  "transform",
  "visibility",
  "display",
  "clip-path",
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  "color",
  "background-color",
  "background",
  "border-color",
  "box-shadow",
  "filter",
  "backdrop-filter",
];

/**
 * Presentational SVG attributes surfaced as CSS properties by browsers.
 * GSAP animates these directly on SVG elements.
 */
export const SVG_CAPTURE_PROPERTIES: readonly string[] = [
  "stroke-dashoffset",
  "stroke-dasharray",
  "fill",
  "stroke",
  "stroke-width",
  "fill-opacity",
  "stroke-opacity",
];

/**
 * Property values that are browser defaults and carry no visual information.
 * Skipping them keeps the captured style strings lean.
 */
const DEFAULT_VALUES: ReadonlyMap<string, string> = new Map([
  ["opacity", "1"],
  ["transform", "none"],
  ["visibility", "visible"],
  ["display", "block"], // common default — still captured for flex/grid elements
  ["clip-path", "none"],
  ["box-shadow", "none"],
  ["filter", "none"],
  ["backdrop-filter", "none"],
  // SVG defaults
  ["stroke-dashoffset", "0px"],
  ["stroke-dasharray", "none"],
  ["fill", "rgb(0, 0, 0)"],
  ["stroke", "none"],
  ["stroke-width", "1px"],
  ["fill-opacity", "1"],
  ["stroke-opacity", "1"],
]);

/**
 * Snapshot of captured styles for a composition element tree at a point in
 * time. Used to inject visual state into the clone produced by a clip split.
 */
export interface CapturedStyles {
  /** Map from element ID → semicolon-separated inline style string. */
  elementStyles: Map<string, string>;
  /** The captured inline style string for the root element itself. */
  rootStyle: string;
  /** Map from element ID → textContent at split time (for GSAP counter/typewriter effects). */
  textContents: Map<string, string>;
  /** <script> tags to inject into the clone for canvas renderers (Lottie, Three.js). */
  seekScripts: string[];
}

/**
 * Read `getComputedStyle` for every relevant GSAP-animated property on `el`
 * and return a semicolon-separated inline style string containing only the
 * non-default values.
 *
 * @param el  - The element to inspect.
 * @param doc - The owning Document (used to access defaultView).
 * @returns   Semicolon-separated style string, e.g. `"opacity: 0.5; transform: translateX(100px)"`.
 */
export function captureElementStyle(el: HTMLElement, doc: Document): string {
  const view = doc.defaultView;
  if (!view) return "";

  const computed = view.getComputedStyle(el);
  const isSvg = el instanceof (view as Window & typeof globalThis).SVGElement;
  const properties = isSvg
    ? ([...CAPTURE_PROPERTIES, ...SVG_CAPTURE_PROPERTIES] as string[])
    : (CAPTURE_PROPERTIES as string[]);

  const parts: string[] = [];

  for (const prop of properties) {
    const value = computed.getPropertyValue(prop).trim();
    if (!value) continue;

    const defaultVal = DEFAULT_VALUES.get(prop);
    // Always capture opacity and transform even at their default values —
    // the clone's inline style may have opacity:0 or a transform offset
    // that must be overridden to the correct animated state at split time.
    if (prop !== "opacity" && prop !== "transform" && prop !== "visibility") {
      if (defaultVal !== undefined && value === defaultVal) continue;
    }

    parts.push(`${prop}: ${value}`);
  }

  // SVG elements may have animated attributes that aren't reflected in
  // computed CSS (e.g. stroke-dashoffset set directly via setAttribute).
  // Read them from the DOM directly and append any not already captured.
  if (el instanceof (view as Window & typeof globalThis).SVGElement) {
    const svgAttrs = [
      "stroke-dashoffset",
      "stroke-dasharray",
      "fill",
      "stroke",
      "opacity",
      "transform",
    ];
    for (const attr of svgAttrs) {
      const val = el.getAttribute(attr);
      if (val && val !== "none" && !parts.some((p) => p.startsWith(attr + ":"))) {
        parts.push(`${attr}:${val}`);
      }
    }
  }

  return parts.join("; ");
}

/**
 * Walk the entire subtree rooted at `elementId` inside `iframeDoc`, capturing
 * the computed styles of every element that carries an `id` attribute.
 *
 * @param iframeDoc - The live Document inside the preview iframe.
 * @param elementId - The ID of the root composition element to capture.
 * @param splitTimeSeconds - The split time in seconds; used to generate seek scripts for canvas renderers.
 * @returns `CapturedStyles` on success, `null` if the element cannot be found
 *          or if access is blocked by a cross-origin restriction.
 */
export function captureTreeStyles(
  iframeDoc: Document,
  elementId: string,
  splitTimeSeconds?: number,
): CapturedStyles | null {
  try {
    const root = iframeDoc.getElementById(elementId);
    if (!root) return null;

    const rootStyle = captureElementStyle(root as HTMLElement, iframeDoc);
    const elementStyles = new Map<string, string>();
    const textContents = new Map<string, string>();
    const seekScripts: string[] = [];

    // Capture root's own textContent.
    const rootText = root.textContent?.trim() ?? "";
    if (rootText) {
      textContents.set(elementId, rootText);
    }

    // TreeWalker visits all Element nodes in the subtree (not the root itself).
    const walker = iframeDoc.createTreeWalker(
      root,
      // NodeFilter.SHOW_ELEMENT === 1
      1,
    );

    let node = walker.nextNode();
    while (node !== null) {
      const el = node as HTMLElement;
      const id = el.getAttribute("id");
      const capturedStyle = captureElementStyle(el, iframeDoc);
      if (id) {
        if (capturedStyle) {
          elementStyles.set(id, capturedStyle);
        }
        // Capture textContent for all elements with IDs — consumer decides what to use.
        const text = el.textContent?.trim() ?? "";
        if (text) {
          textContents.set(id, text);
        }
      } else if (el.className && typeof el.className === "string") {
        // GSAP also targets elements by class name. Capture these with a
        // positional key so they're available for future use. The `__cls_`
        // prefix ensures applyBakedStyles ignores them (no real element has
        // an ID matching this pattern).
        const parent = el.parentElement;
        const idx = parent ? Array.from(parent.children).indexOf(el) : 0;
        const classKey = `__cls_${el.className.split(" ")[0]}_${idx}`;
        if (capturedStyle) {
          elementStyles.set(classKey, capturedStyle);
        }
      }
      node = walker.nextNode();
    }

    // Generate seek scripts for canvas-based renderers when a split time is provided.
    if (splitTimeSeconds !== undefined) {
      const win = iframeDoc.defaultView as
        | (Window & typeof globalThis & Record<string, unknown>)
        | null;
      const canvases = root.querySelectorAll("canvas");
      const lottieContainers = root.querySelectorAll("[data-lottie], [data-dotlottie], .lottie");

      // Lottie / DotLottie seek script
      if (
        (canvases.length > 0 || lottieContainers.length > 0) &&
        win &&
        ("lottie" in win || "__hfLottieAnimations" in win)
      ) {
        const t = splitTimeSeconds;
        seekScripts.push(
          `<script>` +
            `(function(){` +
            `var t=${t};` +
            `if(window.lottie){` +
            `var anims=window.__hfLottieAnimations||[];` +
            `anims.forEach(function(a){try{a.goToAndStop(t*a.frameRate,false)}catch(e){}});` +
            `}` +
            `if(window.__dotLottieAnimations){` +
            `window.__dotLottieAnimations.forEach(function(a){try{a.setFrame(t*30)}catch(e){}});` +
            `}` +
            `})();` +
            `</script>`,
        );
      }

      // Three.js seek script
      if (win && ("__hfThreeTime" in win || root.querySelector("canvas[data-three]"))) {
        const t = splitTimeSeconds;
        seekScripts.push(
          `<script>` +
            `window.__hfThreeTime=${t};` +
            `window.dispatchEvent(new CustomEvent("hf-seek",{detail:{time:${t}}}));` +
            `</script>`,
        );
      }
    }

    return { elementStyles, rootStyle, textContents, seekScripts };
  } catch {
    // Cross-origin iframe or other DOM access error — fail silently.
    return null;
  }
}
