// Base URL for SFX assets. Uses jsdelivr CDN which auto-serves npm package files.
// Override with SFX_BASE_URL env var for self-hosted setups.
export const SFX_BASE_URL =
  process.env.SFX_BASE_URL ?? 'https://cdn.jsdelivr.net/npm/@hyperframes/sfx@0.1.2/assets';
