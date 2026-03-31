import { initSandboxRuntimeModular } from "./init";
import { fitCaptionFontSize } from "../text/fitCaptionFontSize";

type HyperframeWindow = Window & {
  __hyperframeRuntimeBootstrapped?: boolean;
  __hyperframes?: {
    fitCaptionFontSize: typeof fitCaptionFontSize;
  };
};

// Inline composition scripts can run before DOMContentLoaded.
// Ensure timeline registry exists at script evaluation time.
(window as HyperframeWindow).__timelines = (window as HyperframeWindow).__timelines || {};

// Expose text utilities immediately so composition scripts can use them
// before DOMContentLoaded (caption font sizing runs during script evaluation).
(window as HyperframeWindow).__hyperframes = {
  fitCaptionFontSize,
};

function bootstrapHyperframeRuntime(): void {
  const win = window as HyperframeWindow;
  if (win.__hyperframeRuntimeBootstrapped) {
    return;
  }
  win.__hyperframeRuntimeBootstrapped = true;
  initSandboxRuntimeModular();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapHyperframeRuntime, { once: true });
} else {
  bootstrapHyperframeRuntime();
}
