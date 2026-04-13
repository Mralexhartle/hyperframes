# Shader Transition Setup

Complete boilerplate for WebGL shader transitions in HyperFrames. Copy the setup code, then plug in the fragment shader from the catalog.

**Rendering model:** DOM scenes play normally with GSAP animations. The WebGL canvas is hidden (`display:none`) between transitions. When a transition starts, `beginTrans` uses html2canvas to capture the outgoing scene with full content, and the incoming scene with `.scene-content` hidden (background + decorative elements only). This prevents un-animated content from flashing during the transition. When the transition ends, `endTrans` hides the canvas and reveals the incoming DOM scene — GSAP entrance animations then play on live elements.

**Shader-compatible CSS:** Compositions using shader transitions must follow the rules in transitions.md § "Shader-Compatible CSS Rules" — no `transparent` in gradients, no gradient backgrounds on sub-4px elements, no `var()` on captured elements, `data-no-capture` on uncapturable decoratives.

## HTML

```html
<canvas
  id="gl-canvas"
  width="1920"
  height="1080"
  style="position:absolute;top:0;left:0;width:1920px;height:1080px;z-index:100;pointer-events:none;display:none;"
>
</canvas>
```

## WebGL Init

```js
var sceneTextures = {};
var glCanvas = document.getElementById("gl-canvas");
var gl = glCanvas.getContext("webgl", { preserveDrawingBuffer: true });
gl.viewport(0, 0, 1920, 1080);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
```

## Shader Compilation + Shared Constants

```js
var vertSrc =
  "attribute vec2 a_pos; varying vec2 v_uv; void main(){" +
  "v_uv=a_pos*0.5+0.5; v_uv.y=1.0-v_uv.y; gl_Position=vec4(a_pos,0,1);}";

var quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

function compileShader(src, type) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error("Shader:", gl.getShaderInfoLog(s));
  return s;
}

function mkProg(fragSrc) {
  var p = gl.createProgram();
  gl.attachShader(p, compileShader(vertSrc, gl.VERTEX_SHADER));
  gl.attachShader(p, compileShader(fragSrc, gl.FRAGMENT_SHADER));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error("Link:", gl.getProgramInfoLog(p));
  return p;
}

// Shared uniform header — every fragment shader starts with this
var H =
  "precision mediump float;" +
  "varying vec2 v_uv;" +
  "uniform sampler2D u_from, u_to;" +
  "uniform float u_progress;" +
  "uniform vec2 u_resolution;\n";
```

## Noise Libraries

Include only what each shader needs. Do NOT include multiple libraries that redefine `hash()` in the same shader.

```js
// Quintic C2 noise + inter-octave rotation FBM
var NQ =
  "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}" +
  "float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);" +
  "f=f*f*f*(f*(f*6.-15.)+10.);" + // quintic interpolation — C2 continuous
  "return mix(mix(hash(i),hash(i+vec2(1,0)),f.x)," +
  "mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}" +
  "float fbm(vec2 p){float v=0.,a=.5;" +
  "mat2 R=mat2(.8,.6,-.6,.8);" + // inter-octave rotation (~37deg)
  "for(int i=0;i<5;i++){v+=a*vnoise(p);p=R*p*2.02;a*=.5;}return v;}";

// Noise with analytical derivatives (quintic) + erosion FBM
// Use for transitions that need gradient-based edge lighting
var ND =
  "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}" +
  "vec3 noised(vec2 p){vec2 i=floor(p),f=fract(p);" +
  "vec2 u=f*f*f*(f*(f*6.-15.)+10.),du=30.*f*f*(f*(f-2.)+1.);" +
  "float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));" +
  "return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y," +
  "du*vec2(b-a+(a-b-c+d)*u.y,c-a+(a-b-c+d)*u.x));}" +
  "float erosionFBM(vec2 p){float v=0.,a=.5;vec2 d=vec2(0);mat2 R=mat2(.8,.6,-.6,.8);" +
  "for(int i=0;i<6;i++){vec3 n=noised(p);d+=n.yz;v+=a*n.x/(1.+dot(d,d));p=R*p*2.02;a*=.5;}return v;}";

// Cosine palette: a + b*cos(2pi(c*t + d))
var CP = "vec3 palette(float t,vec3 a,vec3 b,vec3 c,vec3 d){" + "return a+b*cos(6.2832*(c*t+d));}";
```

## Render + State Machine

DOM scenes play normally with GSAP animations during holds. The canvas is only visible during shader transitions — hidden the rest of the time. Capture uses html2canvas (loaded from CDN alongside GSAP).

