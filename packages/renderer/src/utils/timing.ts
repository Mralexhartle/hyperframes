/**
 * Frame timing utilities.
 *
 * Generates frame timestamps and distributes frame ranges
 * across parallel capture workers (iframes).
 */

export interface FrameRange {
  start: number;
  end: number;
}

export function generateFrameTimes(durationSeconds: number, fps: number): number[] {
  if (durationSeconds <= 0 || fps <= 0) return [];
  const totalFrames = Math.ceil(durationSeconds * fps);
  const frameDuration = 1 / fps;
  const times: number[] = [];
  for (let i = 0; i < totalFrames; i++) {
    times.push(i * frameDuration);
  }
  return times;
}

export function distributeFrames(totalFrames: number, workerCount: number): FrameRange[] {
  const effectiveWorkers = Math.min(workerCount, totalFrames);
  if (effectiveWorkers <= 0) return [];
  const ranges: FrameRange[] = [];
  const baseSize = Math.floor(totalFrames / effectiveWorkers);
  const remainder = totalFrames % effectiveWorkers;
  let cursor = 0;
  for (let i = 0; i < effectiveWorkers; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    ranges.push({ start: cursor, end: cursor + size - 1 });
    cursor += size;
  }
  return ranges;
}
