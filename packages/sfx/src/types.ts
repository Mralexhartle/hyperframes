export type SfxCategory = 'transitions' | 'ui' | 'cinematic' | 'ambient' | 'musical';

export type SfxEntry = {
  readonly name: string;
  readonly category: SfxCategory;
  readonly url: string;
  readonly duration: number; // seconds
  readonly format: 'mp3';
  readonly license: 'CC0-1.0';
  readonly tags: readonly string[];
};
