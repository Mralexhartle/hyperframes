import html2canvas from "html2canvas";

let patched = false;

function patchCreatePattern(): void {
  if (patched) return;
  patched = true;
  const orig = CanvasRenderingContext2D.prototype.createPattern;
  CanvasRenderingContext2D.prototype.createPattern = function (
    image: CanvasImageSource,
    repetition: string | null,
  ): CanvasPattern | null {
    if (
      image &&
      "width" in image &&
      "height" in image &&
      ((image as HTMLCanvasElement).width === 0 || (image as HTMLCanvasElement).height === 0)
    ) {
      return null;
    }
    return orig.call(this, image, repetition);
  };
}

export function initCapture(): void {
  patchCreatePattern();
}

export function captureScene(sceneEl: HTMLElement, bgColor: string): Promise<HTMLCanvasElement> {
  return html2canvas(sceneEl, {
    width: 1920,
    height: 1080,
    scale: 1,
    backgroundColor: bgColor,
    logging: false,
    ignoreElements: (el: Element) => el.tagName === "CANVAS" || el.hasAttribute("data-no-capture"),
  });
}

/**
 * Capture the incoming scene with .scene-content hidden (background + decoratives only).
 * Shows the scene behind the outgoing scene via z-index, waits 2 rAFs for font rendering,
 * captures, then restores.
 */
export function captureIncomingScene(
  toScene: HTMLElement,
  bgColor: string,
): Promise<HTMLCanvasElement> {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const origZ = toScene.style.zIndex;
    const origOpacity = toScene.style.opacity;
    toScene.style.zIndex = "-1";
    toScene.style.opacity = "1";

    const contentEl = toScene.querySelector<HTMLElement>(".scene-content");
    if (contentEl) contentEl.style.visibility = "hidden";

    const restore = () => {
      if (contentEl) contentEl.style.visibility = "";
      toScene.style.opacity = origOpacity;
      toScene.style.zIndex = origZ;
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        captureScene(toScene, bgColor).then(resolve, reject).finally(restore);
      });
    });
  });
}
