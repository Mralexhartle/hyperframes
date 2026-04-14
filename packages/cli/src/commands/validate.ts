import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject } from "../utils/project.js";
import { c } from "../ui/colors.js";
import { withMeta } from "../utils/updateCheck.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ConsoleEntry {
  level: "error" | "warning";
  text: string;
  url?: string;
  line?: number;
}

interface ContrastEntry {
  time: number;
  selector: string;
  text: string;
  ratio: number;
  wcagAA: boolean;
  large: boolean;
  fg: string;
  bg: string;
}

// Browser-side WCAG audit code — kept as a raw string so esbuild doesn't
// transform it (page.evaluate serializes functions and __name helpers break).
const CONTRAST_AUDIT_SCRIPT = `
window.__contrastAudit = async function(imgBase64, time) {
  var relLum = function(r, g, b) {
    var ch = function(v) { var s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  var wcagRatio = function(r1,g1,b1,r2,g2,b2) {
    var l1 = relLum(r1,g1,b1), l2 = relLum(r2,g2,b2);
    var L1 = l1 > l2 ? l1 : l2, L2 = l1 > l2 ? l2 : l1;
    return (L1 + 0.05) / (L2 + 0.05);
  };
  var parseColor = function(c) {
    var m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return [0,0,0,1];
    var p = m[1].split(",").map(function(s){return parseFloat(s.trim())});
    return [p[0], p[1], p[2], p[3] != null ? p[3] : 1];
  };
  var selectorOf = function(el) {
    if (el.id) return "#" + el.id;
    var cls = Array.from(el.classList).slice(0,2).join(".");
    return cls ? el.tagName.toLowerCase() + "." + cls : el.tagName.toLowerCase();
  };
  var median = function(arr) {
    var s = arr.slice().sort(function(a,b){return a-b});
    return s[Math.floor(s.length / 2)];
  };
  var img = new Image();
  await new Promise(function(resolve) { img.onload = resolve; img.src = "data:image/png;base64," + imgBase64; });
  var canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1920;
  canvas.height = img.naturalHeight || 1080;
  var ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0);
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var px = imageData.data;
  var w = canvas.width;
  var out = [];
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  var node;
  while ((node = walker.nextNode())) {
    var el = node;
    var hasText = false;
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3 && (el.childNodes[i].textContent || "").trim().length > 0) { hasText = true; break; }
    }
    if (!hasText) continue;
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (parseFloat(cs.opacity) <= 0.01) continue;
    var rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    var fg = parseColor(cs.color);
    if (fg[3] <= 0.01) continue;
    var rr = [], gg = [], bb = [];
    var x0 = Math.max(0, Math.floor(rect.x) - 4);
    var x1 = Math.min(w - 1, Math.ceil(rect.x + rect.width) + 4);
    var y0 = Math.max(0, Math.floor(rect.y) - 4);
    var y1 = Math.min(canvas.height - 1, Math.ceil(rect.y + rect.height) + 4);
    var pushPx = function(px_x, px_y) { var idx = (px_y * w + px_x) * 4; rr.push(px[idx]); gg.push(px[idx+1]); bb.push(px[idx+2]); };
    for (var x = x0; x <= x1; x++) { pushPx(x, y0); pushPx(x, y1); }
    for (var y = y0; y <= y1; y++) { pushPx(x0, y); pushPx(x1, y); }
    var bgR = median(rr), bgG = median(gg), bgB = median(bb);
    var compR = Math.round(fg[0]*fg[3] + bgR*(1-fg[3]));
    var compG = Math.round(fg[1]*fg[3] + bgG*(1-fg[3]));
    var compB = Math.round(fg[2]*fg[3] + bgB*(1-fg[3]));
    var ratio = +wcagRatio(compR,compG,compB, bgR,bgG,bgB).toFixed(2);
    var fontSize = parseFloat(cs.fontSize);
    var fontWeight = Number(cs.fontWeight) || 400;
    var large = fontSize >= 24 || (fontSize >= 19 && fontWeight >= 700);
    var aa = large ? ratio >= 3 : ratio >= 4.5;
    out.push({ time:time, selector:selectorOf(el), text:(el.textContent||"").trim().slice(0,50), ratio:ratio, wcagAA:aa, large:large, fg:"rgb("+compR+","+compG+","+compB+")", bg:"rgb("+bgR+","+bgG+","+bgB+")" });
  }
  return out;
};
`;

/**
 * Run WCAG contrast audit on the live page. Takes screenshots at N timestamps,
 * samples bg pixels via browser canvas (no Node image deps), computes ratios.
 */
