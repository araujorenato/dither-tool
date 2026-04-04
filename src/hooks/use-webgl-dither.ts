import { useRef, useEffect, useCallback } from "react";
import { WebGLDitherer } from "@/lib/webgl-dither";
import type { AlgorithmId, ImageParams } from "@/lib/types";

/**
 * React hook that manages a WebGLDitherer tied to a canvas element.
 *
 * Usage:
 *   const { canvasRef, loadImage, setCanvasSize, setParams, … } = useWebGLDither();
 *   <canvas ref={canvasRef} />
 *
 * The ditherer is created lazily on the first `loadImage` call (when the
 * canvas element is guaranteed to be mounted).  If the canvas element is
 * replaced (e.g. the component unmounts/remounts), `loadImage` detects the
 * change and recreates the ditherer automatically.
 */
export function useWebGLDither() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ditherRef = useRef<WebGLDitherer | null>(null);

  // Destroy the ditherer when the hook unmounts
  useEffect(() => {
    return () => {
      ditherRef.current?.destroy();
      ditherRef.current = null;
    };
  }, []);

  /** Ensure a live WebGLDitherer exists for the current canvas element. */
  const ensureDitherer = useCallback((): WebGLDitherer | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // If the canvas element was replaced (component remounted), recreate
    if (ditherRef.current && ditherRef.current.getCanvas() !== canvas) {
      ditherRef.current.destroy();
      ditherRef.current = null;
    }

    if (!ditherRef.current) {
      try {
        ditherRef.current = new WebGLDitherer(canvas);
        ditherRef.current.start();
      } catch (err) {
        console.error("[useWebGLDither] Initialisation failed:", err);
        return null;
      }
    }

    return ditherRef.current;
  }, []);

  /**
   * Upload a new source image and set the output canvas dimensions.
   * Always call this when a new image is loaded.
   */
  const loadImage = useCallback(
    (img: HTMLImageElement, w: number, h: number) => {
      const d = ensureDitherer();
      if (!d) return;
      d.setCanvasSize(w, h);
      d.loadImage(img);
    },
    [ensureDitherer]
  );

  const setCanvasSize = useCallback(
    (w: number, h: number) => {
      ditherRef.current?.setCanvasSize(w, h);
    },
    []
  );

  const setParams = useCallback((params: ImageParams) => {
    ditherRef.current?.setParams(params);
  }, []);

  const setAlgorithm = useCallback((alg: AlgorithmId) => {
    ditherRef.current?.setAlgorithm(alg);
  }, []);

  const setPixelSize = useCallback((px: number) => {
    ditherRef.current?.setPixelSize(px);
  }, []);

  const setShowOriginal = useCallback((show: boolean) => {
    ditherRef.current?.setShowOriginal(show);
  }, []);

  const displayFrame = useCallback((frame: ImageData | null) => {
    ditherRef.current?.displayFrame(frame);
  }, []);

  /** Force a render synchronously, then call canvas.toDataURL. */
  const exportDataUrl = useCallback((type = "image/png"): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    ditherRef.current?.forceRender();
    return canvas.toDataURL(type);
  }, []);

  return {
    canvasRef,
    loadImage,
    setCanvasSize,
    setParams,
    setAlgorithm,
    setPixelSize,
    setShowOriginal,
    displayFrame,
    exportDataUrl,
  };
}
