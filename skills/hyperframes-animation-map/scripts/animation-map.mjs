#!/usr/bin/env node
// animation-map.mjs — HyperFrames animation visualizer
//
// Reads every GSAP timeline registered in window.__timelines, enumerates each
// tween recursively, samples N frames across each tween window, annotates the
// animated element with a magenta box + label, and emits:
//
//   - animation-map.json       (tweens + per-frame bboxes + flags)
//   - sprites/<idx>_<sel>.png  (one sprite sheet per tween)
//
// Usage:
//   node skills/hyperframes-animation-map/scripts/animation-map.mjs <composition-dir> \
//     [--frames N] [--out <dir>] [--min-duration S] [--width W] [--height H] [--fps N]
//
// The composition directory must contain an index.html. Raw authoring HTML
// works — the producer's file server auto-injects the runtime at serve time.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import sharp from "sharp";

// Use the producer's file server — it auto-injects the HyperFrames runtime
// and render-seek bridge, so raw authoring HTML works without a build step.
import {
  createFileServer,
  createCaptureSession,
  initializeSession,
  closeCaptureSession,
  captureFrameToBuffer,
  getCompositionDuration,
} from "@hyperframes/producer";

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
if (!args.composition) die("missing <composition-dir>");

const FRAMES = Number(args.frames ?? 8);
const OUT_DIR = resolve(args.out ?? ".hyperframes/anim-map");
const MIN_DUR = Number(args["min-duration"] ?? 0.15);
const WIDTH = Number(args.width ?? 1920);
const HEIGHT = Number(args.height ?? 1080);
const FPS = Number(args.fps ?? 30);
const COMP_DIR = resolve(args.composition);

await mkdir(join(OUT_DIR, "sprites"), { recursive: true });

// ─── Main ────────────────────────────────────────────────────────────────────

const server = await createFileServer({ projectDir: COMP_DIR, port: 0 });
const session = await createCaptureSession(
  server.url,
  OUT_DIR,
  { width: WIDTH, height: HEIGHT, fps: FPS, format: "png" },
  null,
);
await initializeSession(session);

try {
  const duration = await getCompositionDuration(session);
  const tweens = await enumerateTweens(session);
  const kept = tweens.filter((tw) => tw.end - tw.start >= MIN_DUR);

  const report = {
    composition: COMP_DIR,
    duration,
    totalTweens: tweens.length,
    mappedTweens: kept.length,
    skippedForMinDuration: tweens.length - kept.length,
    tweens: [],
  };

  for (let i = 0; i < kept.length; i++) {
    const tw = kept[i];
    const times = Array.from({ length: FRAMES }, (_, k) =>
      +(tw.start + ((k + 0.5) / FRAMES) * (tw.end - tw.start)).toFixed(3),
    );
    const frames = [];
    const bboxes = [];
    for (let k = 0; k < times.length; k++) {
      const t = times[k];
      const { buffer: pngBuf } = await captureFrameToBuffer(session, k, t);
      const bbox = await measureTarget(session, tw.selectorHint, t);
      bboxes.push({ t, ...bbox });
      const annotated = await annotate(pngBuf, bbox, {
        label: `${tw.selectorHint}  ${tw.props.join(",")}  t=${t.toFixed(2)}s`,
      });
      frames.push(annotated);
    }

    const flags = computeFlags(tw, bboxes, { width: WIDTH, height: HEIGHT });
    const spriteName = `${String(i + 1).padStart(2, "0")}_${slug(tw.selectorHint)}_${tw.props.join("_") || "anim"}.png`;
    await writeSprite(frames, join(OUT_DIR, "sprites", spriteName));

    report.tweens.push({
      index: i + 1,
      selector: tw.selectorHint,
      targets: tw.targetCount,
      props: tw.props,
      start: +tw.start.toFixed(3),
      end: +tw.end.toFixed(3),
      ease: tw.ease,
      bboxes,
      sprite: `sprites/${spriteName}`,
      flags,
    });
  }

  // Second pass: collision detection across tweens at shared sample times.
  markCollisions(report.tweens);

  await writeFile(
    join(OUT_DIR, "animation-map.json"),
    JSON.stringify(report, null, 2),
  );

  printSummary(report);
} finally {
  await closeCaptureSession(session).catch(() => {});
  server.close();
}

// ─── Timeline introspection ──────────────────────────────────────────────────

async function enumerateTweens(session) {
  return await session.page.evaluate(() => {
    const results = [];
    const registry = window.__timelines || {};

    const selectorOf = (el) => {
      if (!el || !(el instanceof Element)) return null;
      if (el.id) return `#${el.id}`;
      const cls = [...el.classList].slice(0, 2).join(".");
      return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
    };

    const walk = (node, parentOffset = 0) => {
      if (!node) return;
      // Timeline: recurse into its children with the offset adjusted.
      if (typeof node.getChildren === "function") {
        const offset = parentOffset + (node.startTime?.() ?? 0);
        for (const child of node.getChildren(true, true, true)) {
          walk(child, offset);
        }
        return;
      }
      // Tween: capture.
      const targets = (node.targets?.() ?? []).filter((t) => t instanceof Element);
      if (!targets.length) return;
      const vars = node.vars ?? {};
      const props = Object.keys(vars).filter(
        (k) =>
          !["duration", "ease", "delay", "repeat", "yoyo", "onStart", "onUpdate", "onComplete", "stagger"].includes(k),
      );
      const start = parentOffset + (node.startTime?.() ?? 0);
      const end = start + (node.duration?.() ?? 0);
      results.push({
        selectorHint: selectorOf(targets[0]) ?? "(unknown)",
        targetCount: targets.length,
        props,
        start,
        end,
        ease: typeof vars.ease === "string" ? vars.ease : (vars.ease?.toString?.() ?? "none"),
      });
    };

    for (const tl of Object.values(registry)) walk(tl, 0);
    results.sort((a, b) => a.start - b.start);
    return results;
  });
}

