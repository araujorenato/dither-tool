import {
  applyAdjustments,
  toGrayscale,
  grayToImageData,
  floydSteinberg,
  bayerDither,
  stuckiDither,
} from "../lib/image-processing";
import type { AlgorithmId, ImageParams } from "../lib/types";

const algorithmFns: Record<
  AlgorithmId,
  (gray: Float32Array, w: number, h: number, g: number, buf?: Float32Array) => Float32Array
> = {
  "floyd-steinberg": floydSteinberg,
  bayer: bayerDither,
  stucki: stuckiDither,
};

// ─── Persistent buffers — survive across onmessage calls ─────────────────────
// Allocated once (or when the image grows larger) and reused every frame,
// eliminating ~16 MB of allocations and GC pressure per slider interaction.
let adjustBuf: Uint8ClampedArray | null = null;
let grayBuf:   Float32Array     | null = null;
let ditherBuf: Float32Array     | null = null;
let outputBuf: Uint8ClampedArray | null = null;

function ensureBuffers(pixelCount: number): void {
  const rgba = pixelCount * 4;
  if (!adjustBuf || adjustBuf.length < rgba)       adjustBuf = new Uint8ClampedArray(rgba);
  if (!outputBuf || outputBuf.length < rgba)       outputBuf = new Uint8ClampedArray(rgba);
  if (!grayBuf   || grayBuf.length < pixelCount)   grayBuf   = new Float32Array(pixelCount);
  if (!ditherBuf || ditherBuf.length < pixelCount) ditherBuf = new Float32Array(pixelCount);
}

export interface WorkerMessage {
  type: "process" | "thumbnail";
  imageData: ImageData;
  params: ImageParams;
  algorithm: AlgorithmId;
  id: number;
}

export interface WorkerResponse {
  type: "process" | "thumbnail";
  result: ImageData;
  algorithm: AlgorithmId;
  id: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, imageData, params, algorithm, id } = e.data;
  const { width, height } = imageData;
  const pixelCount = width * height;
  const rgbaSize   = pixelCount * 4;

  ensureBuffers(pixelCount);

  // Always slice to the exact size needed: new ImageData(buf, w, h) requires
  // buf.length === w * h * 4 exactly, and the algorithm loops use .length as
  // their bound. subarray() is a zero-copy view — no allocation overhead.
  const adjustSlice = adjustBuf!.subarray(0, rgbaSize)  as Uint8ClampedArray;
  const graySlice   = grayBuf!.subarray(0, pixelCount);
  const ditherSlice = ditherBuf!.subarray(0, pixelCount);
  const outputSlice = outputBuf!.subarray(0, rgbaSize)  as Uint8ClampedArray;

  const adjusted = applyAdjustments(imageData, params, adjustSlice);
  const gray     = toGrayscale(adjusted, graySlice);
  const dithered = algorithmFns[algorithm](gray, width, height, params.granulation, ditherSlice);
  const result   = grayToImageData(dithered, width, height, outputSlice);

  const response: WorkerResponse = { type, result, algorithm, id };
  self.postMessage(response);
};
