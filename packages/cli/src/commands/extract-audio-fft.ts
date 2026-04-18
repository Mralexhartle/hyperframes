import { defineCommand } from "citty";
import type { Example } from "./_examples.js";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { c } from "../ui/colors.js";
import { extractAudioAnalysis } from "../audio/extract.js";

export const examples: Example[] = [
  ["Extract audio-reactive data from a WAV file", "hyperframes extract-audio-fft narration.wav"],
  ["Analyze an MP3 at 30fps", "hyperframes extract-audio-fft music.mp3 --fps 30"],
  [
    "Use fewer frequency bands",
    "hyperframes extract-audio-fft song.mp4 --bands 8 -o audio-data.json",
  ],
  ["Print metadata as JSON", "hyperframes extract-audio-fft music.mp3 --json"],
];

export default defineCommand({
  meta: {
    name: "extract-audio-fft",
    description:
      "Extract deterministic per-frame RMS and frequency band data for audio-reactive renders",
  },
  args: {
    input: {
      type: "positional",
      description: "Audio or video file to analyze",
      required: true,
    },
    output: {
      type: "string",
      description: "Output JSON path (default: audio-data.json)",
      alias: "o",
    },
    fps: {
      type: "string",
      description: "Analysis frames per second (default: 30)",
      default: "30",
    },
    bands: {
      type: "string",
      description: "Number of logarithmic frequency bands (default: 16)",
      default: "16",
    },
    json: {
      type: "boolean",
      description: "Output result metadata as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const input = resolve(args.input);
    if (!existsSync(input)) {
      console.error(c.error(`File not found: ${args.input}`));
      process.exit(1);
    }

    const output = resolve(args.output ?? "audio-data.json");
    const fps = Number.parseInt(args.fps ?? "30", 10);
    const bands = Number.parseInt(args.bands ?? "16", 10);

    if (!Number.isFinite(fps) || fps < 1) {
      console.error(c.error("--fps must be an integer >= 1"));
      process.exit(1);
    }
    if (!Number.isFinite(bands) || bands < 1) {
      console.error(c.error("--bands must be an integer >= 1"));
      process.exit(1);
    }

    const spin = args.json ? null : clack.spinner();
    spin?.start(
      `Extracting audio data at ${c.accent(`${fps}fps`)} with ${c.accent(String(bands))} bands...`,
    );

    try {
      const data = extractAudioAnalysis(input, fps, bands);
      writeFileSync(output, JSON.stringify(data, null, 2));

      if (args.json) {
        console.log(
          JSON.stringify({
            ok: true,
            fps,
            bands,
            totalFrames: data.totalFrames,
            duration: data.duration,
            outputPath: output,
          }),
        );
      } else {
        spin?.stop(
          c.success(
            `Wrote ${c.accent(output)} (${c.accent(String(data.totalFrames))} frames, ${c.accent(String(bands))} bands)`,
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.json) {
        console.log(JSON.stringify({ ok: false, error: message }));
      } else {
        spin?.stop(c.error(`Audio extraction failed: ${message}`));
      }
      process.exit(1);
    }
  },
});
