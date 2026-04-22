// Telemetry permanently disabled in this fork.

export function trackCommand(_command: string): void {}

export function trackRenderComplete(_props: Record<string, unknown>): void {}

export function trackRenderError(_props: Record<string, unknown>): void {}

export function trackInitTemplate(_templateId: string): void {}

export function trackBrowserInstall(): void {}