async function runContrastAudit(
  page: import("puppeteer-core").Page,
  samples: number,
): Promise<ContrastEntry[]> {
  // Get duration — try runtime first, fall back to data-duration attribute
  const duration: number = await page.evaluate(() => {
    if (window.__hf?.duration && window.__hf.duration > 0) return window.__hf.duration;
    const root = document.querySelector("[data-composition-id][data-duration]");
    return root ? parseFloat(root.getAttribute("data-duration") ?? "0") : 0;
  });
  if (duration <= 0) return [];

  // Inject the audit function into the page (avoids esbuild transform issues)
  await page.addScriptTag({ content: CONTRAST_AUDIT_SCRIPT });

  const results: ContrastEntry[] = [];
  const timestamps = Array.from(
    { length: samples },
    (_, i) => +(((i + 0.5) / samples) * duration).toFixed(3),
  );

  for (const t of timestamps) {
    // Seek
    await page.evaluate((time: number) => {
      if (window.__hf && typeof window.__hf.seek === "function") {
        window.__hf.seek(time);
        return;
      }
      const timelines = (window as Record<string, unknown>).__timelines as
        | Record<string, { seek: (t: number) => void }>
        | undefined;
      if (timelines) {
        for (const tl of Object.values(timelines)) {
          if (typeof tl.seek === "function") tl.seek(time);
        }
      }
    }, t);
    await new Promise((r) => setTimeout(r, 150));

    // Screenshot
    const screenshot = await page.screenshot({ encoding: "base64", type: "png" });

    // Pass screenshot to browser via a global, call the injected audit function
    await page.evaluate((b64: string) => {
      (window as Record<string, unknown>).__screenshotB64 = b64;
    }, screenshot as string);
    const entries = await page.evaluate(`
      (async function() {
        if (typeof window.__contrastAudit !== 'function') return [];
        var result = await window.__contrastAudit(window.__screenshotB64, ${t});
        delete window.__screenshotB64;
        return result;
      })()
    `);

    results.push(...(entries as ContrastEntry[]));
  }

  return results;
}

/**
 * Bundle the project HTML with the runtime injected, serve it via a minimal
 * static server, open headless Chrome, and collect console errors.
 */
async function validateInBrowser(
  projectDir: string,
  opts: { timeout?: number; contrast?: boolean },
): Promise<{ errors: ConsoleEntry[]; warnings: ConsoleEntry[]; contrast?: ContrastEntry[] }> {
  const { bundleToSingleHtml } = await import("@hyperframes/core/compiler");
  const { ensureBrowser } = await import("../browser/manager.js");

  // 1. Bundle
  let html = await bundleToSingleHtml(projectDir);

  // Inject local runtime if available
  const runtimePath = resolve(
    __dirname,
    "..",
    "..",
    "..",
    "core",
    "dist",
    "hyperframe.runtime.iife.js",
  );
  if (existsSync(runtimePath)) {
    const runtimeSource = readFileSync(runtimePath, "utf-8");
    html = html.replace(
      /<script[^>]*data-hyperframes-preview-runtime[^>]*src="[^"]*"[^>]*><\/script>/,
      () => `<script data-hyperframes-preview-runtime="1">${runtimeSource}</script>`,
    );
  }

  // 2. Start minimal file server for project assets (audio, images, fonts, json)
  const { createServer } = await import("node:http");
  const { getMimeType } = await import("@hyperframes/core/studio-api");

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }
    // Serve project files
    const filePath = join(projectDir, decodeURIComponent(url));
    if (existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": getMimeType(filePath) });
      res.end(readFileSync(filePath));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const port = await new Promise<number>((resolvePort) => {
    server.listen(0, () => {
      const addr = server.address();
      resolvePort(typeof addr === "object" && addr ? addr.port : 0);
    });
  });

  const errors: ConsoleEntry[] = [];
  const warnings: ConsoleEntry[] = [];
  let contrast: ContrastEntry[] | undefined;

  try {
    // 3. Launch headless Chrome
    const browser = await ensureBrowser();
    const puppeteer = await import("puppeteer-core");
    const chromeBrowser = await puppeteer.default.launch({
      headless: true,
      executablePath: browser.executablePath,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });

    const page = await chromeBrowser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 4. Capture console messages
    page.on("console", (msg) => {
      const type = msg.type();
      const loc = msg.location();
      const text = msg.text();
      if (type === "error") {
        // Network errors show as console errors but with no useful location.
        // We capture those separately via response/requestfailed events.
        if (text.startsWith("Failed to load resource")) return;
        errors.push({ level: "error", text, url: loc.url, line: loc.lineNumber });
      } else if (type === "warn") {
        warnings.push({ level: "warning", text, url: loc.url, line: loc.lineNumber });
      }
    });

    // Capture uncaught exceptions
    page.on("pageerror", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ level: "error", text: message });
    });

    // Capture failed network requests for project assets (skip favicon, data: URIs)
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (url.includes("favicon")) return;
      if (url.startsWith("data:")) return;
      // Extract the path relative to the server
      const urlObj = new URL(url);
      const path = decodeURIComponent(urlObj.pathname).replace(/^\//, "");
      const failure = req.failure()?.errorText ?? "net::ERR_FAILED";
      errors.push({ level: "error", text: `Failed to load ${path}: ${failure}`, url });
    });

    // Capture HTTP errors (404, 500, etc.) for project assets
    page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) {
        const url = res.url();
        if (url.includes("favicon")) return;
        const urlObj = new URL(url);
        const path = decodeURIComponent(urlObj.pathname).replace(/^\//, "");
        errors.push({ level: "error", text: `${status} loading ${path}`, url });
      }
    });

    // 5. Navigate and wait
    const timeoutMs = opts.timeout ?? 3000;
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // Wait for scripts to settle
    await new Promise((r) => setTimeout(r, timeoutMs));

    // 6. Contrast audit (optional)
    if (opts.contrast) {
      contrast = await runContrastAudit(page, 5);
    }

    await chromeBrowser.close();
  } finally {
    server.close();
  }

  return { errors, warnings, contrast };
}

