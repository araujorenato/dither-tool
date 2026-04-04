import type { AlgorithmId, ImageParams } from "./types";

const ALGORITHM_INDEX: Record<AlgorithmId, number> = {
  "floyd-steinberg": 0,
  bayer: 1,
  stucki: 2,
};

// ─── Shaders ─────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2      u_resolution;
uniform float     u_pixelSize;
uniform float     u_contrast;    // –100..100
uniform float     u_shadows;     // –100..100
uniform float     u_highlights;  // –100..100
uniform float     u_gamma;       // –100..100
uniform float     u_granulation; // –100..100
uniform int       u_algorithm;   // 0=floyd-steinberg, 1=bayer, 2=stucki
uniform int       u_showOriginal;
uniform sampler2D u_cpuFrame;    // texture unit 1 — CPU-rendered result
uniform int       u_useCpuFrame; // 1 → pass-through blit; 0 → WebGL dither path

out vec4 fragColor;

// 4×4 Bayer ordered dither matrix (values 0–15)
const float BAYER4[16] = float[16](
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

// Interleaved Gradient Noise — blue-noise-like distribution, no visible periodicity
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  // CPU pass-through: blit the pre-computed CPU frame directly.
  if (u_useCpuFrame != 0) {
    vec2 uvCpu = vec2(gl_FragCoord.x / u_resolution.x,
                      1.0 - gl_FragCoord.y / u_resolution.y);
    fragColor = texture(u_cpuFrame, uvCpu);
    return;
  }

  // Snap every fragment in a dither block to the block's centre sample point
  vec2 pixelIdx   = floor(gl_FragCoord.xy / u_pixelSize);
  vec2 sampleFrag = pixelIdx * u_pixelSize + u_pixelSize * 0.5;

  // WebGL has y=0 at bottom; images are stored top-to-bottom → flip y
  vec2 uv = vec2(sampleFrag.x / u_resolution.x,
                 1.0 - sampleFrag.y / u_resolution.y);

  vec4 color = texture(u_image, uv);

  if (u_showOriginal != 0) {
    fragColor = color;
    return;
  }

  // ── Tone adjustments — exact port of the CPU pipeline ────────────────────
  // All adjustments use the luminance of the ORIGINAL colour as influence key,
  // mirroring the CPU code which computes lumNorm from the unadjusted pixel.
  float lumNorm = dot(color.rgb, vec3(0.299, 0.587, 0.114));

  float shadowFactor    = 1.0 + u_shadows    / 100.0;
  float highlightFactor = 1.0 + u_highlights / 100.0;
  float contrastFactor  = (259.0 * (u_contrast + 255.0))
                        / (255.0 * (259.0 - u_contrast));
  float gammaExp = u_gamma > 0.0
    ? 1.0 / (1.0 + u_gamma / 50.0)
    : 1.0 + abs(u_gamma) / 50.0;

  vec3 adj = color.rgb;

  // Shadows: lift/crush dark tones
  float shadowInf = lumNorm < 0.5 ? 1.0 - lumNorm * 2.0 : 0.0;
  adj *= 1.0 + (shadowFactor - 1.0) * shadowInf;

  // Highlights: lift/crush bright tones
  float highlightInf = lumNorm > 0.5 ? (lumNorm - 0.5) * 2.0 : 0.0;
  adj *= 1.0 + (highlightFactor - 1.0) * highlightInf;

  // Contrast (S-curve around 0.5)
  adj = (adj - 0.5) * contrastFactor + 0.5;

  // Gamma
  adj = pow(max(adj, vec3(0.0)), vec3(gammaExp));
  adj = clamp(adj, 0.0, 1.0);

  // ── Luminance ────────────────────────────────────────────────────────────
  float gray = dot(adj, vec3(0.299, 0.587, 0.114));

  // ── Dithering ─────────────────────────────────────────────────────────────
  // grainNorm: granulation –100→0, 0→0.5, +100→1
  float grainNorm = (u_granulation + 100.0) / 200.0;
  float result;

  // Flip y so row 0 is at the image top, matching the CPU pipeline which
  // iterates y=0..height-1 top-to-bottom. Without this the 4×4 Bayer pattern
  // is vertically shifted relative to the CPU worker that generates thumbnails.
  float totalRows = floor(u_resolution.y / u_pixelSize);
  int   bx        = int(mod(pixelIdx.x, 4.0));
  int   by        = int(mod(totalRows - 1.0 - pixelIdx.y, 4.0));

  if (u_algorithm == 1) {
    // Bayer 4×4 — ordered geometric dithering
    // Exact port of CPU formula: gray_n > strength * (128/255 – bayer/16)
    float strength  = 0.3 + grainNorm * 1.4;
    float threshold = strength * (0.5 - BAYER4[by * 4 + bx] / 16.0);
    result = gray > threshold ? 1.0 : 0.0;

  } else if (u_algorithm == 2) {
    // Stucki — fine-grain organic dithering
    // True Stucki error diffusion requires sequential pixel access and cannot
    // run in a single parallel GPU pass. We approximate its "fine grain,
    // organic" character by blending IGN (blue-noise-like) with the 4×4 Bayer
    // scaffold (16 tonal levels, fine dot size). The mix breaks the strict
    // geometric grid while preserving fine structure absent in pure noise.
    float bayerNorm = BAYER4[by * 4 + bx] / 16.0;  // 0 .. 0.9375
    float noise     = ign(pixelIdx);
    // 25 % ordered scaffold + 75 % organic noise → fine dots, no visible grid
    float blended   = mix(noise, bayerNorm, 0.25);
    float threshold = mix(0.5, blended, grainNorm);
    result = gray > threshold ? 1.0 : 0.0;

  } else {
    // Floyd-Steinberg → organic noise via Interleaved Gradient Noise
    // mix(0.5, noise, grainNorm): grainNorm=0 → hard threshold at 0.5,
    //   grainNorm=1 → pure noise threshold (maximally organic)
    float noise     = ign(pixelIdx);
    float threshold = mix(0.5, noise, grainNorm);
    result = gray > threshold ? 1.0 : 0.0;
  }

  fragColor = vec4(result, result, result, 1.0);
}`;

// ─── WebGL helpers ───────────────────────────────────────────────────────────

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error:\n${log}`);
  }
  return prog;
}

