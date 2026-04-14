# Skill Architecture Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the website-to-hyperframes skill from a monolithic 450-line document into a phase-based architecture with pre-wired shader transitions, eliminating the AI auto-generation path and fixing all data quality issues identified in the code review.

**Architecture:** Remove `designMdGenerator.ts` and AI SDK dependencies. Restructure the skill into a slim orchestrator (SKILL.md) that delegates to 4 phase-specific reference files. Improve the capture pipeline to output HEX colors, asset descriptions, and a shader-ready index.html scaffold. Update the hyperframes compose skill's Visual Identity Gate to produce full DESIGN.md for non-URL prompts.

**Tech Stack:** TypeScript (capture pipeline), Markdown (skills), WebGL/GLSL (shader scaffold), GSAP (timeline scaffold)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| DELETE | `packages/cli/src/capture/designMdGenerator.ts` | AI-powered DESIGN.md generation |
| EDIT | `packages/cli/package.json` | Remove AI SDK deps |
| EDIT | `packages/cli/src/capture/tokenExtractor.ts` | RGB→HEX color conversion |
| EDIT | `packages/cli/src/capture/index.ts` | Remove AI path, add asset descriptions, new scaffold |
| EDIT | `packages/cli/src/capture/agentPromptGenerator.ts` | Remove hasDesignMd, show HEX, add asset-descriptions |
| REWRITE | `skills/website-to-hyperframes/SKILL.md` | Slim phase-based orchestrator |
| CREATE | `skills/website-to-hyperframes/references/phase-1-understand.md` | Data reading + working summary |
| CREATE | `skills/website-to-hyperframes/references/phase-2-design.md` | DESIGN.md writing (full 10-section schema) |
| CREATE | `skills/website-to-hyperframes/references/phase-3-direct.md` | Creative direction + narration + TTS |
| CREATE | `skills/website-to-hyperframes/references/phase-4-build.md` | Composition building + inline shader |
| DELETE | `skills/website-to-hyperframes/references/visual-styles.md` | Duplicate of hyperframes/ canonical |
| EDIT | `skills/hyperframes/SKILL.md` | Visual Identity Gate options 3-4 |
| EDIT | `CLAUDE.md` | Update skill references |

---

### Task 1: Remove AI Auto-Generation — Dependencies and Generator

**Files:**
- Delete: `packages/cli/src/capture/designMdGenerator.ts`
- Modify: `packages/cli/package.json:28-29`

- [ ] **Step 1: Delete designMdGenerator.ts**

```bash
rm packages/cli/src/capture/designMdGenerator.ts
```

- [ ] **Step 2: Remove AI SDK dependencies from package.json**

In `packages/cli/package.json`, remove these two lines:

```
    "@anthropic-ai/sdk": "^0.82.0",
    "@google/genai": "^1.48.0",
```

- [ ] **Step 3: Run pnpm install to update lockfile**

Run: `pnpm install`
Expected: lockfile updates, no errors

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/capture/designMdGenerator.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "refactor(capture): remove AI auto-generation and SDK dependencies"
```

---

### Task 2: Convert Colors to HEX in Token Extractor

**Files:**
- Modify: `packages/cli/src/capture/tokenExtractor.ts:52-82`

- [ ] **Step 1: Add rgbToHex helper inside EXTRACT_SCRIPT**

Insert after the `addColor` function (after line 57), before the color sampling loop:

```js
  function rgbToHex(color) {
    if (!color) return null;
    if (color.startsWith('#')) return color.length === 4
      ? '#' + color[1]+color[1] + color[2]+color[2] + color[3]+color[3]
      : color;
    var m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) {
      // Handle color() function format: color(srgb 0.84 0.84 0.83)
      var cm = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (!cm) return color;
      m = [null, Math.round(parseFloat(cm[1])*255), Math.round(parseFloat(cm[2])*255), Math.round(parseFloat(cm[3])*255)];
    }
    return '#' + ((1<<24) + (parseInt(m[1])<<16) + (parseInt(m[2])<<8) + parseInt(m[3])).toString(16).slice(1).toUpperCase();
  }
```

- [ ] **Step 2: Wrap addColor to convert before storing**

Replace the existing `addColor` function body:

```js
  function addColor(c) {
    if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent" || c === "inherit" || c === "initial") return;
    var hex = rgbToHex(c);
    if (hex) colorSet[hex] = (colorSet[hex] || 0) + 1;
  }
```

- [ ] **Step 3: Also convert section backgroundColor to HEX**

In the sections extraction (around line 144), change:

```js
    if (!sectionBg || sectionBg === "rgba(0, 0, 0, 0)" || sectionBg === "transparent") sectionBg = "#FFFFFF";
    else sectionBg = rgbToHex(sectionBg) || sectionBg;
```

- [ ] **Step 4: Also convert heading colors to HEX**

In the headings extraction (around line 88), change the return to:

```js
    return { level: parseInt(h.tagName[1]), text: (h.textContent || "").trim().slice(0, 200), fontSize: s.fontSize, fontWeight: s.fontWeight, color: rgbToHex(s.color) || s.color };
