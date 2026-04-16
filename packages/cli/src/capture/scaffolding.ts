/**
 * Project scaffolding helpers for the website capture pipeline.
 *
 * Handles .env file loading and HyperFrames project scaffold generation
 * (index.html, meta.json, CLAUDE.md).
 */

import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CatalogedAsset } from "./assetCataloger.js";
import type { CaptureResult, DesignTokens } from "./types.js";

/**
 * Load .env file by walking up from startDir (up to 5 levels).
 * Sets process.env keys that are not already set. Best-effort — never throws.
 */
export function loadEnvFile(startDir: string): void {
  try {
    let dir = resolve(startDir);
    for (let i = 0; i < 5; i++) {
      const envPath = resolve(dir, ".env");
      try {
        const envContent = readFileSync(envPath, "utf-8");
        for (const line of envContent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
        break;
      } catch {
        dir = resolve(dir, "..");
      }
    }
  } catch {
    /* .env loading is best-effort */
  }
}

/**
 * Generate the project scaffold files: index.html, meta.json, and CLAUDE.md.
 *
 * Only creates files that don't already exist (index.html, meta.json).
 * Always generates CLAUDE.md via agentPromptGenerator.
 */
export async function generateProjectScaffold(
  outputDir: string,
  url: string,
  tokens: DesignTokens,
  animationCatalog: CaptureResult["animationCatalog"],
  hasScreenshots: boolean,
  hasLotties: boolean,
  hasShaders: boolean,
  catalogedAssets: CatalogedAsset[],
  progress: (stage: string, detail?: string) => void,
  warnings: string[],
): Promise<void> {
  // Ensure capture output is a valid HyperFrames project (index.html + meta.json)
  const indexPath = join(outputDir, "index.html");
  const metaPath = join(outputDir, "meta.json");
  if (!existsSync(indexPath)) {
    writeFileSync(
      indexPath,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <!-- Root composition wrapper — AGENT: update data-duration to match total video length -->
    <div data-composition-id="main" data-width="1920" data-height="1080" data-start="0" data-duration="28">

      <!-- SCENE SLOTS — AGENT: adjust count, durations, and IDs to match your scene plan -->
      <div id="scene-1" data-composition-src="compositions/scene-1.html" data-start="0" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>
      <div id="scene-2" data-composition-src="compositions/scene-2.html" data-start="7" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>
      <div id="scene-3" data-composition-src="compositions/scene-3.html" data-start="14" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>
      <div id="scene-4" data-composition-src="compositions/scene-4.html" data-start="21" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>

      <!-- NARRATION — AGENT: update src after generating TTS -->
      <audio id="narration" data-start="0" data-duration="28" data-track-index="0" data-volume="1" src="narration.wav"></audio>

      <!-- CAPTIONS (optional — only add if user requests captions/subtitles) -->

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`,
      "utf-8",
    );
  }
  if (!existsSync(metaPath)) {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    writeFileSync(
      metaPath,
      JSON.stringify({ id: hostname + "-video", name: tokens.title || hostname }, null, 2),
      "utf-8",
    );
  }

  // Generate CLAUDE.md + .cursorrules (AI agent instructions — always, regardless of API keys)
  try {
    const { generateAgentPrompt } = await import("./agentPromptGenerator.js");
    generateAgentPrompt(
      outputDir,
      url,
      tokens,
      animationCatalog,
      hasScreenshots,
      hasLotties,
      hasShaders,
      catalogedAssets,
    );
    progress("agent", "CLAUDE.md generated");
  } catch (err) {
    warnings.push(`CLAUDE.md generation failed: ${err}`);
  }
}
