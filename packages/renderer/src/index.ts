/**
 * @hyperframes/renderer
 *
 * Client-side video rendering for HyperFrames compositions.
 * Zero server dependencies — renders entirely in the browser
 * using WebCodecs, MediaBunny, and SnapDOM.
 */

import { HyperframesRenderer } from "./renderer.js";
import type { RenderConfig, RenderResult } from "./types.js";

export { isSupported, detectBestFrameSource } from "./compat.js";
export { HyperframesRenderer, CancelledError } from "./renderer.js";
export { SnapdomFrameSource } from "./sources/snapdom.js";

export type {
  RenderConfig,
  RenderProgress,
  RenderResult,
  FrameSource,
  FrameSourceConfig,
  HfMediaElement,
  EncoderConfig,
  AudioSource,
  AudioMixConfig,
  AudioMixResult,
  MuxerConfig,
} from "./types.js";

export async function render(config: RenderConfig): Promise<RenderResult> {
  const renderer = new HyperframesRenderer(config);
  return renderer.render();
}

export function createRenderer(config: RenderConfig): HyperframesRenderer {
  return new HyperframesRenderer(config);
}