// ─── WebGLDitherer ───────────────────────────────────────────────────────────

export class WebGLDitherer {
  private readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private texture: WebGLTexture | null = null;
  private cpuFrameTexture: WebGLTexture | null = null;
  private useCpuFrame = false;
  private rafId: number | null = null;
  private dirty = false;
  private hasImage = false;

  // Cached uniform locations
  private readonly uImage:       WebGLUniformLocation;
  private readonly uResolution:  WebGLUniformLocation;
  private readonly uPixelSize:   WebGLUniformLocation;
  private readonly uContrast:    WebGLUniformLocation;
  private readonly uShadows:     WebGLUniformLocation;
  private readonly uHighlights:  WebGLUniformLocation;
  private readonly uGamma:       WebGLUniformLocation;
  private readonly uGranulation: WebGLUniformLocation;
  private readonly uAlgorithm:   WebGLUniformLocation;
  private readonly uShowOriginal:WebGLUniformLocation;
  private readonly uCpuFrame:    WebGLUniformLocation;
  private readonly uUseCpuFrame: WebGLUniformLocation;

  // Current render state
  private params: ImageParams = {
    contrast: 0, highlights: 0, shadows: 0, gamma: 0, granulation: 0,
  };
  private algorithm: AlgorithmId = "floyd-steinberg";
  private pixelSize = 1;
  private showOriginal = false;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL 2 is not supported in this browser");
    this.gl = gl;
    this.prog = createProgram(gl);

