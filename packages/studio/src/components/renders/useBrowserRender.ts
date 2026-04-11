import { useState, useCallback } from "react";
import type { RenderJob } from "./useRenderQueue";

export function useBrowserRender(projectId: string | null) {
  const [isRendering, setIsRendering] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [turboEnabled, setTurboEnabled] = useState(false);

  const startBrowserRender = useCallback(
    async (format: "mp4" | "webm" = "mp4") => {
      if (!projectId || isRendering) return;
      setIsRendering(true);

      const jobId = crypto.randomUUID();
      const startTime = Date.now();
      const mode = turboEnabled ? "turbo" : "browser";
      setJob({
        id: jobId,
        status: "rendering",
        progress: 0,
        stage: "initializing",
        filename: `${mode}-export.${format}`,
        createdAt: startTime,
      });

      try {
        const { render, isSupported, isTurboSupported } = await import("@hyperframes/renderer");
        if (!isSupported()) {
          throw new Error(
            "Browser does not support WebCodecs. Use Chrome 94+, Firefox 130+, or Safari 26+.",
          );
        }

        const useTurbo = turboEnabled && isTurboSupported();

        const result = await render({
          composition: `/api/projects/${projectId}/preview`,
          format,
          fps: 30,
          codec: "h264",
          frameSource: "snapdom",
          concurrency: 1,
          workerUrl: "/node_modules/@hyperframes/renderer/dist/worker.bundle.js",
          turbo: useTurbo,
          turboWorkerUrl: useTurbo
            ? "/node_modules/@hyperframes/renderer/dist/turbo-worker.html"
            : undefined,
          onProgress: (p) => {
            setJob((prev) =>
              prev
                ? {
                    ...prev,
                    progress: Math.round(p.progress * 100),
                    stage: p.stage,
                  }
                : prev,
            );
          },
        });

        // Save to project renders directory (same as server-side renders)
        const durationMs = Date.now() - startTime;
        const uploadRes = await fetch(
          `/api/projects/${projectId}/renders/upload?format=${format}&durationMs=${durationMs}`,
          { method: "POST", body: result.blob },
        );
        const uploadData = await uploadRes.json();

        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: "complete",
                progress: 100,
                durationMs,
                filename: uploadData.filename ?? `export.${format}`,
              }
            : prev,
        );
      } catch (err) {
        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
              }
            : prev,
        );
      } finally {
        setIsRendering(false);
      }
    },
    [projectId, isRendering, turboEnabled],
  );

  return { isRendering, job, startBrowserRender, turboEnabled, setTurboEnabled };
}
