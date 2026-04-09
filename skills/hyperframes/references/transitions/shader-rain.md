# Rain on Glass Shader Transition

Rain drops fall on a glass window that fogs up, then clears to reveal the incoming scene. Fog starts first, rain follows ~1.5s later, scene blends behind the fog, then both clear. Drops and trails cut through the fog showing sharp refracted scene underneath.

**Requires WebGL 2** for `textureLod` (NPOT mipmap blur). No noise library needed — uses Dave Hoskins hash functions.

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

// --- Hash (Dave Hoskins) ---
vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}
float N(float t) { return fract(sin(t * 12345.564) * 7658.76); }
float Saw(float b, float t) { return smoothstep(0., b, t) * smoothstep(1., b, t); }

// --- Falling drop with trail ---
vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 a = vec2(6., 1.);
  vec2 grid = a * 2.;
  vec2 id = floor(uv * grid);
  float colShift = N(id.x);
  uv.y += colShift;
  id = floor(uv * grid);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(.5, 0);
  float x = n.x - .5;
  float y = UV.y * 20.;
  float wiggle = sin(y + sin(y));
  x += wiggle * (.5 - abs(x)) * (n.z - .5);
  x *= .7;
  float ti = fract(t + n.z);
  y = (Saw(.85, ti) - .5) * .9 + .5;
  vec2 p = vec2(x, y);
  float d = length((st - p) * a.yx);
  float mainDrop = smoothstep(.4, .0, d);
  float r = sqrt(smoothstep(1., y, st.y));
  float cd = abs(st.x - x);
  float trail = smoothstep(.23 * r, .15 * r * r, cd);
  float trailFront = smoothstep(-.02, .02, st.y - y);
  trail *= trailFront * r * r;
  y = UV.y;
  float trail2 = smoothstep(.2 * r, .0, cd);
  float droplets = max(0., (sin(y * (1. - y) * 120.) - st.y)) * trail2 * trailFront * n.z;
  y = fract(y * 10.) + (st.y - .5);
  float dd = length(st - vec2(x, y));
  droplets = smoothstep(.3, 0., dd);
  float m = mainDrop + droplets * r * trailFront;
  return vec2(m, trail);
}

// --- Static condensation droplets ---
float StaticDrops(vec2 uv, float t) {
  uv *= 40.;
  vec2 id = floor(uv);
  uv = fract(uv) - .5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - .5) * .7;
  float d = length(uv - p);
  float fade = Saw(.025, fract(t + n.z));
  return smoothstep(.3, 0., d) * fract(n.z * 10.) * fade;
}

// --- Composite all drop layers ---
vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer2(uv, t) * l1;
  vec2 m2 = DropLayer2(uv * 1.85, t) * l2;
  float c = s + m1.x + m2.x;
  c = smoothstep(.3, 1., c);
  return vec2(c, max(m1.y * l0, m2.y * l1));
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
  vec2 c = Drops(uv, t, sd, l1, l2);
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
