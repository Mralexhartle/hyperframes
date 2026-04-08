/**
 * AI-powered website replica generator.
 *
 * Takes the DESIGN.md + full-page screenshot and asks Claude to rebuild
 * the website as clean, single-file HTML + Tailwind CSS + JS.
 *
 * Prompt structure reverse-engineered from Aura.build's import system.
 * Two modes: with screenshot (primary visual ref) and without (DESIGN.md primary).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AnimationCatalog } from "./animationCataloger.js";

export async function generateReplica(
  designMdPath: string,
  screenshotPath: string | undefined,
  outputDir: string,
  onProgress?: (detail: string) => void,
  implementationCues?: string[],
  pageTextContent?: string,
): Promise<string | undefined> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!anthropicKey && !geminiKey) {
    onProgress?.("No API key — skipping replica generation");
    return undefined;
  }
  const useGemini = !!geminiKey;

  let designMd: string;
  try {
    designMd = readFileSync(designMdPath, "utf-8");
  } catch {
    onProgress?.("Could not read DESIGN.md — skipping replica");
    return undefined;
  }

  // Build message content
  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }
  > = [];

  // Add screenshot if available
  if (screenshotPath) {
    try {
      const absPath = join(outputDir, screenshotPath);
      const imgData = readFileSync(absPath);
      if (imgData.length <= 5 * 1024 * 1024) {
        contentParts.push({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: imgData.toString("base64"),
          },
        });
      }
    } catch {
      // No screenshot
    }
  }

  const hasScreenshot = contentParts.length > 0;
  const cuesBlock =
    implementationCues && implementationCues.length > 0
      ? "\n\nDetected source implementation cues that must be preserved when supported by the source:\n" +
        implementationCues.map((c) => `- ${c}`).join("\n")
      : "";

  const textContentBlock = pageTextContent
    ? `\n\nEXACT PAGE TEXT CONTENT (use these exact strings — do NOT paraphrase or fabricate):\n\n${pageTextContent}`
    : "";

  const promptText = hasScreenshot
    ? buildWithScreenshotPrompt(designMd + textContentBlock, cuesBlock)
    : buildWithoutScreenshotPrompt(designMd + textContentBlock, cuesBlock);

  contentParts.push({
    type: "text" as const,
    text: promptText,
  });

  let html = "";

  if (useGemini) {
    onProgress?.("Generating HTML replica via Gemini API...");
    const { GoogleGenAI } = await import("@google/genai");
    const genai = new GoogleGenAI({ apiKey: geminiKey! });

    // Build Gemini parts: images first, then text
    const geminiParts: Array<
      { inlineData: { mimeType: string; data: string } } | { text: string }
    > = [];
    for (const part of contentParts) {
      if (part.type === "image") {
        geminiParts.push({ inlineData: { mimeType: "image/png", data: part.source.data } });
      }
    }
    geminiParts.push({ text: SYSTEM_PROMPT + "\n\n" + promptText });

    const response = await genai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: geminiParts }],
      config: {
        thinkingConfig: { thinkingBudget: 10000 },
      },
    });
    html = response.text ?? "";
  } else {
    onProgress?.("Generating HTML replica via Claude API...");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey! });

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 32000,
      messages: [{ role: "user", content: contentParts }],
      system: SYSTEM_PROMPT,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        html += event.delta.text;
      }
    }
  }

  const extracted = extractHtmlFromResponse(html);
  if (!extracted) {
    onProgress?.("Replica generation returned invalid HTML — skipping");
    return undefined;
  }

  html = extracted;
  const outputPath = join(outputDir, "replica.html");
  writeFileSync(outputPath, html, "utf-8");

  const sizeKb = (Buffer.byteLength(html) / 1024).toFixed(0);
  onProgress?.(`Replica generated (${sizeKb} KB) — verifying...`);

  // ── Refinement pass: screenshot replica, compare, fix ──
  try {
    // Spin up a tiny HTTP server to serve the replica (file:// blocks CDN scripts)
    const http = await import("node:http");
    const fs = await import("node:fs");
    const replicaContent = fs.readFileSync(outputPath, "utf-8");
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(replicaContent);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const refPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    await refPage.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle", timeout: 30000 });
    await refPage.waitForTimeout(3000); // Wait for Tailwind CDN + fonts to load

    // Cap screenshot height to 7500px for Claude's 8000px limit
    const replicaScreenshotBuf = await refPage.screenshot({
      fullPage: true,
      type: "png",
      clip: useGemini ? undefined : { x: 0, y: 0, width: 1920, height: 7500 },
    });
    await browser.close();
    server.close();

    // Save the replica screenshot for comparison
    const replicaScreenshotPath = join(outputDir, "screenshots", "replica-screenshot.png");
    writeFileSync(replicaScreenshotPath, replicaScreenshotBuf);
    onProgress?.(
      `Replica screenshot taken (${(replicaScreenshotBuf.length / 1024).toFixed(0)} KB)`,
    );

    // Only refine if we have the original screenshot to compare against
    if (screenshotPath && replicaScreenshotBuf.length > 0) {
      const replicaB64 = Buffer.from(replicaScreenshotBuf).toString("base64");

      // Read original screenshot — for Claude, we may need to resize due to 8000px limit
      const absScreenshotPath = join(outputDir, screenshotPath);
      let origBuf = readFileSync(absScreenshotPath);

      // Claude has an 8000px image dimension limit — skip refinement if original is too large
      // (Gemini handles large images fine)
      if (!useGemini) {
        // Check PNG dimensions from header (width at bytes 16-19, height at bytes 20-23)
        if (origBuf.length > 24) {
          const height = origBuf.readUInt32BE(20);
          if (height > 7900) {
            onProgress?.(`Original screenshot too tall for Claude refinement (${height}px > 8000px limit) — skipping`);
            origBuf = Buffer.alloc(0); // Skip refinement
          }
        }
      }

      if (origBuf.length <= 20 * 1024 * 1024) {
        const origB64 = origBuf.toString("base64");

        onProgress?.("Refining replica (comparing screenshots)...");

        const refinementPrompt = `Compare these two screenshots:

IMAGE 1: The ORIGINAL website (the target)
IMAGE 2: My HTML REPLICA (what my code currently produces)

Fix every difference. Output the COMPLETE corrected HTML file.

RULES — you MUST follow these (same rules as the original generation):
- Use Tailwind CSS utility classes for ALL styling. Do NOT rewrite to custom CSS classes.
- Keep the <script src="https://cdn.tailwindcss.com"></script> and tailwind.config.
- Keep Lucide icons with <i data-lucide="..."> and lucide.createIcons().
- Use real image URLs from the DESIGN.md Assets section for ALL visible images, company logos, headshots. NEVER use text spans or gray rectangles as placeholders.
- Use EXACT text from the original — do NOT paraphrase or fabricate.
- ZERO JavaScript functions. CSS-only animations.
- Every section must be visible on page load.

Focus on fixing:
- Missing or wrong sections
- Wrong colors, fonts, spacing
- Missing images that should use DESIGN.md asset URLs
- Company logos that are text instead of real <img> tags
- Layout/alignment differences
- Missing icons

Output ONLY the complete corrected HTML. Start with <!DOCTYPE html>, end with </html>. No explanation.

DESIGN.md for asset reference:

${designMd}`;

        let refinedHtml = "";

        if (useGemini) {
          const { GoogleGenAI } = await import("@google/genai");
          const genai2 = new GoogleGenAI({ apiKey: geminiKey! });
          const refParts: Array<
            { inlineData: { mimeType: string; data: string } } | { text: string }
          > = [
            { inlineData: { mimeType: "image/png", data: origB64 } },
            { inlineData: { mimeType: "image/png", data: replicaB64 } },
            { text: refinementPrompt },
          ];
          const refResponse = await genai2.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: [{ role: "user", parts: refParts }],
            config: { thinkingConfig: { thinkingBudget: 10000 } },
          });
          refinedHtml = refResponse.text ?? "";
        } else {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const client2 = new Anthropic({ apiKey: anthropicKey! });
          const refStream = await client2.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 32000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "image/png" as const,
                      data: origB64,
                    },
                  },
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "image/png" as const,
                      data: replicaB64,
                    },
                  },
                  { type: "text" as const, text: refinementPrompt },
                ],
              },
            ],
            system: "Output ONLY raw HTML. No markdown, no code fences, no explanation.",
          });
          for await (const event of refStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              refinedHtml += event.delta.text;
            }
          }
        }

        const refinedResult = extractHtmlFromResponse(refinedHtml);
        if (refinedResult) {
          writeFileSync(outputPath, refinedResult, "utf-8");
          const refinedKb = (Buffer.byteLength(refinedResult) / 1024).toFixed(0);
          onProgress?.(`Replica refined (${refinedKb} KB)`);
        } else {
          onProgress?.("Refinement returned invalid HTML — keeping original");
        }
      } else {
        onProgress?.(
          `Original screenshot too large for refinement (${(origBuf.length / 1024 / 1024).toFixed(1)} MB)`,
        );
      }
    } else {
      onProgress?.("No original screenshot available for refinement comparison");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onProgress?.(`Refinement error: ${msg.slice(0, 200)}`);
  }

  return "replica.html";
}

function extractHtmlFromResponse(text: string): string | null {
  // Extract HTML from markdown code block if wrapped
  const codeBlockMatch = text.match(/```html\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1]!;
  }
  if (!text.includes("<!DOCTYPE") && !text.includes("<!doctype") && !text.includes("<html")) {
    return null;
  }
  return text;
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You generate single-file HTML implementations of websites from screenshots and design references.

OUTPUT FORMAT:
- Single HTML file. Start with <!DOCTYPE html>, end with </html>.
- No markdown wrapping. No code fences. No explanation or commentary.
- Clean, well-indented, semantic HTML5 with comments marking each section.
- Target 500-900 lines for a full page.

TECH STACK (use EXACTLY this):
- Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
- Extend tailwind.config with the site's exact design tokens (colors, fonts, animations, keyframes).
- Icons: <script src="https://unpkg.com/lucide@latest"></script> with <i data-lucide="icon-name">. Call lucide.createIcons() once at end of <body>. For dark/cinematic sites, use Iconify Solar icons instead.
- Google Fonts via <link> in <head> for typography. For fonts not on Google Fonts, use @font-face with the URL from DESIGN.md Assets.
- CSS @keyframes for marquee/continuous animations defined in tailwind.config or <style>.
- ZERO JavaScript functions. No addEventListener, no IntersectionObserver, no scroll triggers. The only JS is the icon library init call.

TAILWIND RULES:
- Use Tailwind utility classes for ALL styling. No custom CSS classes except @font-face and @keyframes.
- Use arbitrary values for exact colors: text-[#635bff], bg-[#0a2540], text-[48px], tracking-[-0.02em]
- Use responsive prefixes on EVERY layout: sm:, md:, lg: breakpoints throughout.
- Use animate-[name_duration_easing_infinite] for marquee animations.

LAYOUT:
- max-w-[1200px] mx-auto or max-w-7xl mx-auto for containers.
- Bento grids: grid grid-cols-1 md:grid-cols-12 gap-6 with col-span variants.
- Alternate section backgrounds: bg-white and the site's neutral (e.g., bg-[#F7F7F5]).
- Navigation: sticky top-0 z-50 backdrop-blur-md. Hidden md:flex for desktop links, md:hidden for mobile hamburger.

IMAGES & ASSETS (CRITICAL):
- Use EVERY real asset URL from DESIGN.md for visible content — company logos, product screenshots, headshots, backgrounds.
- Company logos in logo walls: If real logo image URLs exist in DESIGN.md, use <img> tags. If the logos are inline SVGs on the original site (common for logo walls), use Iconify Simple Icons: <iconify-icon icon="simple-icons:openai"></iconify-icon> paired with the company name text. Add <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script> for Iconify support.
- Logo walls: opacity-50 grayscale with hover:opacity-100 hover:grayscale-0 transition.
- For product screenshots, testimonial headshots, and background images: MUST use real URLs from DESIGN.md. NEVER use colored rectangles or placeholder divs.

CONTENT:
- Use EXACT text from the screenshot and DESIGN.md. Do NOT paraphrase, abbreviate, or invent any content.
- Preserve exact company names, statistics, quotes, and brand references.

ANIMATIONS (CSS-only):
- Marquee: animate-[marquee_Xs_linear_infinite] with duplicated content for seamless loop.
- Hover: transition-colors, transition-transform, hover:scale-105, group-hover patterns.
- ALL sections fully visible on page load. NEVER use opacity:0 with JS reveal.

DO NOT:
- Write custom CSS classes when Tailwind utilities work.
- Use JavaScript for any visual effect.
- Use placeholder images or Lorem Ipsum.
- Simplify or skip sections that exist in the original.
- Use React, Vue, or any framework.`;

// ── WITH screenshot prompt (Aura-style: screenshot is primary) ───────────────

function buildWithScreenshotPrompt(designMd: string, cuesBlock: string): string {
  return `Recreate the attached webpage EXACTLY like the screenshot as an HTML + JavaScript implementation using Tailwind CSS. Treat the screenshot as the primary visual reference. Use the attached DESIGN.md as a secondary typography and asset inventory reference. Use DESIGN.md only to preserve font families, font weights, typographic tone, and asset references. If DESIGN.md conflicts with the screenshot on colors, surfaces, layout, or composition, follow the screenshot. Avoid long inline SVG markup unless there is no practical alternative. Let the screenshot drive styling decisions instead of adding extra interpretation.

This import is in EXACTLY mode. Treat the screenshot as the primary visual reference and the attached DESIGN.md as a secondary typography and asset inventory reference. If the screenshot and DESIGN.md conflict, follow the screenshot for layout, surfaces, typography, and motion. Use DESIGN.md only to preserve font families, font weights, typographic tone, and asset references. If DESIGN.md conflicts with the screenshot on colors, surfaces, layout, or composition, follow the screenshot. Match the original texts, names, numbers, and brand references unless something is clearly broken or inaccessible.

Preserve motion cues from the screenshot when present, use the attached DESIGN.md as a secondary typography and asset inventory reference, and do not replace the imported design with defaults or a new house style. Use DESIGN.md only to preserve font families, font weights, typographic tone, and asset references. If DESIGN.md conflicts with the screenshot on colors, surfaces, layout, or composition, follow the screenshot.

Referenced design guidance skill (supplemental context): Use this guidance like a referenced skill, not like a second visual source of truth. Use it only to preserve font families, font weights, typographic tone, and asset references. Do not let it override the screenshot for colors, surfaces, layout, or composition.

Rebuild all major sections supported by the source, preserving the original page flow instead of collapsing it into a smaller subset. Match the composition, section order, spacing, imagery placement, and responsive structure as closely as practical from the imported source. Detect and preserve any motion patterns evidenced by the screenshot, including scroll reveals, marquee effects, hover states, masked text reveals, parallax, or ambient background movement. Avoid long inline SVG markup unless there is no practical alternative. Let the screenshot drive styling decisions instead of adding extra interpretation.${cuesBlock}

DESIGN.md:

${designMd}`;
}

// ── WITHOUT screenshot prompt (Aura-style: DESIGN.md is primary) ─────────────

function buildWithoutScreenshotPrompt(designMd: string, cuesBlock: string): string {
  return `Recreate the imported webpage as faithfully as possible using the attached DESIGN.md as the design-system and asset reference. Screenshot capture timed out during import, so no screenshot reference is attached. Use the DESIGN.md to preserve exact structure, section order, and supporting source details. Use the DESIGN.md to preserve exact design-system choices and asset references. Rebuild all major sections supported by the source, preserving the original page flow instead of collapsing it into a smaller subset. Match the composition, section order, spacing, imagery placement, and responsive structure as closely as practical from the imported source. Detect and preserve any motion patterns evidenced by the DESIGN.md, including scroll reveals, marquee effects, hover states, masked text reveals, parallax, or ambient background movement. Avoid long inline SVG markup unless there is no practical alternative. Let the DESIGN.md drive design-system and asset decisions instead of adding extra interpretation. Rebuild it as clean, maintainable HTML, CSS, and JavaScript instead of converting it into React.

This import is in EXACTLY mode. Screenshot capture timed out, so treat the DESIGN.md as the required structural reference and the design-system and asset reference. Match the original texts, names, numbers, and brand references unless something is clearly broken or inaccessible.

Preserve motion cues from the DESIGN.md when present, and do not replace the imported design with defaults or a new house style.${cuesBlock}

DESIGN.md:

${designMd}`;
}

// ── Implementation cue detection ─────────────────────────────────────────────

/**
 * Detect implementation cues from captured data.
 *
 * These match the "Detected source implementation cues" section from
 * Aura.build's import prompts. Each cue is a specific, actionable
 * instruction for the AI to preserve a detected pattern.
 *
 * Detection uses multi-layered signals (Wappalyzer-style):
 * - CSS custom property count
 * - Font declarations
 * - Animation catalog summary
 * - Canvas element count
 * - Background luminance analysis
 * - Detected library names (from script URLs or globals)
 */
