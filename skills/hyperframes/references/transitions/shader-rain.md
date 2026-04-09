# Rain on Glass Shader Transition

Rain drops fall on a glass window that fogs up, then clears to reveal the incoming scene. Fog starts first, rain follows ~1.5s later, scene blends behind the fog, then both clear. Drops and trails cut through the fog showing sharp refracted scene underneath.

**Requires WebGL 2** for `textureLod` (NPOT mipmap blur). Uses IQ-style dot-product hashes.

## Setup differences from standard shader transitions

This shader is too large for string concatenation. Use a `<script type="x-shader/x-fragment">` tag instead:

```html
<script id="rain-frag" type="x-shader/x-fragment">
  #version 300 es
    precision mediump float;
    in vec2 v_uv;
    uniform sampler2D u_from, u_to;
    uniform float u_progress;
    uniform vec2 u_resolution;
    out vec4 fragColor;
    // ... shader body below ...
</script>
```

```js
// WebGL 2 context (supports NPOT mipmaps)
var gl = glCanvas.getContext("webgl2", { preserveDrawingBuffer: true });

// Vertex shader: #version 300 es, in/out instead of attribute/varying
var vertSrc =
  "#version 300 es\n" +
  "in vec2 a_pos; out vec2 v_uv; void main(){" +
  "v_uv=a_pos*0.5+0.5; v_uv.y=1.0-v_uv.y; gl_Position=vec4(a_pos,0,1);}";

// Generate mipmaps on scene textures
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);

// Compile from script tag
var progRain = mkProg(document.getElementById("rain-frag").textContent);
```

## Fragment shader

```glsl
// --- Scene sampling: mipmap blur capped at 2.5, extra taps for deeper fog ---
float sceneBlend;
vec3 texMix(vec2 uv, float mip) {
  return mix(textureLod(u_from, uv, mip).rgb, textureLod(u_to, uv, mip).rgb, sceneBlend);
}
vec3 sceneLod(vec2 uv, float lod) {
  vec2 suv = clamp(uv, 0., 1.);
  float mip = min(lod, 2.5);
  vec3 col = texMix(suv, mip);
  float spread = max(0., lod - 2.) * 6.;
  if (spread > .5) {
    vec2 ps = vec2(spread) / u_resolution;
    col += texMix(clamp(suv + vec2(ps.x, 0.), 0., 1.), mip);
    col += texMix(clamp(suv - vec2(ps.x, 0.), 0., 1.), mip);
    col += texMix(clamp(suv + vec2(0., ps.y), 0., 1.), mip);
    col += texMix(clamp(suv - vec2(0., ps.y), 0., 1.), mip);
    col /= 5.;
  }
  return col;
}

// --- Hashing (IQ-style dot-product) ---
vec2 h2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
vec3 h3(vec2 p) {
  vec3 q = vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)));
  return fract(sin(q) * 43758.5453);
}
float h1(float n) { return fract(n * 17.0 * fract(n * .3183099)); }

// --- Falling drop with trail ---
vec2 rainLayer(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * .65;
  // Grid: 5:1.3 aspect, row-offset stagger
  vec2 aspect = vec2(5., 1.3);
  vec2 grid = aspect * 2.;
  vec2 id = floor(uv * grid);
  float rowOff = h1(id.y * 31.7);
  uv.x += rowOff;
  id = floor(uv * grid);
  vec3 rnd = h3(id);
  vec2 cell = fract(uv * grid) - vec2(.5, 0.);
  // Drop x with cosine sway
  float dx = (rnd.x - .5) * .65;
  float sway = cos(UV.y * 12. + cos(UV.y * 5.3 + 1.7));
  dx += sway * (.45 - abs(dx)) * (rnd.z - .5) * .6;
  // Drop timing: smoothstep cubic
  float phase = fract(t + rnd.z);
  float dy = phase * phase * (3.0 - 2.0 * phase);
  dy = dy * .88 + .06;
  // Drop shape
  float dist = length((cell - vec2(dx, dy)) * aspect.yx);
  float drop = smoothstep(.38, 0., dist);
  // Trail: exponential taper
  float ahead = smoothstep(-.015, .015, cell.y - dy);
  float fade = exp(-3.0 * max(0., cell.y - dy));
  float trailW = smoothstep(.22 * fade, .13 * fade, abs(cell.x - dx));
  trailW *= ahead * fade;
  // Micro-droplets along trail
  float microY = fract(UV.y * 9.) + (cell.y - .5);
  float microD = length(cell - vec2(dx, microY));
  float micro = smoothstep(.28, 0., microD);
  float coverage = drop + micro * fade * ahead;
  return vec2(coverage, trailW);
}

// --- Static condensation droplets ---
float condensation(vec2 uv, float t) {
  uv *= 35.;
  vec2 id = floor(uv);
  uv = fract(uv) - .5;
  vec2 rnd = h2(id);
  vec2 pos = (rnd - .5) * .65;
  float d = length(uv - pos);
  float pulse = sin(3.14159 * fract(t + rnd.x * rnd.y));
  pulse *= pulse;
  return smoothstep(.28, 0., d) * fract(rnd.x * 7.) * pulse;
}

// --- Composite all drop layers ---
vec2 rain(vec2 uv, float t, float l0, float l1, float l2) {
  float s = condensation(uv, t) * l0;
  vec2 d1 = rainLayer(uv, t) * l1;
  vec2 d2 = rainLayer(uv * 1.7, t) * l2;
  float total = s + d1.x + d2.x;
  total = smoothstep(.25, 1., total);
  return vec2(total, max(d1.y * l0, d2.y * l1));
}

void main() {
  // Aspect-corrected UVs (flip Y so drops fall downward)
  vec2 uv = (v_uv - .5) * vec2(u_resolution.x / u_resolution.y, -1.);
  float T = u_progress * 12.;
  float t = T * .2;

  // Fog starts first, rain follows ~1.5s later
  float fogAmount = smoothstep(0., .25, u_progress) * smoothstep(1., .6, u_progress);
  float rainAmount = smoothstep(.1875, .4, u_progress) * smoothstep(1., .7, u_progress);

  // Scene A→B blend spread across the full transition
  sceneBlend = smoothstep(.1, .9, u_progress);

  // Layer intensities
  float sd = smoothstep(-.5, 1., rainAmount) * 2.;
  float l1 = smoothstep(.25, .75, rainAmount);
  float l2 = smoothstep(.0, .5, rainAmount);

  // Drops + trails, normals via screen-space derivatives
  vec2 c = rain(uv, t, sd, l1, l2);
  vec2 n = vec2(dFdx(c.x), dFdy(c.x));

  // Single lookup: refraction + variable blur combined
  // Drops = sharp (low LOD), fog = blurry (high LOD), trails reduce fog
  float maxBlur = fogAmount * 4.;
  float minBlur = fogAmount * .5;
  float focus = mix(maxBlur - c.y * 2., minBlur, smoothstep(.1, .2, c.x));
  focus = max(focus, 0.);

  vec3 col = sceneLod(v_uv + n, focus);

  vec2 vig = v_uv - .5;
  col *= 1. - dot(vig, vig) * .3;

  fragColor = vec4(col, 1.);
}
```

