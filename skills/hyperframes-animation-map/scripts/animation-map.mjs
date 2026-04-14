#!/usr/bin/env node
// animation-map.mjs — HyperFrames animation map for agents
//
// Reads every GSAP timeline registered in window.__timelines, enumerates
// tweens, samples bboxes at N points per tween, computes flags and
// human-readable summaries. Outputs a single animation-map.json.
//
// Usage:
//   node skills/hyperframes-animation-map/scripts/animation-map.mjs <composition-dir> \
//     [--frames N] [--out <dir>] [--min-duration S] [--width W] [--height H] [--fps N]

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  createFileServer,
  createCaptureSession,
  initializeSession,
  closeCaptureSession,
  getCompositionDuration,
} from "@hyperframes/producer";

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
if (!args.composition) die("missing <composition-dir>");

const FRAMES = Number(args.frames ?? 6);
const OUT_DIR = resolve(args.out ?? ".hyperframes/anim-map");
const MIN_DUR = Number(args["min-duration"] ?? 0.15);
const WIDTH = Number(args.width ?? 1920);
const HEIGHT = Number(args.height ?? 1080);
const FPS = Number(args.fps ?? 30);
const COMP_DIR = resolve(args.composition);

await mkdir(OUT_DIR, { recursive: true });

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
    skippedMicroTweens: tweens.length - kept.length,
    tweens: [],
  };

  for (let i = 0; i < kept.length; i++) {
    const tw = kept[i];
    const times = Array.from(
      { length: FRAMES },
      (_, k) => +(tw.start + ((k + 0.5) / FRAMES) * (tw.end - tw.start)).toFixed(3),
    );

    const bboxes = [];
    for (const t of times) {
      await seekTo(session, t);
      const bbox = await measureTarget(session, tw.selectorHint);
      bboxes.push({ t, ...bbox });
    }

    const animProps = tw.props.filter(
      (p) => !["parent", "overwrite", "immediateRender", "startAt", "runBackwards"].includes(p),
    );
    const flags = computeFlags(tw, bboxes, { width: WIDTH, height: HEIGHT });
    const summary = describeTween(tw, animProps, bboxes, flags);

    report.tweens.push({
      index: i + 1,
      selector: tw.selectorHint,
      targets: tw.targetCount,
      props: animProps,
      start: +tw.start.toFixed(3),
      end: +tw.end.toFixed(3),
      duration: +(tw.end - tw.start).toFixed(3),
      ease: tw.ease,
      bboxes,
      flags,
      summary,
    });
  }

  markCollisions(report.tweens);

  // Re-generate summaries for tweens that got collision flags after cross-check
  for (const tw of report.tweens) {
    if (tw.flags.includes("collision") && !tw.summary.includes("collision")) {
      tw.summary += " Overlaps another animated element.";
    }
  }

  await writeFile(join(OUT_DIR, "animation-map.json"), JSON.stringify(report, null, 2));

  printSummary(report);
} finally {
  await closeCaptureSession(session).catch(() => {});
  server.close();
}

// ─── Seek helper ────────────────────────────────────────────────────────────

async function seekTo(session, t) {
  await session.page.evaluate((time) => {
    if (window.__hf && typeof window.__hf.seek === "function") {
      window.__hf.seek(time);
      return;
    }
    const tls = window.__timelines;
    if (tls) {
      for (const tl of Object.values(tls)) {
        if (typeof tl.seek === "function") tl.seek(time);
      }
    }
  }, t);
  await new Promise((r) => setTimeout(r, 50));
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
      if (typeof node.getChildren === "function") {
        const offset = parentOffset + (node.startTime?.() ?? 0);
        for (const child of node.getChildren(true, true, true)) {
          walk(child, offset);
        }
        return;
      }
      const targets = (node.targets?.() ?? []).filter((t) => t instanceof Element);
      if (!targets.length) return;
      const vars = node.vars ?? {};
      const props = Object.keys(vars).filter(
        (k) =>
          ![
            "duration",
            "ease",
            "delay",
            "repeat",
            "yoyo",
            "onStart",
            "onUpdate",
            "onComplete",
            "stagger",
          ].includes(k),
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

async function measureTarget(session, selector) {
  return await session.page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { x: 0, y: 0, w: 0, h: 0, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      opacity: parseFloat(cs.opacity),
      visible: cs.visibility !== "hidden" && cs.display !== "none",
    };
  }, selector);
}

