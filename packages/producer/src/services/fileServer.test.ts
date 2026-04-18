import { describe, expect, it } from "bun:test";
import { HF_BRIDGE_SCRIPT, injectScriptsAtHeadStart, VIRTUAL_TIME_SHIM } from "./fileServer.js";

describe("injectScriptsIntoHtml", () => {
  it("injects the virtual time shim into head content before authored scripts", () => {
    const html = `<!DOCTYPE html>
<html>
<head><script>window.__order = ["authored-head"];</script></head>
<body><script>window.__order.push("authored-body");</script></body>
</html>`;

    const injected = injectScriptsAtHeadStart(html, [VIRTUAL_TIME_SHIM]);
    const injectedShimTag = `<script>${VIRTUAL_TIME_SHIM}</script>`;
    const authoredHeadTag = `<script>window.__order = ["authored-head"];</script>`;

    expect(injected.indexOf(injectedShimTag)).toBeGreaterThanOrEqual(0);
    expect(injected.indexOf(injectedShimTag)).toBeLessThan(injected.indexOf(authoredHeadTag));
  });

  it("supports iframe html by injecting pre-head scripts without body scripts", () => {
    const html =
      "<!DOCTYPE html><html><head></head><body><script>window.targetLoaded = true;</script></body></html>";

    const preInjected = injectScriptsAtHeadStart(html, [VIRTUAL_TIME_SHIM]);
    const final = preInjected;

    expect(final).toContain(VIRTUAL_TIME_SHIM);
    expect(final).not.toContain("bodyOnly = true");
  });

  it("propagates virtual time seeks into same-origin iframe documents", () => {
    expect(HF_BRIDGE_SCRIPT).toContain("function seekSameOriginChildFrames");
    expect(HF_BRIDGE_SCRIPT).toContain("childWindow.__HF_VIRTUAL_TIME__.seekToTime(nextTimeMs)");
    expect(HF_BRIDGE_SCRIPT).toContain("seekSameOriginChildFrames(window, nextTimeMs)");
  });
});
