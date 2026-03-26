// TimelineClip — Draggable, resizable clip component for the NLE timeline.
// Supports: move (horizontal), trim left/right edges, drag between tracks.

import { memo, useRef, useCallback, type ReactNode } from "react";
import { useDrag } from "@use-gesture/react";
import { usePlayerStore, type TimelineElement } from "../store/playerStore";

const HANDLE_W = 6; // px — resize grab zone width
const MIN_DURATION = 0.2; // seconds — minimum clip duration

interface TimelineClipProps {
  el: TimelineElement;
  pps: number; // pixels per second
  trackH: number;
  clipY: number;
  isSelected: boolean;
  isHovered: boolean;
  hasCustomContent: boolean;
  style: { clip: string; label: string };
  isComposition: boolean;
  trackOffsets: Map<number, number>; // trackNum → y offset from timeline top
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  /** Called when a drag operation completes (move, resize, track change) */
  onDragEnd?: (
    elementId: string,
    updates: { start?: number; duration?: number; track?: number },
  ) => void;
  children?: ReactNode;
}

type DragMode = "move" | "trim-left" | "trim-right" | null;

export const TimelineClip = memo(function TimelineClip({
  el,
  pps,
  trackH,
  clipY,
  isSelected,
  isHovered,
  hasCustomContent,
  style,
  isComposition,
  trackOffsets,
  onHoverStart,
  onHoverEnd,
  onClick,
  onDoubleClick,
  onDragEnd,
  children,
}: TimelineClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<DragMode>(null);
  const initialValues = useRef({ start: 0, duration: 0, track: 0 });
  const ghostRef = useRef({ left: 0, width: 0 });
  const isDragging = useRef(false);

  const leftPx = el.start * pps;
  const widthPx = Math.max(el.duration * pps, 4);

  // Determine drag mode from pointer position within the clip
  const getDragMode = useCallback((clientX: number): DragMode => {
    const rect = clipRef.current?.getBoundingClientRect();
    if (!rect) return "move";
    const localX = clientX - rect.left;
    if (localX <= HANDLE_W) return "trim-left";
    if (localX >= rect.width - HANDLE_W) return "trim-right";
    return "move";
  }, []);

  const bind = useDrag(
    ({
      first,
      last,
      movement: [mx, my],
      event,
      initial,
      cancel,
    }: {
      first: boolean;
      last: boolean;
      movement: [number, number];
      event: Event | undefined;
      initial: [number, number];
      cancel: () => void;
    }) => {
      if (!pps || pps <= 0) {
        cancel();
        return;
      }
      event?.stopPropagation();

      if (first) {
        // Use `initial` (the actual pointer-down position) not `event` (which
        // fires after the threshold, so the pointer has already moved 3px).
        dragMode.current = getDragMode(initial[0]);
        initialValues.current = {
          start: el.start,
          duration: el.duration,
          track: el.track,
        };
        ghostRef.current = { left: leftPx, width: widthPx };
        isDragging.current = true;
        // Select the clip on drag start
        usePlayerStore.getState().setSelectedElementId(el.id);
      }

      const deltaTime = mx / pps;
      const { start: origStart, duration: origDuration } = initialValues.current;
      const clip = clipRef.current;

      if (dragMode.current === "move") {
        const newStart = Math.max(0, origStart + deltaTime);
        ghostRef.current.left = newStart * pps;
        if (clip) {
          clip.style.left = `${ghostRef.current.left}px`;
          clip.style.opacity = "0.85";
        }
      } else if (dragMode.current === "trim-left") {
        // Moving the left edge: changes start AND duration
        const maxDelta = origDuration - MIN_DURATION;
        const clampedDelta = Math.max(-origStart, Math.min(deltaTime, maxDelta));
        const newStart = origStart + clampedDelta;
        const newDuration = origDuration - clampedDelta;
        ghostRef.current.left = newStart * pps;
        ghostRef.current.width = Math.max(newDuration * pps, 4);
        if (clip) {
          clip.style.left = `${ghostRef.current.left}px`;
          clip.style.width = `${ghostRef.current.width}px`;
        }
      } else if (dragMode.current === "trim-right") {
        // Moving the right edge: changes only duration
        const newDuration = Math.max(MIN_DURATION, origDuration + deltaTime);
        ghostRef.current.width = newDuration * pps;
        if (clip) {
          clip.style.width = `${ghostRef.current.width}px`;
        }
      }

      if (last) {
        isDragging.current = false;
        const mode = dragMode.current;
        const updates: { start?: number; duration?: number; track?: number } = {};

        if (mode === "move") {
          const newStart = Math.max(0, origStart + deltaTime);
          if (Math.abs(newStart - origStart) > 0.01)
            updates.start = Math.round(newStart * 100) / 100;

          // Track switch: check if pointer moved to a different track
          if (Math.abs(my) > trackH * 0.4) {
            const trackDelta = Math.round(my / trackH);
            const sortedTracks = [...trackOffsets.keys()].sort((a, b) => a - b);
            const currentIdx = sortedTracks.indexOf(el.track);
            const newIdx = Math.max(0, Math.min(sortedTracks.length - 1, currentIdx + trackDelta));
            if (newIdx !== currentIdx) {
              updates.track = sortedTracks[newIdx];
            }
          }
        } else if (mode === "trim-left") {
          const maxDelta = origDuration - MIN_DURATION;
          const clampedDelta = Math.max(-origStart, Math.min(deltaTime, maxDelta));
          const newStart = origStart + clampedDelta;
          const newDuration = origDuration - clampedDelta;
          if (Math.abs(newStart - origStart) > 0.01) {
            updates.start = Math.round(newStart * 100) / 100;
            updates.duration = Math.round(newDuration * 100) / 100;
          }
        } else if (mode === "trim-right") {
          const newDuration = Math.max(MIN_DURATION, origDuration + deltaTime);
          if (Math.abs(newDuration - origDuration) > 0.01) {
            updates.duration = Math.round(newDuration * 100) / 100;
          }
        }

        // Reset visual state
        if (clip) {
          clip.style.left = "";
          clip.style.width = "";
          clip.style.opacity = "";
        }

        // Commit changes
        if (Object.keys(updates).length > 0) {
          usePlayerStore.getState().updateElement(el.id, updates);
          onDragEnd?.(el.id, updates);
        }

        dragMode.current = null;
      }
    },
    {
      filterTaps: true,
      pointer: { capture: true },
      threshold: 3,
    },
  );

  // Dynamic cursor based on pointer position
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDragging.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (localX <= HANDLE_W || localX >= rect.width - HANDLE_W) {
      (e.currentTarget as HTMLElement).style.cursor = "col-resize";
    } else {
      (e.currentTarget as HTMLElement).style.cursor = "grab";
    }
  }, []);

  return (
    <div
      ref={clipRef}
      {...bind()}
      data-clip="true"
      className={hasCustomContent ? "absolute" : "absolute flex items-center"}
      style={{
        left: leftPx,
        width: widthPx,
        top: clipY,
        bottom: clipY,
        borderRadius: 5,
        backgroundColor: hasCustomContent ? (isComposition ? "#111" : style.clip) : style.clip,
        backgroundImage:
          isComposition && !hasCustomContent
            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.08) 3px, rgba(255,255,255,0.08) 6px)`
            : undefined,
        border: isSelected
          ? `2px solid rgba(255,255,255,0.9)`
          : `1px solid rgba(255,255,255,${isHovered ? 0.3 : 0.15})`,
        boxShadow: isSelected
          ? `0 0 0 1px ${style.clip}, 0 2px 8px rgba(0,0,0,0.4)`
          : isHovered
            ? "0 1px 4px rgba(0,0,0,0.3)"
            : "none",
        transition: isDragging.current ? "none" : "border-color 120ms, box-shadow 120ms",
        zIndex: isSelected ? 10 : isHovered ? 5 : 1,
        touchAction: "none",
      }}
      title={
        isComposition
          ? `${el.compositionSrc} \u2022 Double-click to open`
          : `${el.id || el.tag} \u2022 ${el.start.toFixed(1)}s \u2013 ${(el.start + el.duration).toFixed(1)}s`
      }
      onPointerEnter={onHoverStart}
      onPointerLeave={onHoverEnd}
      onPointerMove={handlePointerMove}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Left resize handle — visual indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 z-20"
        style={{ width: HANDLE_W, cursor: "col-resize" }}
      >
        {(isSelected || isHovered) && (
          <div className="absolute left-[2px] top-[25%] bottom-[25%] w-[2px] rounded-full bg-white/40" />
        )}
      </div>

      {/* Right resize handle — visual indicator */}
      <div
        className="absolute right-0 top-0 bottom-0 z-20"
        style={{ width: HANDLE_W, cursor: "col-resize" }}
      >
        {(isSelected || isHovered) && (
          <div className="absolute right-[2px] top-[25%] bottom-[25%] w-[2px] rounded-full bg-white/40" />
        )}
      </div>

      {/* Clip inner content */}
      {children}
    </div>
  );
});
