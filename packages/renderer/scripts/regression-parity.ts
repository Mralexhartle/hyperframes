#!/usr/bin/env npx tsx
/**
 * Regression Parity Harness
 *
 * Compiles test compositions via the server-side producer, then renders them
 * via the client-side renderer in a real browser, then compares the output
 * against golden reference videos using PSNR.
 *
 * Usage:
 *   npx tsx packages/renderer/scripts/regression-parity.ts [test-name...]
 *   npx tsx packages/renderer/scripts/regression-parity.ts chat vignelli-stacking
 *   npx tsx packages/renderer/scripts/regression-parity.ts  # runs all tests
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

// ── Config ──────────────────────────────────────────────────────────────────

const PRODUCER_TESTS_DIR = resolve("packages/producer/tests");
const RENDERER_DIST = resolve("packages/renderer/dist");
const PARITY_OUTPUT_DIR = resolve("renders/parity-regression");
const MIN_PSNR = 25; // dB — threshold for "visually similar" (30+ = near-identical)
const CHECKPOINTS = 10; // number of frames to compare
const SERVER_PORT = 4789;

// ── Types ───────────────────────────────────────────────────────────────────

type TestMeta = {
  name: string;
  description: string;
  tags: string[];
  minPsnr: number;
  maxFrameFailures: number;
  renderConfig: { fps: 24 | 30 | 60; format?: string };
};

type TestSuite = {
  id: string;
  dir: string;
  srcDir: string;
  meta: TestMeta;
  goldenVideo: string;
};

type CheckpointResult = {
  time: number;
  psnr: number;
  passed: boolean;
};

type TestResult = {
  suite: TestSuite;
  passed: boolean;
  compileOk: boolean;
  renderOk: boolean;
  checkpoints: CheckpointResult[];
  avgPsnr: number;
  minPsnr: number;
  failedFrames: number;
  renderTimeMs: number;
  error?: string;
};

// ── Discovery ───────────────────────────────────────────────────────────────

function discoverTests(filterNames: string[]): TestSuite[] {
  const dirs = readdirSync(PRODUCER_TESTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      if (filterNames.length > 0) return filterNames.includes(name);
      return true;
    });

  const suites: TestSuite[] = [];
  for (const name of dirs) {
    const dir = join(PRODUCER_TESTS_DIR, name);
    const metaPath = join(dir, "meta.json");
    const srcIndex = join(dir, "src", "index.html");
    const goldenMp4 = join(dir, "output", "output.mp4");
    const goldenWebm = join(dir, "output", "output.webm");

    if (!existsSync(metaPath) || !existsSync(srcIndex)) continue;
    const goldenVideo = existsSync(goldenMp4)
      ? goldenMp4
      : existsSync(goldenWebm)
        ? goldenWebm
        : "";
    if (!goldenVideo) continue;

    const meta: TestMeta = JSON.parse(readFileSync(metaPath, "utf-8"));

    // Skip tests tagged "slow" for initial parity — these are long compositions
    // with video elements that need more setup
    if (meta.tags.includes("slow") && filterNames.length === 0) continue;

    suites.push({
      id: name,
      dir,
      srcDir: join(dir, "src"),
      meta,
      goldenVideo,
    });
  }

  return suites;
}

// ── Step 1: Compile ─────────────────────────────────────────────────────────

async function compileComposition(suite: TestSuite, outputDir: string): Promise<string> {
  const compiledPath = join(outputDir, "compiled.html");

  // Use the producer's compileForRender via a small script
  const compileScript = `
    import { compileForRender } from "${resolve("packages/producer/src/services/htmlCompiler.js")}";
    const result = await compileForRender(
      "${suite.srcDir}",
      "${join(suite.srcDir, "index.html")}",
      "${outputDir}",
    );
    // Write the compiled HTML with runtime injected
    const fs = await import("fs");
    fs.writeFileSync("${compiledPath}", result.html);
    // Write metadata
    fs.writeFileSync("${join(outputDir, "compile-meta.json")}", JSON.stringify({
      width: result.width,
      height: result.height,
      staticDuration: result.staticDuration,
      videoCount: result.videos.length,
      audioCount: result.audios.length,
    }));
    console.log(JSON.stringify({ ok: true, width: result.width, height: result.height }));
  `;

  const scriptPath = join(outputDir, "_compile.ts");
  writeFileSync(scriptPath, compileScript);

  const result = spawnSync("npx", ["tsx", scriptPath], {
    cwd: resolve("."),
    encoding: "utf-8",
    timeout: 60_000,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });

  if (result.status !== 0) {
    throw new Error(`Compilation failed for ${suite.id}: ${result.stderr?.slice(-500)}`);
  }

  if (!existsSync(compiledPath)) {
    throw new Error(`Compiled HTML not created for ${suite.id}`);
  }

  return compiledPath;
}

// ── Step 2: Render client-side ──────────────────────────────────────────────

async function renderClientSide(
  suite: TestSuite,
  compiledHtmlPath: string,
  outputDir: string,
): Promise<{ videoPath: string; durationMs: number }> {
  const metaJson = JSON.parse(readFileSync(join(outputDir, "compile-meta.json"), "utf-8"));
  const width = metaJson.width || 1080;
  const height = metaJson.height || 1920;
  const fps = suite.meta.renderConfig.fps;

  // Create a test page that loads the compiled HTML and renders it
  const testPagePath = join(outputDir, "render-test.html");
  const videoOutputPath = join(outputDir, "client-render.mp4");

  const testPage = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Parity Test: ${suite.id}</title></head>
<body>
<script type="module">
  const { render } = await import('http://localhost:${SERVER_PORT}/dist/renderer.bundle.js');

  try {
    const result = await render({
      composition: 'http://localhost:${SERVER_PORT}/parity/${suite.id}/compiled.html',
      fps: ${fps},
      width: ${width},
      height: ${height},
      codec: 'h264',
      format: 'mp4',
      concurrency: 1,
      workerUrl: 'http://localhost:${SERVER_PORT}/dist/worker.bundle.js',
      onProgress: (p) => {
        document.title = p.stage + ' ' + Math.round(p.progress * 100) + '%';
      },
    });

    // Store result globally so the harness can read it
    window.__renderResult = {
      ok: true,
      blobSize: result.blob.size,
      durationMs: result.durationMs,
      mimeType: result.mimeType,
    };

    // Create download link with the blob
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.mp4';
    a.id = 'download-link';
    document.body.appendChild(a);
    document.title = 'DONE';
  } catch (err) {
    window.__renderResult = { ok: false, error: err.message };
    document.title = 'ERROR: ' + err.message;
  }
</script>
</body></html>`;

  writeFileSync(testPagePath, testPage);
  return { videoPath: videoOutputPath, durationMs: 0 };
}

// ── Step 3: PSNR comparison ─────────────────────────────────────────────────

function psnrAtCheckpoint(videoA: string, videoB: string, timeSec: number): number {
  const result = spawnSync(
    "ffmpeg",
    [
      "-ss",
      String(timeSec),
      "-i",
      videoA,
      "-ss",
      String(timeSec),
      "-i",
      videoB,
      "-frames:v",
      "1",
      "-lavfi",
      "psnr=stats_file=/dev/null",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf-8", timeout: 15_000 },
  );

  const output = (result.stderr || "") + (result.stdout || "");
  const match = output.match(/average:(\d+\.?\d*|inf)/);
  if (!match) return 0;
  if (match[1] === "inf") return 100; // identical frames
  return parseFloat(match[1]!);
}

// ── Orchestrator ────────────────────────────────────────────────────────────

async function runTest(suite: TestSuite): Promise<TestResult> {
  const testOutputDir = join(PARITY_OUTPUT_DIR, suite.id);
  if (existsSync(testOutputDir)) rmSync(testOutputDir, { recursive: true });
  mkdirSync(testOutputDir, { recursive: true });

  const result: TestResult = {
    suite,
    passed: false,
    compileOk: false,
    renderOk: false,
    checkpoints: [],
    avgPsnr: 0,
    minPsnr: 0,
    failedFrames: 0,
    renderTimeMs: 0,
  };

  // Step 1: Compile
  console.log(`  [${suite.id}] Compiling...`);
  let compiledPath: string;
  try {
    compiledPath = await compileComposition(suite, testOutputDir);
    result.compileOk = true;
    console.log(`  [${suite.id}] ✓ Compiled`);
  } catch (err) {
    result.error = `Compile failed: ${err instanceof Error ? err.message : String(err)}`;
    console.log(`  [${suite.id}] ✗ ${result.error}`);
    return result;
  }

  // Step 2: Render via browser (agent-browser)
  console.log(`  [${suite.id}] Rendering client-side...`);
  const renderStart = Date.now();
  try {
    await renderClientSide(suite, compiledPath, testOutputDir);

    // Use agent-browser to open the test page and wait for render
    const testPageUrl = `http://localhost:${SERVER_PORT}/parity/${suite.id}/render-test.html`;

    execSync(`agent-browser --session parity-${suite.id} open "${testPageUrl}"`, {
      encoding: "utf-8",
      timeout: 10_000,
    });

    // Wait for render to complete (title changes to DONE or ERROR)
    spawnSync(
      "agent-browser",
      [
        "--session",
        `parity-${suite.id}`,
        "wait",
        "--fn",
        "document.title.startsWith('DONE') || document.title.startsWith('ERROR')",
        "--timeout",
        "120000",
      ],
      { encoding: "utf-8", timeout: 130_000 },
    );

    // Check result
    const titleResult = spawnSync(
      "agent-browser",
      ["--session", `parity-${suite.id}`, "get", "title"],
      { encoding: "utf-8", timeout: 5_000 },
    );
    const title = (titleResult.stdout || "").trim();

    if (title.startsWith("ERROR")) {
      result.error = `Client-side render failed: ${title}`;
      console.log(`  [${suite.id}] ✗ ${result.error}`);
      execSync(`agent-browser --session parity-${suite.id} close`, {
        encoding: "utf-8",
        timeout: 5_000,
      }).toString();
      return result;
    }

    // Download the rendered video
    spawnSync(
      "agent-browser",
      [
        "--session",
        `parity-${suite.id}`,
        "download",
        "#download-link",
        join(testOutputDir, "client-render.mp4"),
      ],
      { encoding: "utf-8", timeout: 30_000 },
    );

    execSync(`agent-browser --session parity-${suite.id} close`, {
      encoding: "utf-8",
      timeout: 5_000,
    }).toString();

    result.renderTimeMs = Date.now() - renderStart;
    const clientVideoPath = join(testOutputDir, "client-render.mp4");

    if (!existsSync(clientVideoPath)) {
      result.error = "Client-side render produced no output file";
      console.log(`  [${suite.id}] ✗ No output file`);
      return result;
    }

    result.renderOk = true;
    console.log(`  [${suite.id}] ✓ Rendered (${result.renderTimeMs}ms)`);

    // Step 3: PSNR comparison
    console.log(`  [${suite.id}] Comparing PSNR...`);

    // Get video duration
    const probeResult = spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clientVideoPath],
      { encoding: "utf-8", timeout: 10_000 },
    );
    const videoDuration = parseFloat((probeResult.stdout || "0").trim()) || 3;

    for (let i = 0; i < CHECKPOINTS; i++) {
      const time = (videoDuration * i) / CHECKPOINTS;
      const psnr = psnrAtCheckpoint(clientVideoPath, suite.goldenVideo, time);
      const passed = psnr >= (suite.meta.minPsnr || MIN_PSNR);
      result.checkpoints.push({ time, psnr, passed });
    }

    const psnrValues = result.checkpoints.map((c) => c.psnr);
    result.avgPsnr = psnrValues.reduce((a, b) => a + b, 0) / psnrValues.length;
    result.minPsnr = Math.min(...psnrValues);
    result.failedFrames = result.checkpoints.filter((c) => !c.passed).length;
    result.passed = result.failedFrames <= (suite.meta.maxFrameFailures || 0);

    console.log(
      `  [${suite.id}] ${result.passed ? "✓" : "✗"} PSNR avg=${result.avgPsnr.toFixed(1)}dB min=${result.minPsnr.toFixed(1)}dB failed=${result.failedFrames}/${CHECKPOINTS}`,
    );
  } catch (err) {
    result.error = `Render failed: ${err instanceof Error ? err.message : String(err)}`;
    console.log(`  [${suite.id}] ✗ ${result.error}`);
  }

  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const filterNames = process.argv.slice(2);
  const suites = discoverTests(filterNames);

  if (suites.length === 0) {
    console.error("No test suites found.");
    process.exit(1);
  }

  console.log(`\n@hyperframes/renderer — Regression Parity Harness`);
  console.log(`${"─".repeat(50)}`);
  console.log(`Tests: ${suites.length}`);
  console.log(`Checkpoints per test: ${CHECKPOINTS}`);
  console.log(`Min PSNR threshold: ${MIN_PSNR} dB\n`);

  // Ensure bundles exist
  if (!existsSync(join(RENDERER_DIST, "renderer.bundle.js"))) {
    console.log("Building renderer bundles...");
    execSync(
      "npx esbuild packages/renderer/src/index.ts --bundle --format=esm --outfile=packages/renderer/dist/renderer.bundle.js --external:@hyperframes/core --platform=browser",
      { encoding: "utf-8" },
    );
    execSync(
      "npx esbuild packages/renderer/src/encoding/worker.ts --bundle --format=esm --outfile=packages/renderer/dist/worker.bundle.js --platform=browser",
      { encoding: "utf-8" },
    );
  }

  // Start static file server
  mkdirSync(PARITY_OUTPUT_DIR, { recursive: true });

  console.log(`Starting file server on port ${SERVER_PORT}...`);
  const serverProcess = require("child_process").spawn(
    "npx",
    ["serve", "-l", String(SERVER_PORT), "-C", "."],
    { cwd: resolve("packages/renderer"), detached: true, stdio: "ignore" },
  );
  serverProcess.unref();

  // Also serve the parity output directory
  // Actually, serve from the repo root so both dist/ and parity/ are accessible
  serverProcess.kill();
  const rootServer = require("child_process").spawn(
    "npx",
    ["serve", "-l", String(SERVER_PORT), "-C", "."],
    { cwd: resolve("."), detached: true, stdio: "ignore" },
  );
  rootServer.unref();

  // Wait for server to start
  await new Promise((r) => setTimeout(r, 2000));

  // Symlink renderer dist into a place the server can find
  const distLink = join(PARITY_OUTPUT_DIR, "..", "dist");
  if (!existsSync(distLink)) {
    const { symlinkSync } = require("fs");
    try {
      symlinkSync(RENDERER_DIST, distLink);
    } catch {}
  }

  const results: TestResult[] = [];
  for (const suite of suites) {
    const result = await runTest(suite);
    results.push(result);
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("REGRESSION PARITY RESULTS");
  console.log(`${"═".repeat(60)}\n`);

  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const psnrStr = r.renderOk
      ? `avg=${r.avgPsnr.toFixed(1)}dB min=${r.minPsnr.toFixed(1)}dB`
      : "N/A";
    console.log(`  ${icon}  ${r.suite.id.padEnd(30)} ${psnrStr.padEnd(30)} ${r.error || ""}`);
    if (r.passed) totalPassed++;
    else totalFailed++;
  }

  console.log(`\n  Passed: ${totalPassed}/${results.length}`);
  console.log(`  Failed: ${totalFailed}/${results.length}\n`);

  // Write JSON report
  const reportPath = join(PARITY_OUTPUT_DIR, "parity-report.json");
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report: ${reportPath}`);

  // Cleanup server
  try {
    rootServer.kill();
  } catch {}

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