```

- [ ] **Step 5: Run a quick capture test to verify HEX output**

Run: `npx tsx packages/cli/src/cli.ts capture https://example.com -o /tmp/test-hex-capture --skip-split`
Expected: `tokens.json` contains `#` prefixed colors, not `rgb()` strings

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/capture/tokenExtractor.ts
git commit -m "fix(capture): convert extracted colors to HEX format"
```

---

### Task 3: Remove AI Path from index.ts, Add Asset Descriptions

**Files:**
- Modify: `packages/cli/src/capture/index.ts:787-853,908-935`

- [ ] **Step 1: Remove font paths collection block (lines 787-797)**

Delete this entire block — it was only used by designMdGenerator:

```typescript
    // Collect font file paths (used by DESIGN.md generator)
    const fontsDir = join(outputDir, "assets", "fonts");
    let fontPaths: string[] = [];
    try {
      const { readdirSync } = await import("node:fs");
      fontPaths = readdirSync(fontsDir)
        .filter((f: string) => /\.(woff2?|ttf|otf)$/i.test(f))
        .map((f: string) => `assets/fonts/${f}`);
    } catch {
      /* no fonts dir */
    }
```

- [ ] **Step 2: Replace AI key block (lines 822-853) with asset descriptions generation**

Delete the entire `hasAiKey` block. Replace with:

```typescript
    // Generate asset descriptions for the AI agent (no API keys needed)
    progress("design", "Generating asset descriptions...");
    try {
      const { readdirSync, statSync } = await import("node:fs");
      const lines: string[] = [];

      // Describe downloaded images
      const assetsPath = join(outputDir, "assets");
      try {
        for (const file of readdirSync(assetsPath)) {
          if (file === "svgs" || file === "fonts" || file === "lottie" || file === "videos") continue;
          const filePath = join(assetsPath, file);
          const stat = statSync(filePath);
          if (!stat.isFile()) continue;
          const sizeKb = Math.round(stat.size / 1024);
          // Find context from cataloged assets
          const catalogMatch = catalogedAssets.find(
            (a) => a.url && file.includes(a.url.split("/").pop()?.split("?")[0]?.slice(0, 20) || "___"),
          );
          const context = catalogMatch?.htmlContext?.slice(0, 80) || "";
          lines.push(`${file} — ${sizeKb}KB${context ? ", " + context : ""}`);
        }
      } catch { /* no assets dir */ }

      // Describe SVGs
      try {
        const svgsPath = join(assetsPath, "svgs");
        for (const file of readdirSync(svgsPath)) {
          if (!file.endsWith(".svg")) continue;
          const svgMatch = tokens.svgs.find(
            (s) => s.label && file.includes(s.label.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 15)),
          );
          const label = svgMatch?.label || file.replace(".svg", "").replace(/-/g, " ");
          const isLogo = svgMatch?.isLogo || file.includes("logo");
          lines.push(`svgs/${file} — ${isLogo ? "logo: " : "icon: "}${label}`);
        }
      } catch { /* no svgs dir */ }

      // Describe fonts
      try {
        const fontsPath = join(assetsPath, "fonts");
        for (const file of readdirSync(fontsPath)) {
          lines.push(`fonts/${file} — font file`);
        }
      } catch { /* no fonts dir */ }

      if (lines.length > 0) {
        writeFileSync(
          join(outputDir, "extracted", "asset-descriptions.md"),
          "# Asset Descriptions\n\nOne line per file. Read this instead of opening every image individually.\n\n" +
            lines.map((l) => "- " + l).join("\n") + "\n",
          "utf-8",
        );
        progress("design", `${lines.length} asset descriptions written`);
      }
    } catch {
      /* non-critical */
    }

    progress("design", "DESIGN.md will be created by your AI agent");