## Scene blend timing

The A→B scene swap is controlled by `sceneBlend`, which is independent from `u_progress`. This lets you hide the swap behind the fog:

- **`smoothstep(.1, .9, u_progress)`** — gradual blend spread across the whole transition. Both scenes visible through drops for most of the duration.
- **`smoothstep(.3, .6, u_progress)`** — steep swap concentrated at peak fog. The viewer barely notices the scene change because it happens when the glass is most opaque.
- **`smoothstep(.05, .5, u_progress)`** — front-loaded swap. Scene B appears early while fog is still building.

The `texMix` function uses `sceneBlend` (not `u_progress`) so every texture lookup — blurred fog and sharp drop refractions — samples the correctly blended scene.

## Tuning

| Parameter                               | Controls                        | Default | Range                             |
| --------------------------------------- | ------------------------------- | ------- | --------------------------------- |
| `fogAmount * 4.` (maxBlur)              | Peak fog blur intensity         | 4.0     | 2.5-5.0 (>4 may pixelate)         |
| `fogAmount * .5` (minBlur)              | Clarity through drops           | 0.5     | 0-1.0                             |
| `smoothstep(0., .25, ...)` fog start    | When fog begins                 | 0.0     | 0-0.3                             |
| `smoothstep(.1875, .4, ...)` rain start | When rain begins                | 0.1875  | 0-0.3                             |
| `u_progress * 12.` (T)                  | Rain animation speed            | 12.0    | 8-20                              |
| `smoothstep(.1, .9, ...)` sceneBlend    | How the A→B swap is distributed | 0.1-0.9 | Narrower = faster swap behind fog |