async function measureTarget(session, selector, _t) {
  // Seek happens upstream in captureFrameToBuffer; the page state reflects `_t`.
  return await session.page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { x: 0, y: 0, w: 0, h: 0, missing: true };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, selector);
}

// ─── Frame annotation ───────────────────────────────────────────────────────

async function annotate(pngBuf, bbox, { label }) {
  const { width, height } = await sharp(pngBuf).metadata();
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return pngBuf;

  // Clamp bbox to viewport for drawing (the motion may overshoot).
  const x = Math.max(0, bbox.x);
  const y = Math.max(0, bbox.y);
  const w = Math.min(width - x, bbox.w);
  const h = Math.min(height - y, bbox.h);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}"
            fill="none" stroke="#ff00aa" stroke-width="4"/>
      <rect x="${x}" y="${Math.max(0, y - 24)}" width="${Math.min(label.length * 8 + 16, 520)}" height="22" fill="#ff00aa"/>
      <text x="${x + 8}" y="${Math.max(14, y - 8)}" font-family="monospace" font-size="13" fill="#000" font-weight="bold">
        ${escapeXml(label)}
      </text>
    </svg>`;

  return await sharp(pngBuf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function writeSprite(frames, outPath) {
  const cols = frames.length;
  const { width, height } = await sharp(frames[0]).metadata();
  const scale = 0.22;
  const cellW = Math.round(width * scale);
  const cellH = Math.round(height * scale);

  const cells = await Promise.all(
    frames.map((buf) => sharp(buf).resize(cellW, cellH).png().toBuffer()),
  );

  await sharp({
    create: {
      width: cols * cellW,
      height: cellH,
      channels: 3,
      background: { r: 12, g: 12, b: 16 },
    },
  })
    .composite(cells.map((b, i) => ({ input: b, top: 0, left: i * cellW })))
    .png()
    .toFile(outPath);
}

// ─── Flag computation ───────────────────────────────────────────────────────

function computeFlags(tw, bboxes, { width, height }) {
  const flags = [];
  const dur = tw.end - tw.start;

  if (bboxes.every((b) => b.w === 0 || b.h === 0)) flags.push("degenerate");

  const anyOffscreen = bboxes.some(
    (b) =>
      b.x + b.w <= 0 || b.y + b.h <= 0 || b.x >= width || b.y >= height ||
      b.x < -b.w * 0.5 || b.y < -b.h * 0.5 ||
      b.x + b.w > width + b.w * 0.5 || b.y + b.h > height + b.h * 0.5,
  );
  if (anyOffscreen) flags.push("offscreen");

  if (tw.props.includes("opacity") || tw.props.includes("autoAlpha")) {
    // light heuristic: a fade-in should increase alpha; we can't read it
    // from bbox alone, so leave visibility check to the Read step.
  }

  if (dur < 0.2 && tw.props.some((p) => ["y", "x", "opacity", "scale"].includes(p))) {
    flags.push("paced-fast");
  }
  if (dur > 2.0) flags.push("paced-slow");

  return flags;
}

function markCollisions(tweens) {
  for (let i = 0; i < tweens.length; i++) {
    for (let j = i + 1; j < tweens.length; j++) {
      const a = tweens[i];
      const b = tweens[j];
      if (a.end <= b.start || b.end <= a.start) continue;
      // find overlapping sampled times
      for (const ba of a.bboxes) {
        const bb = b.bboxes.find((x) => Math.abs(x.t - ba.t) < 0.05);
        if (!bb) continue;
        const overlap = rectOverlapArea(ba, bb);
        const aArea = ba.w * ba.h;
        if (aArea > 0 && overlap / aArea > 0.3) {
          if (!a.flags.includes("collision")) a.flags.push("collision");
          if (!b.flags.includes("collision")) b.flags.push("collision");
          break;
        }
      }
    }
  }
}

function rectOverlapArea(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function slug(s) {
  return String(s).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "anim";
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function printSummary(report) {
  console.log(`\nAnimation map: ${report.mappedTweens}/${report.totalTweens} tweens (skipped ${report.skippedForMinDuration} micro-tweens)`);
  const flagCounts = {};
  for (const tw of report.tweens) {
    for (const f of tw.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  }
  for (const [f, n] of Object.entries(flagCounts)) {
    console.log(`  ${f}: ${n}`);
  }
}

function parseArgs(argv) {
  const out = {};
  let positional = 0;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1]?.startsWith("--") ? true : argv[++i];
      out[k] = v;
    } else if (positional === 0) {
      out.composition = a;
      positional++;
    }
  }
  return out;
}

function die(msg) {
  console.error(`animation-map: ${msg}`);
  process.exit(2);
}