```

- [ ] **Step 3: Remove the `hasAiKey` variable reference on line 955**

Change the `generateAgentPrompt` call. The 6th argument `!!hasAiKey` should become `false`:

```typescript
      generateAgentPrompt(
        outputDir,
        url,
        tokens,
        animationCatalog,
        !!fullPageScreenshot,
        false, // DESIGN.md is always created by the AI agent now
        discoveredLotties.length > 0,
        existsSync(join(outputDir, "extracted", "shaders.json")),
        catalogedAssets,
      );
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/capture/index.ts
git commit -m "refactor(capture): remove AI key path, add asset descriptions generator"
```

---

### Task 4: Update agentPromptGenerator.ts

**Files:**
- Modify: `packages/cli/src/capture/agentPromptGenerator.ts`

- [ ] **Step 1: Remove hasDesignMd parameter**

Remove `hasDesignMd` from both function signatures. In `generateAgentPrompt` (line 15), remove the 6th parameter. In `buildPrompt` (line 41), remove the 6th parameter.

- [ ] **Step 2: Remove the conditional DESIGN.md row from the table**

Remove this line from the template (around line 91):
```
${hasDesignMd ? "| `DESIGN.md` | AI-generated design system reference |" : ""}
```

Replace with a static row:
```
| `extracted/asset-descriptions.md` | One-line description of every downloaded asset — read this first |
```

- [ ] **Step 3: Add a note about DESIGN.md creation**

After the table, add:

```
> **DESIGN.md does not exist yet.** It will be created when you run the `/website-to-hyperframes` workflow. Do not write compositions without it.
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/capture/agentPromptGenerator.ts
git commit -m "refactor(capture): update agent prompt, remove hasDesignMd, add asset descriptions"
```

---

### Task 5: Rewrite index.html Scaffold with Shader Boilerplate

**Files:**
- Modify: `packages/cli/src/capture/index.ts:908-935`

- [ ] **Step 1: Replace the empty scaffold with a shader-ready template**

Replace the `index.html` write block (lines 908-935) with:

```typescript
    if (!existsSync(indexPath)) {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      writeFileSync(
        indexPath,
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <!-- ═══ SCENE SLOTS ═══ -->
    <!-- AGENT: Add/remove scene slots as needed. Each scene is a sub-composition file. -->
    <div id="scene-1" data-composition-src="compositions/scene-1.html" data-start="0" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>
    <div id="scene-2" data-composition-src="compositions/scene-2.html" data-start="7" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>
    <div id="scene-3" data-composition-src="compositions/scene-3.html" data-start="14" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>
    <div id="scene-4" data-composition-src="compositions/scene-4.html" data-start="21" data-duration="7" data-track-index="1" data-width="1920" data-height="1080"></div>

    <!-- ═══ NARRATION ═══ -->
    <!-- AGENT: Update src after generating TTS -->
    <audio id="narration" data-start="0" data-duration="28" data-track-index="0" data-volume="1" src="narration.wav"></audio>

    <!-- ═══ CAPTIONS ═══ -->
    <!-- AGENT: Create compositions/captions.html with word-level timestamps -->
    <div id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="28" data-track-index="2" data-width="1920" data-height="1080"></div>

    <!-- ═══ SHADER TRANSITION CANVAS ═══ -->
    <canvas id="gl-canvas" width="1920" height="1080"
      style="position:absolute;top:0;left:0;width:1920px;height:1080px;z-index:100;pointer-events:none;display:none;">
    </canvas>

    <script>
      /* ═══ ROOT TIMELINE ═══ */
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;

      /* ═══ SHADER TRANSITION SYSTEM ═══
       * Pre-wired with Cross-Warp Morph. To change the shader:
       * 1. Pick one from skills/hyperframes/references/transitions/shader-transitions.md
       * 2. Replace the FRAG_SHADER string below
       * 3. If the new shader needs ND instead of NQ noise, swap the noise library
       */

      var sceneTextures = {};
      var sceneHasVideo = {};
      var glCanvas = document.getElementById("gl-canvas");
      var gl = glCanvas ? glCanvas.getContext("webgl", { preserveDrawingBuffer: true }) : null;

      if (gl) {
        gl.viewport(0, 0, 1920, 1080);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        /* ── Scene Capture ── */
        function waitForMedia() {
          return new Promise(function(resolve) {
            var promises = [];
            document.querySelectorAll("img").forEach(function(img) {
              if (!img.complete) promises.push(new Promise(function(r) { img.onload = r; img.onerror = r; }));
            });
            document.querySelectorAll("video").forEach(function(vid) {
              if (vid.readyState < 2) promises.push(new Promise(function(r) { vid.addEventListener("loadeddata", r, { once: true }); }));
            });
            Promise.all(promises).then(resolve);
          });
        }

        function captureScene(sceneId) {
          return new Promise(function(resolve) {
            var scene = document.getElementById(sceneId);
            if (!scene) { resolve(); return; }
            var origOpacity = scene.style.opacity;
            scene.style.opacity = "1";
            if (scene.querySelector("video")) sceneHasVideo[sceneId] = scene.querySelector("video");
            requestAnimationFrame(function() {
              requestAnimationFrame(function() {
                var c = document.createElement("canvas");
                c.width = 1920; c.height = 1080;
                var ctx = c.getContext("2d");
                ctx.fillStyle = window.getComputedStyle(scene).backgroundColor || "#000";
                ctx.fillRect(0, 0, 1920, 1080);
                var sr = scene.getBoundingClientRect();
                var els = scene.querySelectorAll("*");
                for (var i = 0; i < els.length; i++) {
                  var el = els[i]; var cs = window.getComputedStyle(el);
                  if (cs.display === "none" || cs.visibility === "hidden") continue;
                  var r = el.getBoundingClientRect();
                  if (r.width < 1 || r.height < 1) continue;
                  var x = r.left - sr.left, y = r.top - sr.top, w = r.width, h = r.height;
                  ctx.save(); ctx.globalAlpha = parseFloat(cs.opacity) || 1;
                  if (el.tagName === "IMG" && el.complete && el.naturalWidth > 0) {
                    try { ctx.drawImage(el, x, y, w, h); } catch(e) {}
                    ctx.restore(); continue;
                  }
                  if (el.tagName === "VIDEO" && el.readyState >= 2) {
                    try { ctx.drawImage(el, x, y, w, h); } catch(e) {}
                    ctx.restore(); continue;
                  }
                  var bg = cs.backgroundColor;
                  if (bg && bg !== "rgba(0, 0, 0, 0)") { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }
                  ctx.restore();
                }
                var tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
                sceneTextures[sceneId] = tex;
                scene.style.opacity = origOpacity;
                resolve();
              });
            });
          });
        }

        /* ── Shader Compilation ── */
        function compileShader(src, type) {
          var s = gl.createShader(type);
          gl.shaderSource(s, src); gl.compileShader(s);
          return s;
        }

        // Noise library (NQ = Quintic FBM — needed by Cross-Warp Morph)
        var NQ =
          "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}" +
          "float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);" +
          "f=f*f*f*(f*(f*6.-15.)+10.);" +
          "return mix(mix(hash(i),hash(i+vec2(1,0)),f.x)," +
          "mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}" +
          "float fbm(vec2 p){float v=0.,a=.5;mat2 rot=mat2(.8,.6,-.6,.8);" +
          "for(int i=0;i<5;i++){v+=a*vnoise(p);p=rot*p*2.;a*=.5;}return v;}";

        var VERT = "attribute vec2 a_pos; varying vec2 v_uv; void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0,1);}";

        /* AGENT: Replace this shader to change the transition effect.
         * See skills/hyperframes/references/transitions/shader-transitions.md for 14 options.
         * Current: Cross-Warp Morph — organic, versatile, works for most video types. */
        var FRAG_SHADER =
          "precision mediump float;" +
          "varying vec2 v_uv;" +
          "uniform sampler2D u_from,u_to;" +
          "uniform float u_progress;" +
          NQ +
          "void main(){" +
          "vec2 disp=vec2(fbm(v_uv*3.),fbm(v_uv*3.+vec2(7.3,3.7)))-.5;" +
          "vec2 fromUv=clamp(v_uv+disp*u_progress*.5,0.,1.);" +
          "vec2 toUv=clamp(v_uv-disp*(1.-u_progress)*.5,0.,1.);" +
          "vec4 A=texture2D(u_from,fromUv),B=texture2D(u_to,toUv);" +
          "float n=fbm(v_uv*4.+vec2(3.1,1.7));" +
          "float blend=smoothstep(.4,.6,n+u_progress*1.2-.6);" +
          "gl_FragColor=mix(A,B,blend);}";

        // Passthrough shader (shows single scene without transition)
        var PASS_FRAG =
          "precision mediump float;varying vec2 v_uv;uniform sampler2D u_from;void main(){gl_FragColor=texture2D(u_from,v_uv);}";

        var vs = compileShader(VERT, gl.VERTEX_SHADER);
        var transFs = compileShader(FRAG_SHADER, gl.FRAGMENT_SHADER);
        var passFs = compileShader(PASS_FRAG, gl.FRAGMENT_SHADER);

        function linkProg(fs) {
          var p = gl.createProgram();
          gl.attachShader(p, vs); gl.attachShader(p, fs);
          gl.linkProgram(p); return p;
        }

        var transProg = linkProg(transFs);
        var passProg = linkProg(passFs);

        var quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

        function drawPass(prog, fromTex, toTex, progress) {
          gl.useProgram(prog);
          var a = gl.getAttribLocation(prog, "a_pos");
          gl.enableVertexAttribArray(a);
          gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, fromTex);
          gl.uniform1i(gl.getUniformLocation(prog, "u_from"), 0);
          if (toTex) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, toTex);
            gl.uniform1i(gl.getUniformLocation(prog, "u_to"), 1);
          }
          var uProg = gl.getUniformLocation(prog, "u_progress");
          if (uProg) gl.uniform1f(uProg, progress);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        /* ── Transition State Machine ── */
        var trans = { active: false, from: null, to: null, progress: 0 };

        function beginTrans(fromId, toId) {
          trans.active = true; trans.from = fromId; trans.to = toId; trans.progress = 0;
          glCanvas.style.display = "block";
          // Re-capture if scene has video (live frame)
          if (sceneHasVideo[fromId]) captureScene(fromId);
          if (sceneHasVideo[toId]) captureScene(toId);
        }

        function endTrans(showId) {
          trans.active = false;
          glCanvas.style.display = "none";
          // Hide all scenes, show target
          document.querySelectorAll("[data-composition-src]").forEach(function(el) {
            el.style.opacity = el.id === showId ? "1" : "0";
          });
        }

        function renderFrame() {
          if (!trans.active && !trans.from) { requestAnimationFrame(renderFrame); return; }
          if (trans.active && sceneTextures[trans.from] && sceneTextures[trans.to]) {
            drawPass(transProg, sceneTextures[trans.from], sceneTextures[trans.to], trans.progress);
          } else if (trans.from && sceneTextures[trans.from]) {
            drawPass(passProg, sceneTextures[trans.from], null, 0);
          }
          requestAnimationFrame(renderFrame);
        }

        /* ── Init: capture scene textures after media loads ── */
        waitForMedia().then(function() {
          var sceneIds = ["scene-1", "scene-2", "scene-3", "scene-4"];
          /* AGENT: Update this list to match your actual scene IDs */
          return sceneIds.reduce(function(p, id) {
            return p.then(function() { return captureScene(id); });
          }, Promise.resolve());
        }).then(function() {
          // Show first scene, hide others
          document.querySelectorAll("[data-composition-src]").forEach(function(el, i) {
            el.style.opacity = i === 0 ? "1" : "0";
          });
          trans.from = "scene-1";
          renderFrame();
        });

        /* ═══ TRANSITION TIMELINE ═══
         * AGENT: Wire your transitions here. Example for 4 scenes with 0.6s transitions:
         *
         * tl.call(function() { beginTrans("scene-1", "scene-2"); }, null, 6.4);
         * tl.to(trans, { progress: 1, duration: 0.6, ease: "power2.inOut",
         *   onComplete: function() { endTrans("scene-2"); } }, 6.4);
         *
         * tl.call(function() { beginTrans("scene-2", "scene-3"); }, null, 13.4);
         * tl.to(trans, { progress: 1, duration: 0.6, ease: "power2.inOut",
         *   onComplete: function() { endTrans("scene-3"); } }, 13.4);
         *
         * tl.call(function() { beginTrans("scene-3", "scene-4"); }, null, 20.4);
         * tl.to(trans, { progress: 1, duration: 0.6, ease: "power2.inOut",
         *   onComplete: function() { endTrans("scene-4"); } }, 20.4);
         */

      } else {
        /* WebGL not available — CSS fallback (scenes fade in/out individually) */
        console.warn("WebGL unavailable — using CSS fade transitions");
      }
    </script>
  </body>
