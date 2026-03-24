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
  (gray: Float32Array, w: number, h: number, g: number) => Float32Array
> = {
  "floyd-steinberg": floydSteinberg,
  bayer: bayerDither,
  stucki: stuckiDither,
};

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

  const adjusted = applyAdjustments(imageData, params);
  const gray = toGrayscale(adjusted);
  const dithered = algorithmFns[algorithm](
    gray,
    imageData.width,
    imageData.height,
    params.granulation
  );
  const result = grayToImageData(dithered, imageData.width, imageData.height);

  const response: WorkerResponse = { type, result, algorithm, id };
  self.postMessage(response);
};
