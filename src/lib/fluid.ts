/**
 * A real fluid, on the GPU.
 *
 * WHAT THIS REPLACES AND WHY
 *
 * The previous background moved two radial gradients toward a smoothed pointer.
 * It was described, correctly, as a cursor spotlight: the colour had no
 * momentum, a fast flick produced the same picture as a slow drag, and nothing
 * was left behind when the pointer stopped. No amount of tuning fixes that,
 * because a gradient whose centre is a variable has no state to carry.
 *
 * This is a Stable Fluids solver instead. It holds a velocity field and a dye
 * field in floating point textures, advects both along the velocity every
 * frame, and projects the velocity to be divergence free so the motion behaves
 * like an incompressible liquid rather than like fog. A pointer movement
 * injects momentum AND colour; the solver carries them, bends them, and lets
 * them settle. Trails, deformation and delayed flow are consequences of the
 * simulation rather than effects layered on top of it.
 *
 * THE STRUCTURE, which is the standard one
 *
 *   advect      carry a field along the velocity
 *   curl        rotational component, per texel
 *   vorticity   add that rotation back, so small eddies survive dissipation
 *   divergence  how much the velocity is compressing
 *   pressure    Jacobi iterations solving for a field whose gradient cancels it
 *   subtract    remove that gradient, leaving a divergence free velocity
 *   splat       inject momentum and dye at a point
 *
 * NO REACT, NO DOM BEYOND ITS OWN CANVAS. The simulation owns a canvas and a
 * WebGL context and nothing else, so a pointer move never reaches React and
 * never causes a render. Everything high frequency lives in this file.
 */

/* --------------------------------------------------------------------------
   CONFIGURATION
   Every number here was tuned by watching it, and the comment says what
   moving it does, because the next person to tune it will be doing so from
   a screenshot rather than from the maths.
   -------------------------------------------------------------------------- */

export type FluidConfig = {
  /** Simulation grid for the velocity field. Higher is finer and slower. */
  simResolution: number;
  /** Grid for the colour. Can exceed the velocity grid: colour reads sharper. */
  dyeResolution: number;
  /** How fast momentum decays. 1 never stops; below about 0.9 nothing flows. */
  velocityDissipation: number;
  /** How fast colour fades. This is what sets the length of a trail. */
  densityDissipation: number;
  /** Jacobi iterations for the pressure solve. Fewer is softer and cheaper. */
  pressureIterations: number;
  /** How much of the removed pressure is kept between frames. */
  pressure: number;
  /** Small eddies added back. 0 is smooth and lifeless, high is turbulent. */
  curl: number;
  /** Radius of one injected splat, as a fraction of the surface. */
  splatRadius: number;
  /** How hard a pointer movement pushes. */
  splatForce: number;
  /** Device pixel ratio ceiling. The field is soft: it does not need 3x. */
  maxDpr: number;
};

export const DESKTOP_CONFIG: FluidConfig = {
  simResolution: 128,
  dyeResolution: 512,
  velocityDissipation: 0.985,
  densityDissipation: 0.972,
  pressureIterations: 20,
  pressure: 0.8,
  curl: 26,
  splatRadius: 0.2,
  splatForce: 5200,
  maxDpr: 1.5,
};

/* Coarser everywhere. A phone GPU running a 128 grid with 20 pressure
   iterations spends its whole frame budget on a background, and there is no
   pointer on a touch screen to justify it. */
export const MOBILE_CONFIG: FluidConfig = {
  ...DESKTOP_CONFIG,
  simResolution: 72,
  dyeResolution: 256,
  pressureIterations: 12,
  curl: 18,
  maxDpr: 1,
};

/**
 * The dye palette: the scene family from `tokens.css`, at full chroma.
 *
 * Deliberately NOT a hue rotation. A rainbow cycle reads as a screensaver; a
 * curated set of the page's own hues reads as the page's own atmosphere.
 *
 * FULL CHROMA IS THE POINT, and the first version got this wrong. Those triples
 * were near the CSS values, which are pastel, so every channel sat close to
 * every other one. Two of them advecting into each other produced a texel whose
 * channels were closer still, and the whole field converged on grey with an
 * iridescent sheen where the small remaining differences got amplified. Dye
 * mixes, so it has to START far apart to still read as colour after it does.
 *
 * The pastel happens at the other end, in the display pass, where the dye is
 * turned into light rather than shown directly.
 */
export const PALETTE: readonly [number, number, number][] = [
  [0.42, 0.16, 0.95], // violet
  [0.12, 0.44, 0.95], // electric blue
  [0.04, 0.78, 0.88], // cyan
  [0.12, 0.88, 0.52], // mint
  [0.95, 0.30, 0.62], // rose
  [0.98, 0.52, 0.22], // peach
  [0.95, 0.82, 0.22], // lemon
];