</html>
`,
        "utf-8",
      );
    }
```

- [ ] **Step 2: Verify the scaffold is valid HTML**

Run: `npx tsx packages/cli/src/cli.ts lint /tmp/test-scaffold` (after writing the scaffold to a temp project)
Expected: No structural errors (GSAP loads, timelines registered)

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/capture/index.ts
git commit -m "feat(capture): pre-wire shader transitions in index.html scaffold"
```

---

### Task 6: Delete Duplicate visual-styles.md

**Files:**
- Delete: `skills/website-to-hyperframes/references/visual-styles.md`

- [ ] **Step 1: Delete the duplicate**

```bash
rm skills/website-to-hyperframes/references/visual-styles.md
```

- [ ] **Step 2: Update any references in SKILL.md**

The current SKILL.md (line 167) references `[visual-styles.md](./references/visual-styles.md)`. This will be replaced when we rewrite SKILL.md in Task 7. No action needed here — just noting the dependency.

- [ ] **Step 3: Commit**

```bash
git add skills/website-to-hyperframes/references/visual-styles.md
git commit -m "chore: remove duplicate visual-styles.md (canonical is in hyperframes/)"
```

---

### Task 7: Rewrite website-to-hyperframes SKILL.md

**Files:**
- Rewrite: `skills/website-to-hyperframes/SKILL.md`

- [ ] **Step 1: Write the new slim orchestrator**

Replace the entire file with:

```markdown
---
name: website-to-hyperframes
description: |
  Capture a website and create a HyperFrames video from it. Use when: (1) a user provides a URL and wants a video, (2) someone says "capture this site", "turn this into a video", "make a promo from my site", (3) the user wants a social ad, product tour, or any video based on an existing website, (4) the user shares a link and asks for any kind of video content. Even if the user just pastes a URL — this is the skill to use.
