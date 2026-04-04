export type AlgorithmId = "floyd-steinberg" | "bayer" | "stucki";

export interface ImageParams {
  contrast: number;
  highlights: number;
  shadows: number;
  gamma: number;
  granulation: number;
}

export interface AlgorithmInfo {
  name: string;
  desc: string;
}

export interface LoadedImage {
  file: File;
  name: string;
  element: HTMLImageElement;
  width: number;
  height: number;
}

export interface ExportInfo {
  fileName: string;
  width: number;
  height: number;
  algorithm: AlgorithmId;
}

export const DEFAULT_PARAMS: ImageParams = {
  contrast: 0,
  highlights: 0,
  shadows: 0,
  gamma: 0,
  granulation: 0,
};

export const DEFAULT_ALGORITHM: AlgorithmId = "floyd-steinberg";

export const ALGORITHMS: Record<AlgorithmId, AlgorithmInfo> = {
  "floyd-steinberg": {
    name: "Floyd-Steinberg",
    desc: "Error diffusion · organic",
  },
  bayer: {
    name: "Bayer",
    desc: "Ordered matrix · geometric",
  },
  stucki: {
    name: "Stucki",
    desc: "Error diffusion · fine grain",
  },
};

export interface AnimationFrame {
  id: string;
  image: LoadedImage;
  params: ImageParams;
  committedParams: ImageParams;
  algorithm: AlgorithmId;
  pixelSize: number;
  processedData: ImageData | null;
  thumbnailUrl: string | null;
}

export const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_DIMENSION = 4000;
