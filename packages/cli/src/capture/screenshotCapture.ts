/**
 * Full-page screenshot capture.
 *
 * All page.evaluate() calls use string expressions to avoid
 * tsx/esbuild __name injection (see esbuild issue #1031).
 */

import type { Page } from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SCROLL_PAD = 200;

export async function captureScreenshots(
  page: Page,
  outputDir: string,
  opts: { maxScreenshots?: number } = {},
): Promise<string[]> {
  const maxScreenshots = opts.maxScreenshots ?? 24;
  const screenshotsDir = join(outputDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  // Step 1: Calculate capture positions
  const positions = (await page.evaluate(`(() => {
    var de = document.documentElement;
    var body = document.body;
    var fullHeight = Math.max(de.clientHeight, body.scrollHeight, de.scrollHeight, body.offsetHeight, de.offsetHeight);
    var viewportH = window.innerHeight;
    var yDelta = viewportH - (viewportH > ${SCROLL_PAD} ? ${SCROLL_PAD} : 0);
    var positions = [];
    for (var y = 0; y < fullHeight; y += yDelta) positions.push(y);
    var lastPos = fullHeight - viewportH;
    if (lastPos > 0 && (positions.length === 0 || positions[positions.length - 1] < lastPos - 10)) positions.push(lastPos);
    if (positions.length > ${maxScreenshots}) {
      var sampled = [positions[0]];
      var stride = (positions.length - 1) / (${maxScreenshots} - 1);
      for (var i = 1; i < ${maxScreenshots} - 1; i++) sampled.push(positions[Math.round(i * stride)]);
      sampled.push(positions[positions.length - 1]);
      return sampled;
    }
    return positions;
  })()`)) as number[];

  // Step 2: Disable fixed/sticky elements
  await page.evaluate(`(() => {
    var style = document.createElement("style");
    style.id = "__hf_capture_style";
    style.textContent = "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }";
    document.head.appendChild(style);
    document.querySelectorAll("*").forEach(function(el) {
      var cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.position === "sticky") {
        el.dataset.hfOrigPos = cs.position;
        el.style.setProperty("position", "absolute", "important");
      }
    });
  })()`);

  // Step 3: Capture each position
  await page.evaluate(`window.scrollTo(0, 0)`);
  await new Promise((r) => setTimeout(r, 200));

  const filePaths: string[] = [];

  for (let i = 0; i < positions.length; i++) {
    await page.evaluate(`window.scrollTo(0, ${positions[i]})`);
    await new Promise((r) => setTimeout(r, 350));

    const filename = `section-${String(i).padStart(2, "0")}.png`;
    const filePath = join(screenshotsDir, filename);

    const buffer = await page.screenshot({ type: "png" });
    writeFileSync(filePath, buffer);
    filePaths.push(`screenshots/${filename}`);
  }

  // Step 4: Restore
  await page.evaluate(`(() => {
    var style = document.getElementById("__hf_capture_style");
    if (style) style.remove();
    document.querySelectorAll("[data-hf-orig-pos]").forEach(function(el) {
      el.style.removeProperty("position");
      delete el.dataset.hfOrigPos;
    });
    window.scrollTo(0, 0);
  })()`);

  return filePaths;
}

/**
 * Capture a full-page screenshot using Playwright.
 *
 * Playwright uses CDP Page.getLayoutMetrics + captureBeyondViewport
 * WITHOUT resizing the viewport — this preserves position:fixed,
 * vh units, and CSS stacking contexts that Puppeteer's fullPage breaks.
 *
 * We use a separate Playwright browser instance for just the screenshot,
 * since the main capture pipeline uses Puppeteer.
 */
export async function captureFullPageScreenshot(
  _page: Page,
  outputDir: string,
  url?: string,
): Promise<string | undefined> {
  const screenshotsDir = join(outputDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  if (!url) return undefined;

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    const pwPage = await context.newPage();

    // Mask automation signals
    await pwPage.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await pwPage.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Scroll through to trigger lazy loading
    await pwPage.evaluate(async () => {
      const step = Math.floor(window.innerHeight * 0.7);
      const limit = Math.min(document.body.scrollHeight, 50000);
      for (let y = 0; y < limit; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 200));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 500));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    });

    // Wait for images
    await pwPage
      .waitForFunction(
        () => Array.from(document.querySelectorAll("img")).every((img) => img.complete),
        { timeout: 10000 },
      )
      .catch(() => {});

    // Freeze animations
    await pwPage.addStyleTag({
      content:
        "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });
    await pwPage.waitForTimeout(200);

    const filename = "full-page.png";
    const filePath = join(screenshotsDir, filename);
    await pwPage.screenshot({ path: filePath, fullPage: true, type: "png" });

    // Multi-scroll-position viewport screenshots (captures scroll-driven animation states)
    try {
      const scrollHeight = await pwPage.evaluate(() => document.body.scrollHeight);
      const positions = [0, 0.25, 0.5, 0.75, 1.0];
      for (let i = 0; i < positions.length; i++) {
        const y = Math.floor(scrollHeight * positions[i]!);
        await pwPage.evaluate((scrollY: number) => window.scrollTo(0, scrollY), y);
        await pwPage.waitForTimeout(400); // Wait for scroll-triggered animations to settle
        const scrollFile = join(screenshotsDir, `scroll-${Math.round(positions[i]! * 100)}.png`);
        await pwPage.screenshot({ path: scrollFile, fullPage: false, type: "png" });
      }
    } catch {
      /* scroll screenshots are optional — don't fail the capture */
    }

    await browser.close();
    return `screenshots/${filename}`;
  } catch {
    return undefined;
  }
}
