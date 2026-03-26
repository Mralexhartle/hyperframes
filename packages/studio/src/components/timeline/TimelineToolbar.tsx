import { memo, useCallback } from "react";
import { usePlayerStore } from "../../player/store/playerStore";

const ZOOM_STEP = 1.3;
const MIN_PPS = 20;
const MAX_PPS = 800;

interface TimelineToolbarProps {
  onSplit?: () => void;
  onDelete?: () => void;
}

export const TimelineToolbar = memo(function TimelineToolbar({
  onSplit,
  onDelete,
}: TimelineToolbarProps) {
  const selectedId = usePlayerStore((s) => s.selectedElementId);
  const zoomMode = usePlayerStore((s) => s.zoomMode);
  const pixelsPerSecond = usePlayerStore((s) => s.pixelsPerSecond);

  const handleSplit = useCallback(() => {
    if (!selectedId || !onSplit) return;
    onSplit();
  }, [selectedId, onSplit]);

  const handleDelete = useCallback(() => {
    if (!selectedId || !onDelete) return;
    onDelete();
  }, [selectedId, onDelete]);

  const handleZoomFit = useCallback(() => {
    usePlayerStore.getState().setZoomMode("fit");
  }, []);

  const handleZoomIn = useCallback(() => {
    const store = usePlayerStore.getState();
    store.setZoomMode("manual");
    store.setPixelsPerSecond(Math.min(MAX_PPS, (store.pixelsPerSecond || 100) * ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    const store = usePlayerStore.getState();
    store.setZoomMode("manual");
    store.setPixelsPerSecond(Math.max(MIN_PPS, (store.pixelsPerSecond || 100) / ZOOM_STEP));
  }, []);

  const btn =
    "flex items-center gap-1 px-2 py-1.5 text-xs rounded transition-colors disabled:opacity-30 disabled:cursor-default";
  const active = "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800";
  const disabled = "text-neutral-600";

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-neutral-950">
      {/* Editing actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          className={`${btn} ${selectedId ? active : disabled}`}
          disabled={!selectedId}
          onClick={handleSplit}
          title="Split at playhead (B)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 2v20" />
            <path d="M4 12h4" />
            <path d="M16 12h4" />
          </svg>
          <span className="hidden sm:inline">Split</span>
        </button>
        <button
          type="button"
          className={`${btn} ${selectedId ? "text-neutral-400 hover:text-red-400 hover:bg-neutral-800" : disabled}`}
          disabled={!selectedId}
          onClick={handleDelete}
          title="Delete selected (Del)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>

      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 flex-shrink-0 bg-neutral-900/50 rounded-lg px-1 py-0.5">
        <button
          type="button"
          onClick={handleZoomFit}
          className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
            zoomMode === "fit"
              ? "bg-neutral-700 text-white"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
          }`}
          title="Fit to view"
        >
          Fit
        </button>
        <div className="w-px h-4 bg-neutral-800" />
        <button
          type="button"
          onClick={handleZoomOut}
          className="px-1.5 py-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-colors"
          title="Zoom out"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6" />
          </svg>
        </button>
        <span className="text-[10px] font-mono tabular-nums text-neutral-500 min-w-[40px] text-center">
          {zoomMode === "fit" ? "Fit" : `${Math.round((pixelsPerSecond / 100) * 100)}%`}
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          className="px-1.5 py-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-colors"
          title="Zoom in"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
        </button>
      </div>
    </div>
  );
});