---

# Website to HyperFrames

Capture a website's identity, then create an on-brand video from it.

Users say things like:
- "Capture stripe.com and make me a 20-second product demo video"
- "Turn this website into a 15-second social ad for Instagram"
- "Create a 30-second product tour from linear.app"

The workflow has 4 phases. Each phase produces an artifact that gates the next.

---

## Phase 1: Capture & Understand

**Read:** [references/phase-1-understand.md](references/phase-1-understand.md)

Run the capture, then read and summarize the extracted data using the write-down-and-forget method described in the reference.

**Gate:** Print your site summary before proceeding:
- Site name, top 3-5 colors (HEX), primary font family
- Number of assets, sections, and animations available
- One sentence: what is this site's visual vibe?

---

## Phase 2: Write DESIGN.md

**Read:** [references/phase-2-design.md](references/phase-2-design.md)

Write a complete DESIGN.md with all 10 sections. The Style Prompt section is the most important — an AI should be able to read only that paragraph and generate consistent on-brand visuals.

**Gate:** `DESIGN.md` exists in the project directory with all 10 sections populated.

---

## Phase 3: Creative Direction

**Read:** [references/phase-3-direct.md](references/phase-3-direct.md)

Think like a creative director. Choose a visual style, write the narration script, generate TTS audio, and plan every scene around the narration timestamps.

