import type { ImageParams, AlgorithmId } from "./types";

/**
 * Apply image adjustments: contrast, highlights, shadows, gamma
 * All processing is 100% client-side via Canvas API (RF-12)
 */
export function applyAdjustments(
  imageData: ImageData,
  params: ImageParams,
  out?: Uint8ClampedArray
): ImageData {
  const size = imageData.data.length;
  const data = (out && out.length >= size) ? out : new Uint8ClampedArray(size);
  data.set(imageData.data);
  const { contrast, highlights, shadows, gamma } = params;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const shadowFactor = 1 + shadows / 100;
  const highlightFactor = 1 + highlights / 100;
  const gammaVal =
    gamma > 0 ? 1 / (1 + gamma / 50) : 1 + Math.abs(gamma) / 50;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lumNorm = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    const adjust = (val: number): number => {
      let v = val / 255;

      // Shadows: boost or reduce dark tones
      if (lumNorm < 0.5) {
        const influence = 1 - lumNorm * 2;
        v = v * (1 + (shadowFactor - 1) * influence);
      }

      // Highlights: boost or reduce bright tones
      if (lumNorm > 0.5) {
        const influence = (lumNorm - 0.5) * 2;
        v = v * (1 + (highlightFactor - 1) * influence);
      }

      // Contrast
      v = (v - 0.5) * contrastFactor + 0.5;

      // Gamma
      v = Math.pow(Math.max(0, v), gammaVal);

      return Math.min(255, Math.max(0, v * 255));
    };

    data[i] = adjust(r);
    data[i + 1] = adjust(g);
    data[i + 2] = adjust(b);
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/** Convert RGBA ImageData to grayscale float array */
export function toGrayscale(imageData: ImageData, out?: Float32Array): Float32Array {
  const size = imageData.width * imageData.height;
  const gray = (out && out.length >= size) ? out : new Float32Array(size);
  const data = imageData.data;
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }
  return gray;
}

/** Convert grayscale float array back to RGBA ImageData */
export function grayToImageData(
  gray: Float32Array,
  width: number,
  height: number,
  out?: Uint8ClampedArray
): ImageData {
  const size = width * height * 4;
  const data = (out && out.length >= size) ? out : new Uint8ClampedArray(size);
  for (let i = 0; i < gray.length; i++) {
    const v = Math.min(255, Math.max(0, Math.round(gray[i])));
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }
  return new ImageData(data, width, height);
}

/* ─── Dithering Algorithms ─── */

/** Floyd-Steinberg error diffusion dithering */
export function floydSteinberg(
  gray: Float32Array,
  width: number,
  height: number,
  granulation: number,
  buf?: Float32Array
): Float32Array {
  const out = (buf && buf.length >= gray.length) ? buf : new Float32Array(gray.length);
  out.set(gray);
  const strength = (granulation + 100) / 200;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = out[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      out[idx] = newVal;
      const error = (oldVal - newVal) * strength;

      if (x + 1 < width) out[idx + 1] += error * (7 / 16);
      if (y + 1 < height) {
        if (x > 0) out[(y + 1) * width + x - 1] += error * (3 / 16);
        out[(y + 1) * width + x] += error * (5 / 16);
        if (x + 1 < width) out[(y + 1) * width + x + 1] += error * (1 / 16);
      }
    }
  }
  return out;
}

/** Bayer ordered dithering with 4×4 threshold matrix */
export function bayerDither(
  gray: Float32Array,
  width: number,
  height: number,
  granulation: number,
  buf?: Float32Array
): Float32Array {
  const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  // Bayer doesn't read previous values so no need to copy — just reuse the buffer
  const out = (buf && buf.length >= gray.length) ? buf : new Float32Array(gray.length);
  const threshold = 255 / 16;
  const strength = 0.3 + ((granulation + 100) / 200) * 1.4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const bayerVal = bayer4[y % 4][x % 4] * threshold * strength;
      out[idx] = gray[idx] + bayerVal - 128 * strength > 0 ? 255 : 0;
    }
  }
  return out;
}

/** Stucki error diffusion dithering (wider diffusion kernel) */
export function stuckiDither(
  gray: Float32Array,
  width: number,
  height: number,
  granulation: number,
  buf?: Float32Array
): Float32Array {
  const out = (buf && buf.length >= gray.length) ? buf : new Float32Array(gray.length);
  out.set(gray);
  const strength = (granulation + 100) / 200;
  const div = 42;

  const distribute = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    weight: number,
    error: number
  ) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny < height) {
      out[ny * width + nx] += (error * weight) / div;
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = out[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      out[idx] = newVal;
      const error = (oldVal - newVal) * strength;

      distribute(x, y, 1, 0, 8, error);
      distribute(x, y, 2, 0, 4, error);
      distribute(x, y, -2, 1, 2, error);
      distribute(x, y, -1, 1, 4, error);
      distribute(x, y, 0, 1, 8, error);
      distribute(x, y, 1, 1, 4, error);
      distribute(x, y, 2, 1, 2, error);
      distribute(x, y, -2, 2, 1, error);
      distribute(x, y, -1, 2, 2, error);
      distribute(x, y, 0, 2, 4, error);
      distribute(x, y, 1, 2, 2, error);
      distribute(x, y, 2, 2, 1, error);
    }
  }
  return out;
}

/** Algorithm function map */
const algorithmFns: Record<
  AlgorithmId,
  (gray: Float32Array, w: number, h: number, g: number) => Float32Array
> = {
  "floyd-steinberg": floydSteinberg,
  bayer: bayerDither,
  stucki: stuckiDither,
};

/**
 * Full pipeline: adjustments → grayscale → dithering → ImageData
 */
export function processImage(
  imgData: ImageData,
  params: ImageParams,
  algorithm: AlgorithmId
): ImageData {
  const adjusted = applyAdjustments(imgData, params);
  const gray = toGrayscale(adjusted);
  const dithered = algorithmFns[algorithm](
    gray,
    imgData.width,
    imgData.height,
    params.granulation
  );
  return grayToImageData(dithered, imgData.width, imgData.height);
}
