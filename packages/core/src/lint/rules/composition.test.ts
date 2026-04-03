import { describe, it, expect } from "vitest";
import { lintHyperframeHtml } from "../hyperframeLinter.js";

describe("composition rules", () => {
  it("reports info for composition with external CDN script dependency", () => {
    const html = `<template id="rockets-template">
  <div data-composition-id="rockets" data-width="1920" data-height="1080">
    <div id="rocket-container"></div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["rockets"] = gsap.timeline({ paused: true });
    </script>
  </div>
</template>`;
    const result = lintHyperframeHtml(html, { filePath: "compositions/rockets.html" });
    const finding = result.findings.find(
      (f) => f.code === "external_script_dependency" && f.message.includes("cdnjs.cloudflare.com"),
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("info");
    // info findings do not count as errors — ok should still be true
    expect(result.ok).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("does not report external_script_dependency for inline scripts", () => {
    const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <script>
      window.__timelines = {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </div>
</body></html>`;
    const result = lintHyperframeHtml(html);
    expect(result.findings.find((f) => f.code === "external_script_dependency")).toBeUndefined();
  });

  it("reports error when querySelector uses template literal variable", () => {
    const html = `
<html><body>
  <div data-composition-id="main" data-width="1920" data-height="1080">
    <div class="chart"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const compId = "main";
    const el = document.querySelector(\`[data-composition-id="\${compId}"] .chart\`);
    const tl = gsap.timeline({ paused: true });
    window.__timelines["main"] = tl;
  </script>
</body></html>`;
    const result = lintHyperframeHtml(html);
    const finding = result.findings.find((f) => f.code === "template_literal_selector");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
  });

  it("reports error for querySelectorAll with template literal variable", () => {
    const html = `
<html><body>
  <div data-composition-id="main" data-width="1920" data-height="1080"></div>
  <script>
    window.__timelines = window.__timelines || {};
    const id = "main";
    document.querySelectorAll(\`[data-composition-id="\${id}"] .item\`);
    const tl = gsap.timeline({ paused: true });
    window.__timelines["main"] = tl;
  </script>
</body></html>`;
    const result = lintHyperframeHtml(html);
    const finding = result.findings.find((f) => f.code === "template_literal_selector");
    expect(finding).toBeDefined();
  });

  it("does not report error for hardcoded querySelector strings", () => {
    const html = `
<html><body>
  <div data-composition-id="main" data-width="1920" data-height="1080">
    <div class="chart"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const el = document.querySelector('[data-composition-id="main"] .chart');
    const tl = gsap.timeline({ paused: true });
    window.__timelines["main"] = tl;
  </script>
</body></html>`;
    const result = lintHyperframeHtml(html);
    const finding = result.findings.find((f) => f.code === "template_literal_selector");
    expect(finding).toBeUndefined();
  });

  describe("timed_element_missing_clip_class", () => {
    it("flags element with data-start but no class='clip'", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080">
    <div id="box" data-start="0" data-duration="2">Hello</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "timed_element_missing_clip_class");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
    });

    it("does not flag element that has class='clip'", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080">
    <div id="box" class="clip" data-start="0" data-duration="2">Hello</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "timed_element_missing_clip_class");
      expect(finding).toBeUndefined();
    });

    it("does not flag audio or video elements", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080">
    <audio data-start="0" data-duration="5" src="music.mp3"></audio>
    <video data-start="0" data-duration="5" src="clip.mp4"></video>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "timed_element_missing_clip_class");
      expect(finding).toBeUndefined();
    });
  });

  describe("overlapping_clips_same_track", () => {
    it("flags overlapping clips on the same track", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080">
    <div class="clip" data-start="0" data-duration="3" data-track-index="0">A</div>
    <div class="clip" data-start="2" data-duration="3" data-track-index="0">B</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "overlapping_clips_same_track");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("error");
    });

    it("does not flag clips on different tracks", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080">
    <div class="clip" data-start="0" data-duration="3" data-track-index="0">A</div>
    <div class="clip" data-start="1" data-duration="3" data-track-index="1">B</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "overlapping_clips_same_track");
      expect(finding).toBeUndefined();
    });

    it("does not flag sequential clips on the same track", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080">
    <div class="clip" data-start="0" data-duration="2" data-track-index="0">A</div>
    <div class="clip" data-start="2" data-duration="2" data-track-index="0">B</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "overlapping_clips_same_track");
      expect(finding).toBeUndefined();
    });
  });

  describe("invalid_data_props_json", () => {
    it("flags invalid JSON in data-props", () => {
      const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div id="card" data-composition-src="card.html" data-props='{broken json}' data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "invalid_data_props_json");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("error");
    });

    it("flags array in data-props", () => {
      const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div id="card" data-composition-src="card.html" data-props='[1,2,3]' data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find((f) => f.code === "invalid_data_props_json");
      expect(finding).toBeDefined();
    });

    it("passes with valid data-props JSON", () => {
      const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div id="card" data-composition-src="card.html" data-props='{"title":"Pro","price":29}' data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      expect(result.findings.find((f) => f.code === "invalid_data_props_json")).toBeUndefined();
    });

    it("no finding when data-props is absent", () => {
      const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div id="card" data-composition-src="card.html" data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      expect(result.findings.find((f) => f.code === "invalid_data_props_json")).toBeUndefined();
    });
  });

  describe("mustache_placeholder_without_default", () => {
    it("warns about placeholders without defaults in sub-compositions", () => {
      const html = `<template id="card-template">
  <div data-composition-id="card" data-width="1920" data-height="1080">
    <h2>{{title}}</h2>
    <p>{{price}}</p>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["card"] = gsap.timeline({ paused: true });
    </script>
  </div>
</template>`;
      const result = lintHyperframeHtml(html, { filePath: "compositions/card.html" });
      const findings = result.findings.filter(
        (f) => f.code === "mustache_placeholder_without_default",
      );
      expect(findings).toHaveLength(2);
      expect(findings[0]?.message).toContain("{{title}}");
      expect(findings[1]?.message).toContain("{{price}}");
      expect(findings[0]?.severity).toBe("warning");
    });

    it("does not warn when placeholders have defaults", () => {
      const html = `<template id="card-template">
  <div data-composition-id="card" data-width="1920" data-height="1080">
    <h2>{{title:Card Title}}</h2>
    <p>{{price:$0}}</p>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["card"] = gsap.timeline({ paused: true });
    </script>
  </div>
</template>`;
      const result = lintHyperframeHtml(html, { filePath: "compositions/card.html" });
      expect(
        result.findings.find((f) => f.code === "mustache_placeholder_without_default"),
      ).toBeUndefined();
    });

    it("does not warn for placeholders in root index.html", () => {
      const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <h2>{{title}}</h2>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html, { filePath: "index.html" });
      expect(
        result.findings.find((f) => f.code === "mustache_placeholder_without_default"),
      ).toBeUndefined();
    });

    it("deduplicates warnings for the same key used multiple times", () => {
      const html = `<template id="card-template">
  <div data-composition-id="card" data-width="1920" data-height="1080">
    <h2>{{title}}</h2>
    <p>Also: {{title}}</p>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["card"] = gsap.timeline({ paused: true });
    </script>
  </div>
</template>`;
      const result = lintHyperframeHtml(html, { filePath: "compositions/card.html" });
      const findings = result.findings.filter(
        (f) => f.code === "mustache_placeholder_without_default",
      );
      expect(findings).toHaveLength(1);
    });
  });

  describe("unused_data_props_key", () => {
    it("warns about props keys that don't match any placeholder in inline template", () => {
      const html = `
<html><body>
  <template id="card-template">
    <div data-composition-id="card" data-width="1920" data-height="1080">
      <h2>{{title:Default}}</h2>
      <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
      <script>
        window.__timelines = window.__timelines || {};
        window.__timelines["card"] = gsap.timeline({ paused: true });
      </script>
    </div>
  </template>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div id="my-card" data-composition-id="card"
      data-props='{"title":"Pro","typo":"oops"}'
      data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const findings = result.findings.filter((f) => f.code === "unused_data_props_key");
      expect(findings).toHaveLength(1);
      expect(findings[0]?.message).toContain('"typo"');
      expect(findings[0]?.severity).toBe("warning");
      expect(findings[0]?.fixHint).toContain("{{title}}");
    });

    it("does not warn when all props keys match placeholders", () => {
      const html = `
<html><body>
  <template id="card-template">
    <div data-composition-id="card" data-width="1920" data-height="1080">
      <h2>{{title:Default}}</h2>
      <p>{{price:$0}}</p>
      <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
      <script>
        window.__timelines = window.__timelines || {};
        window.__timelines["card"] = gsap.timeline({ paused: true });
      </script>
    </div>
  </template>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div data-composition-id="card"
      data-props='{"title":"Pro","price":"$29"}'
      data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      expect(result.findings.find((f) => f.code === "unused_data_props_key")).toBeUndefined();
    });

    it("skips external compositions (data-composition-src)", () => {
      const html = `
<html><body>
  <div id="root" data-composition-id="main" data-width="1920" data-height="1080">
    <div data-composition-id="card" data-composition-src="compositions/card.html"
      data-props='{"typo":"oops"}'
      data-start="0" data-duration="5" data-track-index="0" class="clip"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      expect(result.findings.find((f) => f.code === "unused_data_props_key")).toBeUndefined();
    });
  });

  describe("requestanimationframe_in_composition", () => {
    it("flags requestAnimationFrame usage in script content", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080"></div>
  <script>
    window.__timelines = window.__timelines || {};
    requestAnimationFrame(() => { console.log("tick"); });
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find(
        (f) => f.code === "requestanimationframe_in_composition",
      );
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
    });

    it("does not flag requestAnimationFrame in comments", () => {
      const html = `
<html><body>
  <div data-composition-id="c1" data-width="1920" data-height="1080"></div>
  <script>
    window.__timelines = window.__timelines || {};
    // requestAnimationFrame(() => { });
    window.__timelines["c1"] = gsap.timeline({ paused: true });
  </script>
</body></html>`;
      const result = lintHyperframeHtml(html);
      const finding = result.findings.find(
        (f) => f.code === "requestanimationframe_in_composition",
      );
      expect(finding).toBeUndefined();
    });
  });
});