**Gate:** All three artifacts exist:
1. `narration-script.txt` — the voiceover script
2. `narration.wav` (or .mp3) — generated TTS audio
3. Scene plan printed (Scene | Duration | Visual | Emotion | Assets | Transition | Narration)

If the user explicitly says "no narration" or "no voiceover": skip script/TTS, plan scenes with visual-only timing.

---

## Phase 4: Build & Deliver

**Read:** The `/hyperframes-compose` skill (invoke it — every rule matters)
**Read:** [references/phase-4-build.md](references/phase-4-build.md)

Build the compositions. The `index.html` scaffold already has shader transitions pre-wired (Cross-Warp Morph by default). Modify the shader choice and wire the transition timeline to your scene plan.

**Gate:** Both commands pass with zero errors:
```bash
npx hyperframes lint
npx hyperframes validate
```

Then preview: `npx hyperframes preview`

---

## Quick Reference

### Video Types

| Type | Duration | Scenes | Narration |
|------|----------|--------|-----------|
| Social ad (IG/TikTok) | 10-15s | 3-4 | Optional hook sentence |
| Product demo | 30-60s | 5-8 | Full narration |
| Feature announcement | 15-30s | 3-5 | Full narration |
| Brand reel | 20-45s | 4-6 | Optional, music focus |
| Launch teaser | 10-20s | 2-4 | Minimal, high energy |

### Format

- **Landscape**: 1920x1080 (default)
- **Portrait**: 1080x1920 (Instagram Stories, TikTok)
- **Square**: 1080x1080 (Instagram feed)

### Reference Files

| File | When to read |
|------|-------------|
| [phase-1-understand.md](references/phase-1-understand.md) | Phase 1 — reading captured data |
| [phase-2-design.md](references/phase-2-design.md) | Phase 2 — writing DESIGN.md |
| [phase-3-direct.md](references/phase-3-direct.md) | Phase 3 — creative direction and narration |
| [phase-4-build.md](references/phase-4-build.md) | Phase 4 — building compositions |
| [asset-sourcing.md](references/asset-sourcing.md) | When you need logos, icons, or photos not in the capture |
| [video-recipes.md](references/video-recipes.md) | Scene patterns, 5-layer system, mid-scene activity |
| [tts-integration.md](references/tts-integration.md) | Voice selection, TTS generation options |
| [animation-recreation.md](references/animation-recreation.md) | Converting source animations to GSAP |
```

- [ ] **Step 2: Commit**

```bash
git add skills/website-to-hyperframes/SKILL.md
git commit -m "refactor(skill): rewrite website-to-hyperframes as phase-based orchestrator"
```

---

### Task 8: Write Phase 1 — Understand Reference

**Files:**
- Create: `skills/website-to-hyperframes/references/phase-1-understand.md`

- [ ] **Step 1: Write phase-1-understand.md**

```markdown
# Phase 1: Capture & Understand

## Step 1: Run the capture

\`\`\`bash
npx hyperframes capture <URL> -o captures/<project-name>
\`\`\`

If the built CLI isn't available, fall back to:
\`\`\`bash
npx tsx packages/cli/src/cli.ts capture <URL> -o captures/<project-name>
\`\`\`

Wait for it to complete. Print the summary: how many screenshots, assets, sections, and fonts were extracted.

## Step 2: Read and summarize

Read each file below. After reading each one, write a 1-2 sentence summary of what you learned. These summaries are your working memory — the raw file content may be cleared from context later.

### Must read (do not skip)

1. **`screenshots/full-page.png`** — View this image. Describe the site's visual mood, layout style, and dominant colors in 2-3 sentences.

2. **`extracted/tokens.json`** — Note the top 5-7 colors (they're in HEX), all font families, number of sections, and number of headings/CTAs.

3. **`extracted/visible-text.txt`** — Note the site's headline, tagline, key selling points, and any notable statistics or social proof.

4. **`extracted/asset-descriptions.md`** — Read this one-line-per-file summary of all downloaded assets. Note which assets are most visually striking or useful for video (hero images, logos, product screenshots).

### Read if they exist

5. **`extracted/animations.json`** — Note if the site uses scroll-triggered animations, marquees, canvas/WebGL, or named CSS animations. These inform what motions to recreate.

6. **`extracted/lottie-manifest.json`** — If present, view each preview image at `assets/lottie/previews/` to see what the animations look like. Note which ones could be embedded in the video.

7. **`extracted/video-manifest.json`** — If present, view each preview at `assets/videos/previews/` to see what each video shows. Note which could be used as B-roll or hero footage.

8. **`extracted/shaders.json`** — If present, note what WebGL effects the site uses (this tells you the site's creators invested in visual impact here).

### On-demand (read only when building scenes)

9. **Individual images in `assets/`** — Don't view every image now. Use `asset-descriptions.md` as your index. View specific images when you need them for a scene.

10. **`extracted/assets-catalog.json`** — Don't read the full JSON. Use it to find remote URLs when you need a specific asset that wasn't downloaded.

### For rich captures (30+ images)

If `asset-descriptions.md` lists more than 30 assets, launch a sub-agent to view all images and SVGs:

> "Read every image in assets/ and every SVG in assets/svgs/. For each, write one line: filename — what it shows, dominant colors, approximate size. Return the complete catalog."

Use the sub-agent's catalog as your asset reference for the rest of the workflow.

## Gate

Print your site summary before proceeding to Phase 2:

- **Site:** [name]
- **Colors:** [top 3-5 HEX values with roles]
- **Fonts:** [font families]
- **Sections:** [count] sections, [count] headings, [count] CTAs
- **Key assets:** [list 3-5 most useful assets for video]
- **Vibe:** [one sentence describing the visual identity]
```