    // Cache uniform locations once
    const loc = (name: string) => gl.getUniformLocation(this.prog, name)!;
    this.uImage        = loc("u_image");
    this.uResolution   = loc("u_resolution");
    this.uPixelSize    = loc("u_pixelSize");
    this.uContrast     = loc("u_contrast");
    this.uShadows      = loc("u_shadows");
    this.uHighlights   = loc("u_highlights");
    this.uGamma        = loc("u_gamma");
    this.uGranulation  = loc("u_granulation");
    this.uAlgorithm    = loc("u_algorithm");
    this.uShowOriginal = loc("u_showOriginal");
    this.uCpuFrame     = loc("u_cpuFrame");
    this.uUseCpuFrame  = loc("u_useCpuFrame");

    // Full-screen quad: 4 vertices (TRIANGLE_STRIP covers the entire viewport)
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(this.prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  }

  /** Returns the underlying canvas element — used to detect remounts. */
  getCanvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  /** Upload a new source image as a WebGL texture. */
  loadImage(img: HTMLImageElement): void {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    this.texture  = tex;
    this.hasImage = true;
    this.dirty    = true;
  }

  /** Resize the output canvas and update the WebGL viewport. */
  setCanvasSize(w: number, h: number): void {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
    this.dirty = true;
  }

  setParams(p: ImageParams): void {
    this.params = p;
    this.dirty  = true;
  }

  setAlgorithm(alg: AlgorithmId): void {
    this.algorithm = alg;
    this.dirty     = true;
  }

  setPixelSize(px: number): void {
    this.pixelSize = px;
    this.dirty     = true;
  }

  setShowOriginal(show: boolean): void {
    this.showOriginal = show;
    this.dirty        = true;
  }

  /**
   * Upload a CPU-computed ImageData as a WebGL texture and switch the shader
   * into pass-through mode. Pass null to revert to the WebGL dither path.
   */
  displayFrame(frame: ImageData | null): void {
    const gl = this.gl;
    if (frame === null) {
      if (this.cpuFrameTexture) {
        gl.deleteTexture(this.cpuFrameTexture);
        this.cpuFrameTexture = null;
      }
      this.useCpuFrame = false;
      this.dirty = true;
      return;
    }

    if (!this.cpuFrameTexture) this.cpuFrameTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.cpuFrameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      frame.width, frame.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, frame.data
    );
    this.useCpuFrame = true;
    this.dirty = true;
  }

  /** Begin the dirty-flag rAF loop (renders only when something changed). */
  start(): void {
    const loop = () => {
      if (this.dirty && this.hasImage) {
        this.render();
        this.dirty = false;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Force an immediate render (e.g. before calling canvas.toDataURL). */
  forceRender(): void {
    if (this.hasImage) {
      this.render();
      this.dirty = false;
    }
  }

  destroy(): void {
    this.stop();
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.cpuFrameTexture) gl.deleteTexture(this.cpuFrameTexture);
    gl.deleteProgram(this.prog);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private render(): void {
    const gl     = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const { contrast, shadows, highlights, gamma, granulation } = this.params;

    gl.useProgram(this.prog);

    gl.uniform1i(this.uImage,        0);
    gl.uniform2f(this.uResolution,   canvas.width, canvas.height);
    gl.uniform1f(this.uPixelSize,    this.pixelSize);
    gl.uniform1f(this.uContrast,     contrast);
    gl.uniform1f(this.uShadows,      shadows);
    gl.uniform1f(this.uHighlights,   highlights);
    gl.uniform1f(this.uGamma,        gamma);
    gl.uniform1f(this.uGranulation,  granulation);
    gl.uniform1i(this.uAlgorithm,    ALGORITHM_INDEX[this.algorithm]);
    gl.uniform1i(this.uShowOriginal, this.showOriginal ? 1 : 0);
    // showOriginal overrides useCpuFrame so the original-image path always wins
    gl.uniform1i(this.uUseCpuFrame, (!this.showOriginal && this.useCpuFrame) ? 1 : 0);
    gl.uniform1i(this.uCpuFrame,    1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Bind CPU frame texture to unit 1 (fallback to original to avoid null-texture warning)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.cpuFrameTexture ?? this.texture);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
