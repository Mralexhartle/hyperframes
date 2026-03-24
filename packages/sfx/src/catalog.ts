import * as transitions from './transitions.js';
import * as ui from './ui.js';
import * as cinematic from './cinematic.js';
import * as ambient from './ambient.js';
import * as musical from './musical.js';
import type { SfxEntry, SfxCategory } from './types.js';

export const catalog: readonly SfxEntry[] = [
  ...Object.values(transitions),
  ...Object.values(ui),
  ...Object.values(cinematic),
  ...Object.values(ambient),
  ...Object.values(musical),
];

export function findSfx(name: string): SfxEntry | undefined {
  return catalog.find((s) => s.name === name);
}

export function findSfxByCategory(category: SfxCategory): readonly SfxEntry[] {
  return catalog.filter((s) => s.category === category);
}

export function resolveSfxUrl(name: string): string | undefined {
  return findSfx(name)?.url;
}