- [ ] **Step 2: Commit**

```bash
git add skills/website-to-hyperframes/references/phase-1-understand.md
git commit -m "feat(skill): add Phase 1 understand reference"
```

---

### Task 9: Write Phase 2 — Design Reference

**Files:**
- Create: `skills/website-to-hyperframes/references/phase-2-design.md`

- [ ] **Step 1: Write phase-2-design.md**

This file contains the full DESIGN.md schema with all 10 sections, rules, and the Notion example. It should be approximately 150 lines.

Content structure:
1. **Introduction** — What DESIGN.md is, why it matters (3 lines)
2. **The 10 Required Sections** — Each with a description of what to write:
   - Overview (3-4 sentences, factual)
   - Style Prompt (single self-contained paragraph — MOST IMPORTANT — emphasized with bold and explanation that "an AI should be able to read ONLY this paragraph and generate consistent on-brand visuals")
   - Colors (HEX values from tokens.json, semantic roles)
   - Typography (every font family with weights, sizing hierarchy)
   - Elevation (depth strategy: borders vs shadows vs flat)
   - Components (name every UI component you see in the screenshot — be specific: "Bento Grid" not "Cards")
   - Motion (animation style, easing, speed, signature patterns from animations.json)
   - Do's and Don'ts (3-5 rules each, derived from what the site does and doesn't do)
   - What NOT to Do (explicit anti-patterns — "No gradients", "Never use rounded corners", etc.)
   - Assets (map every file in assets/ and URL in assets-catalog.json to WHERE it appears and WHAT it shows)
3. **Rules** — Use exact HEX values, be factual not poetic, name components specifically
4. **Complete Example** — The Notion DESIGN.md example from the current SKILL.md (lines 84-143) — include it in full
5. **Word guidance** — Aim for thorough coverage, approximately 2000-3000 words. The Style Prompt and What NOT to Do sections are the most important — don't skimp on them.

- [ ] **Step 2: Commit**

```bash
git add skills/website-to-hyperframes/references/phase-2-design.md
git commit -m "feat(skill): add Phase 2 design reference with full DESIGN.md schema"
```

---

### Task 10: Write Phase 3 — Creative Direction Reference

**Files:**
- Create: `skills/website-to-hyperframes/references/phase-3-direct.md`

- [ ] **Step 1: Write phase-3-direct.md**

Content structure (~120 lines):

1. **You are a Creative Director** — Set the role. Unlimited creative freedom. Design a video that stops the scroll, holds attention, drives action.
2. **Choose your visual style** — Read `visual-styles.md` (from the hyperframes/ skill, 8 named presets). Pick one as your style anchor. State it explicitly.
3. **Choose your shader transition** — Energy-to-shader mapping table (inline, 5 rows). State your choice: "I will use [shader] because [reason]." Default is Cross-Warp Morph (already in the scaffold).
4. **Motion vocabulary** — The verbs table (SLAMS, CASCADE, FLOATS etc.) — inline, not referenced.
5. **Write the narration script FIRST** — 2.5 words/sec pacing. Opening line is everything. Use contractions, write like a human. Save as `narration-script.txt`.
6. **Generate TTS** — HeyGen preferred, ElevenLabs alternative, Kokoro offline fallback. Audition 2-3 voices with the first sentence. Reference `tts-integration.md` for details.
7. **Transcribe for timestamps** — `npx hyperframes transcribe narration.wav` → `transcript.json` with word-level timing.
8. **Plan scenes around narration** — Each sentence/phrase maps to a scene. Narration IS the timeline. Print the scene plan table.
9. **Opening 2 seconds** — If you start with a logo fading in on a solid background, you've already lost. Start with: a number that shocks, a visual that moves immediately, a question that provokes, or an asset doing something unexpected.

No "Red Flags" tables. No negative priming. All directives are positive.

- [ ] **Step 2: Commit**

```bash
git add skills/website-to-hyperframes/references/phase-3-direct.md
git commit -m "feat(skill): add Phase 3 creative direction reference"
```

---

### Task 11: Write Phase 4 — Build Reference

**Files:**
- Create: `skills/website-to-hyperframes/references/phase-4-build.md`

- [ ] **Step 1: Write phase-4-build.md**

Content structure (~150 lines):

1. **You are a Senior HyperFrames Engineer** — Set the role. Execute the creative director's plan at 200% quality.
2. **The scaffold is pre-wired** — The `index.html` already has Cross-Warp Morph shader transitions. To use a different shader: replace the FRAG_SHADER string, swap noise lib if needed.
3. **How to wire transitions** — One complete inline example showing GSAP timeline calling `beginTrans`/`endTrans` between two scenes with `trans.progress` 0→1. Include exact code.
4. **Asset plan per scene** — Before writing ANY HTML, list every file from `assets/` and URL from `assets-catalog.json` you'll embed per scene. If a scene uses zero captured assets, explain why.
5. **Scene composition rules:**
   - Use EXACT colors from DESIGN.md (HEX values)
   - Use EXACT fonts via @font-face with URLs from assets catalog
   - Real SVG logos from `assets/svgs/`
   - Reference assets with `../assets/` paths (compositions are one level deep)
   - Remote URLs from `assets-catalog.json` work directly (`crossorigin="anonymous"`)
6. **Wire the audio** — `narration.wav` as `<audio>` on root track. Captions sub-composition on parallel track. Scene durations from narration timestamps.
7. **Every element must move** — Mid-scene activity table (from video-recipes.md, inline). Image: slow zoom. Stat: counter from 0. Logo grid: shimmer sweep. Any persistent element: subtle float.
8. **Repeated critical rules** (at the bottom):
   - No `repeat: -1` — always finite repeats
   - No `Math.random()` — use seeded PRNG
   - Register timelines to `window.__timelines`
   - Timeline construction must be synchronous
   - Minimum font size: 20px body, 16px labels
   - No full-screen dark linear gradients (H.264 banding)
9. **Verify and deliver** — Run `npx hyperframes lint` and `npx hyperframes validate`. Fix all errors. Then `npx hyperframes preview`.

- [ ] **Step 2: Commit**

```bash
git add skills/website-to-hyperframes/references/phase-4-build.md
git commit -m "feat(skill): add Phase 4 build reference with inline shader example"
```

---

### Task 12: Update Hyperframes Compose Skill — Visual Identity Gate

**Files:**
- Modify: `skills/hyperframes/SKILL.md:22-38`

- [ ] **Step 1: Rewrite options 3 and 4 of the Visual Identity Gate**

Replace lines 30-35 (the current options 3 and 4) with:

```markdown
3. **User named a style or gave a topic** (e.g., "Swiss Pulse", "dark and techy", "astronomical discoveries")? → Read [visual-styles.md](./visual-styles.md) for the 8 named presets. Pick the closest match or blend from multiple. Generate a **full** DESIGN.md with all 10 sections:
   - `## Overview` (3-4 sentences)
   - `## Style Prompt` (single self-contained paragraph — most important)
   - `## Colors` (3-5 hex values with roles, derived from the style preset)
   - `## Typography` (1-2 font families with weights)
   - `## Elevation` (depth strategy for this style)
   - `## Components` (what visual elements this style typically uses)
   - `## Motion` (easing, speed, animation character from the style)
   - `## Do's and Don'ts` (3-5 rules each)
   - `## What NOT to Do` (3-5 anti-patterns)
   - `## Assets` (list any sourced assets)
   Save as DESIGN.md in the project directory.
4. **None of the above?** → Ask 3 questions before writing any HTML:
   - What's the mood? (explosive / cinematic / fluid / technical / chaotic / warm)
   - Light or dark canvas?
   - Any specific brand colors, fonts, or visual references?
   Then generate a **full** DESIGN.md with all 10 sections listed above, using the answers to select and adapt a style from visual-styles.md.
```

- [ ] **Step 2: Commit**

```bash
git add skills/hyperframes/SKILL.md
git commit -m "feat(skill): upgrade Visual Identity Gate to produce full DESIGN.md"
```

---

### Task 13: Update Root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verify skill table references are still accurate**

The root CLAUDE.md has a skills table. Check that:
- `website-to-hyperframes` description still matches (it should — the skill name and purpose haven't changed)
- The "Rules" section still references the right workflow steps

The main change: the rules section mentions "6-step workflow" which is now a 4-phase workflow. Update any references to step numbers.

- [ ] **Step 2: Update the rules section**

In the rules that reference the website-to-hyperframes skill, update the description to say "4-phase workflow" instead of "6-step workflow" if applicable. Update any step references (e.g., "Step 5" → "Phase 4").

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md skill references for phase-based workflow"
```

---

## Execution Order

Tasks 1-5 modify the capture pipeline (TypeScript). They should run sequentially because they edit overlapping files (`index.ts`).

Tasks 6-11 modify skill markdown files. They can run in parallel with each other.

Task 12-13 are final updates. Run after all others.

**Recommended batching:**
- **Batch 1** (sequential): Tasks 1, 2, 3, 4, 5
- **Batch 2** (parallel): Tasks 6, 7, 8, 9, 10, 11
- **Batch 3** (sequential): Tasks 12, 13
