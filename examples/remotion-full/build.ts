#!/usr/bin/env npx tsx
/**
 * Bundle the Remotion composition for browser use in HyperFrames.
 *
 * Usage: npx tsx build.ts
 * Output: dist/bundle.js
 */
import { build } from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["remotion-src/entry.tsx"],
  bundle: true,
  outfile: "dist/bundle.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  // Bundle everything — React, Remotion, and our code into one file
  external: [],
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
  },
});

console.log("Built dist/bundle.js");
