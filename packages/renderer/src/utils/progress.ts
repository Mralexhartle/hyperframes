/**
 * Progress tracking and ETA estimation.
 */

export class ProgressTracker {
  private totalFrames: number;
  private framesCaptured = 0;
  private elapsedMs = 0;

  constructor(totalFrames: number) {
    this.totalFrames = totalFrames;
  }

  recordFrame(framesCaptured: number, elapsedMs: number): void {
    this.framesCaptured = framesCaptured;
    this.elapsedMs = elapsedMs;
  }

  captureRate(): number {
    if (this.elapsedMs <= 0) return 0;
    return this.framesCaptured / (this.elapsedMs / 1000);
  }

  estimateTimeRemaining(): number | undefined {
    const rate = this.captureRate();
    if (rate <= 0) return undefined;
    const remaining = this.totalFrames - this.framesCaptured;
    return (remaining / rate) * 1000;
  }

  progress(): number {
    if (this.totalFrames <= 0) return 0;
    return this.framesCaptured / this.totalFrames;
  }
}