Add this script tag alongside GSAP:

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```

```js
// Patch createPattern for html2canvas bug with 0-dimension elements
var _origCP = CanvasRenderingContext2D.prototype.createPattern;
CanvasRenderingContext2D.prototype.createPattern = function (img, rep) {
  if (img && (img.width === 0 || img.height === 0)) return null;
  return _origCP.call(this, img, rep);
};

function uploadTexture(sceneId, canvas) {
  if (!sceneTextures[sceneId]) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    sceneTextures[sceneId] = tex;
  }
  gl.bindTexture(gl.TEXTURE_2D, sceneTextures[sceneId]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
}

// BG_COLOR must match your composition's background color (e.g. "#0a0a1a").
// html2canvas backgroundColor: null means transparent, which renders as black
// in WebGL textures. Always pass the explicit color.
var BG_COLOR = "#000"; // ← set to your composition's background

function captureScene(sceneEl) {
  return html2canvas(sceneEl, {
    width: 1920,
    height: 1080,
    scale: 1,
    backgroundColor: BG_COLOR,
    logging: false,
    ignoreElements: function (el) {
      return el.tagName === "CANVAS" || el.hasAttribute("data-no-capture");
    },
  });
}

function renderShader(prog, texFrom, texTo, progress) {
  gl.useProgram(prog);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texFrom);
  gl.uniform1i(gl.getUniformLocation(prog, "u_from"), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texTo);
  gl.uniform1i(gl.getUniformLocation(prog, "u_to"), 1);
  gl.uniform1f(gl.getUniformLocation(prog, "u_progress"), progress);
  gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), 1920, 1080);
  var pos = gl.getAttribLocation(prog, "a_pos");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

var trans = {
  active: false,
  prog: null,
  fromId: null,
  toId: null,
  progress: 0,
};

function beginTrans(prog, fromId, toId) {
  if (!gl) return;
  var fromScene = document.getElementById(fromId);
  var toScene = document.getElementById(toId);

  // Capture outgoing scene (DOM stays visible during async capture)
  captureScene(fromScene)
    .then(function (fromCanvas) {
      uploadTexture(fromId, fromCanvas);

      // Show incoming scene BEHIND outgoing (z-index -1) for capture
      toScene.style.zIndex = "-1";
      toScene.style.opacity = "1";
      var contentEl = toScene.querySelector(".scene-content");
      if (contentEl) contentEl.style.visibility = "hidden";

      // Wait 2 rAFs for browser to render with correct fonts
      return new Promise(function (resolve) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            captureScene(toScene).then(function (toCanvas) {
              if (contentEl) contentEl.style.visibility = "";
              toScene.style.opacity = "0";
              toScene.style.zIndex = "";
              uploadTexture(toId, toCanvas);
              resolve();
            });
          });
        });
      });
    })
    .then(function () {
      // Both textures ready — swap DOM for canvas
      document.querySelectorAll(".scene").forEach(function (s) {
        s.style.opacity = "0";
      });
      glCanvas.style.display = "block";
      trans.prog = prog;
      trans.fromId = fromId;
      trans.toId = toId;
      trans.progress = 0;
      trans.active = true;
    });
}

function updateTrans() {
  if (!trans.active || !gl) return;
  renderShader(trans.prog, sceneTextures[trans.fromId], sceneTextures[trans.toId], trans.progress);
}

function endTrans(showId) {
  trans.active = false;
  glCanvas.style.display = "none";
  document.getElementById(showId).style.opacity = "1";
}
```

## GSAP Timeline Integration

Scene 1 starts visible on the DOM. GSAP animates elements normally. The canvas is hidden until a transition begins. After each transition, the canvas hides and the next scene's DOM takes over.

```js
// Canvas starts hidden — DOM scene 1 is visible
glCanvas.style.display = "none";

var tl = gsap.timeline({
  paused: true,
  onUpdate: function () {
    updateTrans();
  },
});

// Scene 1 entrance animations go here (normal GSAP on DOM)...

// Transition 1→2:
tl.call(
  function () {
    beginTrans(myShaderProg, "scene1", "scene2");
  },
  null,
  T,
);
var tw1 = { p: 0 };
tl.to(
  tw1,
  {
    p: 1,
    duration: DUR,
    ease: "power2.inOut",
    onUpdate: function () {
      trans.progress = tw1.p;
    },
  },
  T,
);
tl.call(
  function () {
    endTrans("scene2");
  },
  null,
  T + DUR,
);

// Scene 2 entrance animations go here (normal GSAP on DOM)...

window.__timelines["main"] = tl;
```