/* --------------------------------------------------------------------------
   SHADERS
   -------------------------------------------------------------------------- */

const VERT = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 uTexelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(uTexelSize.x, 0.0);
  vR = vUv + vec2(uTexelSize.x, 0.0);
  vT = vUv + vec2(0.0, uTexelSize.y);
  vB = vUv - vec2(0.0, uTexelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const COPY = `#version 300 es
precision mediump float;
precision mediump sampler2D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;
void main () { fragColor = texture(uTexture, vUv); }`;

/* One point of momentum and colour, falling off as a gaussian. The aspect
   correction keeps a splat round on a wide viewport rather than an ellipse. */
const SPLAT = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTarget;
uniform float uAspectRatio;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint.xy;
  p.x *= uAspectRatio;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}`;

/* Semi-Lagrangian advection: look backwards along the velocity and read what
   was there. This is the step that makes colour travel and bend. */
const ADVECTION = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexelSize;
  vec4 result = texture(uSource, coord);
  float decay = 1.0 + (1.0 - uDissipation) * uDt;
  fragColor = result / decay;
}`;

const DIVERGENCE = `#version 300 es
precision mediump float;
precision mediump sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  /* Free-slip at the edges: reflect rather than let the field leak out, or
     colour drains off the sides and the middle goes flat. */
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL = `#version 300 es
precision mediump float;
precision mediump sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

/* Vorticity confinement. The pressure solve and the dissipation both smooth
   the field; this puts the small rotations back, which is the difference
   between liquid and haze. */
const VORTICITY = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  velocity = min(max(velocity, -1000.0), 1000.0);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const PRESSURE = `#version 300 es
precision mediump float;
precision mediump sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT = `#version 300 es
precision mediump float;
precision mediump sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

/*
  The display pass, and the only place the look is decided.

  IT COMPOSITES, IT DOES NOT REPLACE. The output is transparent where there is
  no dye, so the Stage 01 aurora underneath still paints the page's permanent
  ground. The first version wrote an opaque near-white and occluded that ground
  entirely: the whole document went flat white, which is a worse background than
  the one it replaced.

  The dye is energy rather than a colour to show directly: raw it is a dark
  field with bright streaks, which is a screensaver on a light document. So the
  dye drives BOTH a hue and an alpha, and the hue is lifted toward the light end
  so that what lands on the page is a bright pastel wash rather than a stain.

  Premultiplied alpha, because that is what a WebGL canvas composites with by
  default. Output straight (non-premultiplied) colour here and every edge of
  every mass gets a dark fringe.
*/
const DISPLAY = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;