// ─── Tween description (the key output for agents) ──────────────────────────

function describeTween(tw, props, bboxes, flags) {
  const dur = (tw.end - tw.start).toFixed(2);
  const parts = [];

  parts.push(`${tw.selectorHint} animates ${props.join("+")} over ${dur}s (${tw.ease})`);

  // Movement
  const first = bboxes[0];
  const last = bboxes[bboxes.length - 1];
  if (first && last) {
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      const dirs = [];
      if (Math.abs(dy) > 3) dirs.push(dy < 0 ? `${Math.abs(dy)}px up` : `${Math.abs(dy)}px down`);
      if (Math.abs(dx) > 3)
        dirs.push(dx < 0 ? `${Math.abs(dx)}px left` : `${Math.abs(dx)}px right`);
      parts.push(`moves ${dirs.join(" and ")}`);
    }
  }

  // Opacity
  if (first && last && first.opacity !== undefined && last.opacity !== undefined) {
    const o1 = first.opacity;
    const o2 = last.opacity;
    if (Math.abs(o2 - o1) > 0.1) {
      if (o1 < 0.1 && o2 > 0.5) parts.push("fades in");
      else if (o1 > 0.5 && o2 < 0.1) parts.push("fades out");
      else parts.push(`opacity ${o1.toFixed(1)}→${o2.toFixed(1)}`);
    }
  }

  // Scale (from props)
  if (props.includes("scale") || props.includes("scaleX") || props.includes("scaleY")) {
    parts.push("scales");
  }

  // Size changes
  if (first && last) {
    const dw = last.w - first.w;
    const dh = last.h - first.h;
    if (Math.abs(dw) > 5) parts.push(`width ${first.w}→${last.w}px`);
    if (Math.abs(dh) > 5) parts.push(`height ${first.h}→${last.h}px`);
  }

  // Visibility
  if (first && last && first.visible !== last.visible) {
    parts.push(last.visible ? "becomes visible" : "becomes hidden");
  }

  // Final position
  if (last && !last.missing) {
    parts.push(`ends at (${last.x}, ${last.y}) ${last.w}×${last.h}px`);
  }

  // Flags
  if (flags.length > 0) {
    parts.push(`FLAGS: ${flags.join(", ")}`);
  }

  return parts.join(". ") + ".";
}

// ─── Flag computation ───────────────────────────────────────────────────────

function computeFlags(tw, bboxes, { width, height }) {
  const flags = [];
  const dur = tw.end - tw.start;

  if (bboxes.every((b) => b.w === 0 || b.h === 0)) flags.push("degenerate");

  const anyOffscreen = bboxes.some(
    (b) =>
      b.x + b.w <= 0 ||
      b.y + b.h <= 0 ||
      b.x >= width ||
      b.y >= height ||
      b.x < -b.w * 0.5 ||
      b.y < -b.h * 0.5 ||
      b.x + b.w > width + b.w * 0.5 ||
      b.y + b.h > height + b.h * 0.5,
  );
  if (anyOffscreen) flags.push("offscreen");

  if (bboxes.every((b) => b.opacity !== undefined && b.opacity < 0.01 && b.visible)) {
    flags.push("invisible");
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

// ─── Output ─────────────────────────────────────────────────────────────────

function printSummary(report) {
  console.log(
    `\nAnimation map: ${report.mappedTweens}/${report.totalTweens} tweens (skipped ${report.skippedMicroTweens} micro-tweens)`,
  );
  const flagCounts = {};
  for (const tw of report.tweens) {
    for (const f of tw.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  }
  for (const [f, n] of Object.entries(flagCounts)) {
    console.log(`  ${f}: ${n}`);
  }
  if (Object.keys(flagCounts).length === 0) {
    console.log("  no flags raised");
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
