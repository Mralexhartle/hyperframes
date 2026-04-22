// Telemetry permanently disabled in this fork.

export function shouldTrack(): boolean {
  return false;
}

export function trackEvent(_event: string, _properties: Record<string, unknown> = {}): void {}

export async function flush(): Promise<void> {}

export function flushSync(): void {}

export function showTelemetryNotice(): boolean {
  return false;
}
