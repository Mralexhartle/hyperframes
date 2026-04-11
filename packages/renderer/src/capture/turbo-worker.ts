/**
 * Turbo Render — Worker Tab Entry Point
 *
 * This script runs in each worker tab opened by TurboPool.
 * It listens on a BroadcastChannel for frame capture assignments,
 * loads the composition via SnapdomFrameSource, captures frames,
 * and sends PNG-encoded results back to the coordinator.
 *
 * Each worker tab runs in its own renderer process (thanks to
 * `noopener`), giving true multi-process parallelism.
 */

import { SnapdomFrameSource } from "../sources/snapdom.js";

interface InitMessage {
  type: "init";
  workerId: string;
  compositionUrl: string;
  width: number;
  height: number;
  dpr: number;
}

interface CaptureMessage {
  type: "capture";
  workerId: string;
  frames: { index: number; time: number }[];
}

interface AbortMessage {
  type: "abort";
}

type CoordinatorMessage = InitMessage | CaptureMessage | AbortMessage;

const CHANNEL_NAME = new URLSearchParams(location.search).get("channel");
if (!CHANNEL_NAME) {
  document.title = "ERROR: missing channel param";
  throw new Error("Turbo worker requires ?channel= query param");
}

const WORKER_ID = new URLSearchParams(location.search).get("workerId") ?? crypto.randomUUID();
const channel = new BroadcastChannel(CHANNEL_NAME);
let source: SnapdomFrameSource | null = null;
let aborted = false;

channel.onmessage = async (e: MessageEvent<CoordinatorMessage>) => {
  const msg = e.data;

  // Only handle messages addressed to this worker (or broadcast)
  if ("workerId" in msg && msg.workerId !== WORKER_ID) return;

  if (msg.type === "abort") {
    aborted = true;
    await cleanup();
    return;
  }

  if (msg.type === "init") {
    try {
      source = new SnapdomFrameSource();
      await source.init({
        compositionUrl: msg.compositionUrl,
        width: msg.width,
        height: msg.height,
        devicePixelRatio: msg.dpr,
      });
      channel.postMessage({ type: "ready", workerId: WORKER_ID, duration: source.duration });
    } catch (err) {
      channel.postMessage({
        type: "error",
        workerId: WORKER_ID,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "capture") {
    if (!source) {
      channel.postMessage({
        type: "error",
        workerId: WORKER_ID,
        message: "Not initialized",
      });
      return;
    }

    try {
      for (const frame of msg.frames) {
        if (aborted) break;

        const bitmap = await source.capture(frame.time);

        // Convert ImageBitmap → PNG ArrayBuffer (BroadcastChannel can't transfer ImageBitmap)
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png"),
        );
        const buffer = await blob.arrayBuffer();

        channel.postMessage({
          type: "frame",
          workerId: WORKER_ID,
          index: frame.index,
          png: buffer,
        });

        // Yield to keep the tab responsive
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      channel.postMessage({ type: "done", workerId: WORKER_ID });
    } catch (err) {
      channel.postMessage({
        type: "error",
        workerId: WORKER_ID,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
};

async function cleanup(): Promise<void> {
  if (source) {
    await source.dispose();
    source = null;
  }
  channel.close();
  window.close();
}

// Signal that the worker tab script has loaded
document.title = `turbo-worker:${WORKER_ID}`;