export function detectImplementationCues(
  animations: AnimationCatalog | undefined,
  hasCssVars: boolean,
  hasExplicitTypography: boolean,
  hasMarquee: boolean,
  hasCanvas: boolean,
  hasLightSurfaces: boolean,
  detectedLibraries?: string[],
): string[] {
  const cues: string[] = [];

  if (hasLightSurfaces) {
    cues.push(
      "The imported page uses light primary surfaces and high-contrast text. Preserve that surface contrast and overall appearance.",
    );
  }

  if (hasCssVars) {
    cues.push(
      "Preserve the source CSS custom properties and theme tokens for backgrounds, text, buttons, and contrast instead of swapping in generic defaults.",
    );
  }

  if (hasExplicitTypography) {
    cues.push(
      "Typography is explicitly defined in the source. Match the original font families, weights, and headline/body hierarchy instead of defaulting to a system stack.",
    );
  }

  // Library-specific cues
  const libs = detectedLibraries || [];
  const hasGsap = libs.some((l) => l.toLowerCase().includes("gsap"));
  const hasThreeJs = libs.some((l) => l.toLowerCase().includes("three"));

  if (hasGsap || (animations?.summary && animations.summary.webAnimations > 5)) {
    const stack = hasGsap
      ? "GSAP" +
        (libs.some((l) => l.toLowerCase().includes("scrolltrigger")) ? ", ScrollTrigger" : "")
      : "runtime motion";
    cues.push(
      `Preserve the detected runtime motion stack (${stack}) and reproduce comparable scroll reveals, text animations, hover states, or transitions in the generated implementation.`,
    );
  } else if (animations?.summary && animations.summary.scrollTargets > 20) {
    cues.push(
      "Scroll-triggered animations are present in the source. Reproduce comparable scroll reveals in the generated implementation.",
    );
  }

  if (hasMarquee) {
    cues.push(
      "Marquee-style motion is present in the source. Keep that behavior instead of replacing it with a static section.",
    );
  }

  if (hasThreeJs || hasCanvas) {
    cues.push(
      hasThreeJs
        ? "Three.js evidence is present in the imported source. Preserve the 3D scene or the closest faithful equivalent rather than substituting a flat background."
        : "Canvas/WebGL evidence is present in the imported source. Preserve the visual effect or the closest faithful equivalent rather than substituting a flat background.",
    );
  }

  return cues;
}