export default defineCommand({
  meta: {
    name: "validate",
    description: `Load a composition in headless Chrome and report console errors

Examples:
  hyperframes validate
  hyperframes validate ./my-project
  hyperframes validate --json
  hyperframes validate --timeout 5000`,
  },
  args: {
    dir: {
      type: "positional",
      description: "Project directory",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
    contrast: {
      type: "boolean",
      description:
        "Run WCAG contrast audit on text elements (samples 5 timestamps). Enabled by default.",
      default: true,
    },
    timeout: {
      type: "string",
      description: "Ms to wait for scripts to settle (default: 3000)",
      default: "3000",
    },
  },
  async run({ args }) {
    const project = resolveProject(args.dir);
    const timeout = parseInt(args.timeout as string, 10) || 3000;

    const useContrast = args.contrast ?? true;

    if (!args.json) {
      console.log(`${c.accent("◆")}  Validating ${c.accent(project.name)} in headless Chrome`);
    }

    try {
      const { errors, warnings, contrast } = await validateInBrowser(project.dir, {
        timeout,
        contrast: useContrast,
      });

      // Contrast failures are warnings (visible but don't block exit code)
      const contrastFailures = (contrast ?? []).filter((e) => !e.wcagAA);
      const contrastPassed = (contrast ?? []).filter((e) => e.wcagAA);

      if (args.json) {
        console.log(
          JSON.stringify(
            withMeta({
              ok: errors.length === 0,
              errors,
              warnings,
              contrast: contrast ?? undefined,
              contrastFailures: contrastFailures.length,
            }),
            null,
            2,
          ),
        );
        process.exit(errors.length > 0 ? 1 : 0);
      }

      if (errors.length === 0 && warnings.length === 0 && contrastFailures.length === 0) {
        if (contrastPassed.length > 0) {
          console.log(
            `${c.success("◇")}  No console errors · ${contrastPassed.length} text elements pass WCAG AA`,
          );
        } else {
          console.log(`${c.success("◇")}  No console errors`);
        }
        return;
      }

      console.log();
      for (const e of errors) {
        const loc = e.line ? ` (line ${e.line})` : "";
        console.log(`  ${c.error("✗")} ${e.text}${c.dim(loc)}`);
      }
      for (const w of warnings) {
        const loc = w.line ? ` (line ${w.line})` : "";
        console.log(`  ${c.warn("⚠")} ${w.text}${c.dim(loc)}`);
      }
      if (contrastFailures.length > 0) {
        console.log();
        console.log(`  ${c.warn("⚠")} WCAG AA contrast warnings (${contrastFailures.length}):`);
        for (const cf of contrastFailures) {
          console.log(
            `    ${c.warn("·")} ${cf.selector} ${c.dim(`"${cf.text}"`)} — ${c.warn(cf.ratio + ":1")} ${c.dim(`(need ${cf.large ? "3" : "4.5"}:1, t=${cf.time}s)`)}`,
          );
        }
      }
      console.log();
      const parts = [`${errors.length} error(s)`, `${warnings.length} warning(s)`];
      if (contrastFailures.length > 0) parts.push(`${contrastFailures.length} contrast warning(s)`);
      console.log(`${c.accent("◇")}  ${parts.join(", ")}`);

      process.exit(errors.length > 0 ? 1 : 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (args.json) {
        console.log(
          JSON.stringify(
            withMeta({ ok: false, error: message, errors: [], warnings: [] }),
            null,
            2,
          ),
        );
        process.exit(1);
      }
      console.error(`${c.error("✗")} ${message}`);
      process.exit(1);
    }
  },
});