float dither(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main () {
  vec3 dye = texture(uTexture, vUv).rgb;
  /* Soft knee, so a lot of the field stays near zero and the page stays light
     where nothing is happening. */
  vec3 c = dye / (0.85 + dye);
  float m = max(c.r, max(c.g, c.b));

  /*
    HUE FIRST, BRIGHTNESS SECOND.

    Adding a constant to every channel was the first attempt and it produced
    grey smoke: lifting r, g and b equally destroys the ratio between them,
    which is the only place the colour lives. Dividing by the brightest channel
    keeps that ratio and throws away only the intensity, which the alpha is
    already carrying.
  */
  /*
    Light through coloured liquid: start from white and take away what this
    texel absorbs, which is how far each channel sits below the brightest one.

    Normalizing to the brightest channel instead was the second attempt, and it
    made every texel fully saturated in its own hue. Where two colours had
    mixed, tiny channel differences were amplified back to vivid hues and the
    field turned into an oil slick. Here a mixed region has small deficits and
    stays near white, which is what mixing colour in water actually looks like.
  */
  vec3 tint = clamp(vec3(1.0) - (vec3(m) - c) * 1.15, 0.0, 1.0);

  /* Held well below 1: the field passes behind body copy, and a mass that
     reaches full strength there would win against the text. */
  float amount = clamp(m * 1.25, 0.0, 0.78);

  tint += (dither(vUv * 1024.0) - 0.5) * 0.012;
  fragColor = vec4(tint * amount, amount);
}`;

/* --------------------------------------------------------------------------
   GL PLUMBING
   -------------------------------------------------------------------------- */

type FBO = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach: (id: number) => number;
};

type DoubleFBO = {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FBO;
  write: FBO;
  swap: () => void;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "program link failed");
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(p, i)!.name;
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { program: p, uniforms };
}

export type FluidHandle = {
  /** Feed a pointer sample in CSS pixels relative to the canvas. */
  pointer: (x: number, y: number) => void;
  /** Pointer has left, so no more momentum until it returns. */
  release: () => void;
  /** Recompute the drawing buffer for a new size or pixel ratio. */
  resize: () => void;
  /** Stop or start the loop, for visibility and intersection. */
  setRunning: (running: boolean) => void;
  /** Release every GL resource and listener this created. */
  destroy: () => void;
  /** True once at least one frame has been drawn, for QA. */
  readonly frames: number;
};

/**
 * Start a fluid on a canvas. Returns null when WebGL2 or float rendering is
 * unavailable, which is a supported outcome rather than an error: the caller
 * paints the static field instead.
 */
export function createFluid(
  canvas: HTMLCanvasElement,
  config: FluidConfig
): FluidHandle | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  /* Rendering to float is what makes a velocity field possible at all. Half
     float is enough and is far more widely supported than full. */
  const halfFloat = gl.getExtension("EXT_color_buffer_half_float");
  const fullFloat = gl.getExtension("EXT_color_buffer_float");
  if (!halfFloat && !fullFloat) return null;
  gl.getExtension("OES_texture_float_linear");

  const HALF = gl.HALF_FLOAT;
  const linearFiltering = !!gl.getExtension("OES_texture_float_linear");
  const filter = linearFiltering ? gl.LINEAR : gl.NEAREST;

  /* One triangle pair covering clip space. Every pass is a full screen draw. */
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const elements = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const programs = {
    copy: program(gl, VERT, COPY),
    splat: program(gl, VERT, SPLAT),
    advection: program(gl, VERT, ADVECTION),
    divergence: program(gl, VERT, DIVERGENCE),
    curl: program(gl, VERT, CURL),
    vorticity: program(gl, VERT, VORTICITY),
    pressure: program(gl, VERT, PRESSURE),
    gradient: program(gl, VERT, GRADIENT_SUBTRACT),
    display: program(gl, VERT, DISPLAY),
  };
  const created: WebGLProgram[] = Object.values(programs).map((p) => p.program);

  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];

  function createFBO(w: number, h: number, internal: number, format: number, type: number): FBO {
    gl!.activeTexture(gl!.TEXTURE0);
    const texture = gl!.createTexture()!;
    textures.push(texture);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);

    const fbo = gl!.createFramebuffer()!;
    framebuffers.push(fbo);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
    gl!.viewport(0, 0, w, h);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      attach(id: number) {
        gl!.activeTexture(gl!.TEXTURE0 + id);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  function createDoubleFBO(w: number, h: number, internal: number, format: number, type: number): DoubleFBO {
    let fbo1 = createFBO(w, h, internal, format, type);
    let fbo2 = createFBO(w, h, internal, format, type);
    return {
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      get read() { return fbo1; },
      set read(v: FBO) { fbo1 = v; },
      get write() { return fbo2; },
      set write(v: FBO) { fbo2 = v; },
      swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
    };
  }

  let dye: DoubleFBO;
  let velocity: DoubleFBO;
  let divergence: FBO;
  let curl: FBO;
  let pressure: DoubleFBO;

  function dimensions(resolution: number) {
    const aspect = gl!.drawingBufferWidth / Math.max(1, gl!.drawingBufferHeight);
    const min = Math.round(resolution);
    const max = Math.round(resolution * (aspect < 1 ? 1 / aspect : aspect));
    return aspect > 1 ? { width: max, height: min } : { width: min, height: max };
  }

  function initFramebuffers() {
    const sim = dimensions(config.simResolution);
    const dyeDim = dimensions(config.dyeResolution);
    dye = createDoubleFBO(dyeDim.width, dyeDim.height, gl!.RGBA16F, gl!.RGBA, HALF);
    velocity = createDoubleFBO(sim.width, sim.height, gl!.RG16F, gl!.RG, HALF);
    divergence = createFBO(sim.width, sim.height, gl!.R16F, gl!.RED, HALF);
    curl = createFBO(sim.width, sim.height, gl!.R16F, gl!.RED, HALF);
    pressure = createDoubleFBO(sim.width, sim.height, gl!.R16F, gl!.RED, HALF);
  }

  function blit(target: FBO | null) {
    if (target) {
      gl!.viewport(0, 0, target.width, target.height);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo);
    } else {
      gl!.viewport(0, 0, gl!.drawingBufferWidth, gl!.drawingBufferHeight);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    }
    gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
  }

  /* ------------------------------------------------------------------
     POINTER
     Position AND velocity, which is the requirement a spotlight fails.
     ------------------------------------------------------------------ */

  let pointerX = 0.5;
  let pointerY = 0.5;
  let prevX = 0.5;
  let prevY = 0.5;
  let deltaX = 0;
  let deltaY = 0;
  let moved = false;
  let colorIndex = 0;
  let lastMoveAt = 0;

  function pointer(x: number, y: number) {
    const rect = canvas.getBoundingClientRect();
    const nx = x / Math.max(1, rect.width);
    /* GL's origin is bottom left; the DOM's is top left. */
    const ny = 1 - y / Math.max(1, rect.height);
    prevX = pointerX;
    prevY = pointerY;
    pointerX = nx;
    pointerY = ny;
    deltaX = pointerX - prevX;
    deltaY = pointerY - prevY;
    /*
      A stationary pointer must not keep injecting. `pointermove` fires for
      sub-pixel jitter and for a scroll under a still cursor, and without this
      the field would receive a steady drip of identical splats and slowly
      saturate under a cursor nobody is moving.
    */
    if (Math.abs(deltaX) + Math.abs(deltaY) > 0.0005) {
      moved = true;
      lastMoveAt = performance.now();
    }
  }

  function release() {
    moved = false;
    deltaX = 0;
    deltaY = 0;
  }

  function splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
    gl!.useProgram(programs.splat.program);
    gl!.uniform1i(programs.splat.uniforms.uTarget, velocity.read.attach(0));
    gl!.uniform1f(programs.splat.uniforms.uAspectRatio, canvas.width / Math.max(1, canvas.height));
    gl!.uniform2f(programs.splat.uniforms.uPoint, x, y);
    gl!.uniform3f(programs.splat.uniforms.uColor, dx, dy, 0);
    gl!.uniform1f(programs.splat.uniforms.uRadius, config.splatRadius / 100);
    blit(velocity.write);
    velocity.swap();

    gl!.uniform1i(programs.splat.uniforms.uTarget, dye.read.attach(0));
    gl!.uniform3f(programs.splat.uniforms.uColor, color[0], color[1], color[2]);
    blit(dye.write);
    dye.swap();
  }

  /*
    One pointer movement injects SEVERAL overlapping impulses, not one.

    A single splat per frame is a bead on a string and reads as a cursor
    decoration. Three, at slightly different offsets along the direction of
    travel and in different hues from the palette, is a disturbance with a
    leading edge and a wake, which is what a fast flick should leave behind.
  */
  function injectPointer() {
    if (!moved) return;
    moved = false;
    const dx = deltaX * config.splatForce;
    const dy = deltaY * config.splatForce;
    const speed = Math.hypot(deltaX, deltaY);
    const impulses = speed > 0.01 ? 3 : 2;
    for (let i = 0; i < impulses; i++) {
      const t = i / impulses;
      const color = PALETTE[colorIndex % PALETTE.length];
      colorIndex += 1;
      const spread = (i - (impulses - 1) / 2) * 0.012;
      splat(
        pointerX - deltaX * t + spread,
        pointerY - deltaY * t + spread * 0.6,
        dx * (1 - t * 0.35),
        dy * (1 - t * 0.35),
        [color[0] * 0.35, color[1] * 0.35, color[2] * 0.35]
      );
    }
  }

  /*
    AUTONOMOUS DRIFT.

    The field must be alive with no pointer at all: that is the whole of the
    mobile behaviour and it is what stops a desktop page looking dead while
    somebody reads. Slow, wide, low-force splats on a long period, placed on a
    wandering path rather than at random, so the result is a current rather
    than a twitch.
  */
  let ambientAt = 0;
  let ambientPhase = Math.PI * 0.25;
  function ambient(now: number) {
    if (now - ambientAt < 900) return;
    ambientAt = now;
    ambientPhase += 0.37;
    const x = 0.5 + Math.cos(ambientPhase) * 0.34;
    const y = 0.5 + Math.sin(ambientPhase * 0.73) * 0.3;
    const color = PALETTE[colorIndex % PALETTE.length];
    colorIndex += 1;
    splat(
      x,
      y,
      Math.cos(ambientPhase * 1.3) * 260,
      Math.sin(ambientPhase * 0.9) * 260,
      [color[0] * 0.11, color[1] * 0.11, color[2] * 0.11]
    );
  }

  /* ------------------------------------------------------------------
     THE STEP
     ------------------------------------------------------------------ */

  function step(dt: number) {
    gl!.disable(gl!.BLEND);

    gl!.useProgram(programs.curl.program);
    gl!.uniform2f(programs.curl.uniforms.uTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    gl!.useProgram(programs.vorticity.program);
    gl!.uniform2f(programs.vorticity.uniforms.uTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl!.uniform1i(programs.vorticity.uniforms.uCurl, curl.attach(1));
    gl!.uniform1f(programs.vorticity.uniforms.uCurlStrength, config.curl);
    gl!.uniform1f(programs.vorticity.uniforms.uDt, dt);
    blit(velocity.write);
    velocity.swap();

    gl!.useProgram(programs.divergence.program);
    gl!.uniform2f(programs.divergence.uniforms.uTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    /* Keep a fraction of last frame's pressure as the starting guess: the
       Jacobi solve converges far faster from a warm start. */
    gl!.useProgram(programs.copy.program);
    gl!.uniform1i(programs.copy.uniforms.uTexture, pressure.read.attach(0));
    blit(pressure.write);
    pressure.swap();

    gl!.useProgram(programs.pressure.program);
    gl!.uniform2f(programs.pressure.uniforms.uTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.pressure.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.pressureIterations; i++) {
      gl!.uniform1i(programs.pressure.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gl!.useProgram(programs.gradient.program);
    gl!.uniform2f(programs.gradient.uniforms.uTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.gradient.uniforms.uPressure, pressure.read.attach(0));
    gl!.uniform1i(programs.gradient.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    gl!.useProgram(programs.advection.program);
    gl!.uniform2f(programs.advection.uniforms.uTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl!.uniform1i(programs.advection.uniforms.uSource, velocity.read.attach(0));
    gl!.uniform1f(programs.advection.uniforms.uDt, dt);
    gl!.uniform1f(programs.advection.uniforms.uDissipation, config.velocityDissipation);
    blit(velocity.write);
    velocity.swap();

    gl!.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl!.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1));
    gl!.uniform1f(programs.advection.uniforms.uDissipation, config.densityDissipation);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl!.useProgram(programs.display.program);
    gl!.uniform1i(programs.display.uniforms.uTexture, dye.read.attach(0));
    gl!.uniform2f(programs.display.uniforms.uTexelSize, dye.texelSizeX, dye.texelSizeY);
    blit(null);
  }

  /* ------------------------------------------------------------------
     LOOP AND LIFECYCLE
     ------------------------------------------------------------------ */

  let raf = 0;
  let running = false;
  let last = performance.now();
  let frames = 0;
  let destroyed = false;

  function frame(now: number) {
    if (destroyed) return;
    /* Clamped: a backgrounded tab returns with a huge delta, and advecting by
       it throws the whole field off screen in one step. */
    const dt = Math.min(0.0166, (now - last) / 1000) || 0.0166;
    last = now;
    injectPointer();
    ambient(now);
    /* After a movement stops, the solver keeps carrying what is already there.
       That decay IS the settling the direction asks for. */
    if (now - lastMoveAt > 8000 && frames % 2 === 1) {
      /* Nothing new is happening: halve the work rather than stop, so the
         atmosphere still drifts without holding a core at full rate. */
      render();
      frames += 1;
      raf = requestAnimationFrame(frame);
      return;
    }
    step(dt);
    render();
    frames += 1;
    raf = requestAnimationFrame(frame);
  }

  function setRunning(next: boolean) {
    if (destroyed || next === running) return;
    running = next;
    if (running) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function resize() {
    if (destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    initFramebuffers();
    seed();
  }

  /* A page that opens on an empty field looks broken for the first second, so
     the surface starts with colour already in it. */
  function seed() {
    for (let i = 0; i < 9; i++) {
      const color = PALETTE[i % PALETTE.length];
      const a = (i / 9) * Math.PI * 2;
      splat(
        0.5 + Math.cos(a) * 0.34,
        0.5 + Math.sin(a) * 0.3,
        Math.cos(a) * 520,
        Math.sin(a) * 520,
        [color[0] * 0.22, color[1] * 0.22, color[2] * 0.22]
      );
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    running = false;
    for (const t of textures) gl!.deleteTexture(t);
    for (const f of framebuffers) gl!.deleteFramebuffer(f);
    for (const p of created) gl!.deleteProgram(p);
    gl!.deleteBuffer(buffer);
    gl!.deleteBuffer(elements);
    textures.length = 0;
    framebuffers.length = 0;
    /* Ask the driver to drop the context rather than waiting for GC: a page
       that mounts and unmounts this repeatedly would otherwise hold several. */
    gl!.getExtension("WEBGL_lose_context")?.loseContext();
  }

  resize();

  return {
    pointer,
    release,
    resize,
    setRunning,
    destroy,
    get frames() { return frames; },
  };
}
