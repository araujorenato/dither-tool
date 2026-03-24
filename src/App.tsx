import { useState, useRef, useCallback, useEffect } from "react";
import { Header } from "@/components/header";
import { UploadScreen } from "@/components/upload-screen";
import { Sidebar } from "@/components/sidebar";
import { PreviewCanvas } from "@/components/preview-canvas";
import { ExportSuccess } from "@/components/export-success";
import { useDitherWorker } from "@/hooks/use-dither-worker";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  DEFAULT_PARAMS,
  DEFAULT_ALGORITHM,
  ALGORITHMS,
  MAX_DIMENSION,
} from "@/lib/types";
import type {
  ImageParams,
  AlgorithmId,
  LoadedImage,
  ExportInfo,
} from "@/lib/types";

const DEBOUNCE_BY_ALGORITHM: Record<AlgorithmId, number> = {
  bayer: 30,
  "floyd-steinberg": 50,
  stucki: 80,
};

export default function App() {
  // ─── State ───
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [params, setParams] = useState<ImageParams>({ ...DEFAULT_PARAMS });
  const [committedParams, setCommittedParams] = useState<ImageParams>({ ...DEFAULT_PARAMS });
  const [algorithm, setAlgorithm] = useState<AlgorithmId>(DEFAULT_ALGORITHM);
  const [showOriginal, setShowOriginal] = useState(false);
  const [exportDialog, setExportDialog] = useState<ExportInfo | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixelSize, setPixelSize] = useState(1);

  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Cache for scaled source ImageData — avoid redrawing on every param change
  const srcDataRef = useRef<ImageData | null>(null);
  const srcDimensionsRef = useRef({ w: 0, h: 0, imageId: "" });
  // Stale result guard for async worker responses
  const latestProcessIdRef = useRef(0);
  // Ref so the worker result callback can read pixelSize without being in its deps
  const pixelSizeRef = useRef(1);
  pixelSizeRef.current = pixelSize;

  // ─── Worker ───
  const handleWorkerResult = useCallback(
    (result: ImageData, type: "process" | "thumbnail", alg: AlgorithmId, id: number) => {
      if (type === "process") {
        if (id !== latestProcessIdRef.current) return; // discard stale results
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        if (pixelSizeRef.current > 1) {
          // Scale up the small processed image with nearest-neighbour (pixelated)
          const tmp = document.createElement("canvas");
          tmp.width = result.width;
          tmp.height = result.height;
          tmp.getContext("2d")!.putImageData(result, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.putImageData(result, 0, 0);
        }
        setIsProcessing(false);
      } else {
        setThumbnails((prev) => {
          const tc = document.createElement("canvas");
          tc.width = 80;
          tc.height = 80;
          tc.getContext("2d")!.putImageData(result, 0, 0);
          return { ...prev, [alg]: tc.toDataURL() };
        });
      }
    },
    []
  );

  const { process: workerProcess } = useDitherWorker({ onResult: handleWorkerResult });

  // ─── RF-01: Load image ───
  const handleImageLoad = useCallback((file: File) => {
    setUploadError(null);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      // RF-19: Auto-resize if exceeds MAX_DIMENSION
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);

      setImage({
        file,
        name: file.name,
        element: img,
        originalData: data,
        width: w,
        height: h,
      });
      setCanvasWidth(w);
      setCanvasHeight(h);
      setAspectRatio(w / h);
      setParams({ ...DEFAULT_PARAMS });
      setCommittedParams({ ...DEFAULT_PARAMS });
      setAlgorithm(DEFAULT_ALGORITHM);
      setShowOriginal(false);
      setExportDialog(null);
      srcDataRef.current = null;
    };
    img.src = url;
  }, []);

  // ─── RF-10: Export PNG ───
  const handleExport = useCallback(() => {
    if (!canvasRef.current || !image) return;

    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    const baseName = image.name.replace(/\.[^.]+$/, "");
    const fileName = `${baseName}-dithered.png`;
    link.download = fileName;
    link.href = dataUrl;
    link.click();

    setExportDialog({
      fileName,
      width: canvasWidth,
      height: canvasHeight,
      algorithm,
    });
  }, [image, canvasWidth, canvasHeight, algorithm]);

  // ─── RF-11: Reset all ───
  const handleReset = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
    setCommittedParams({ ...DEFAULT_PARAMS });
    setAlgorithm(DEFAULT_ALGORITHM);
    setPixelSize(1);
    if (image) {
      setCanvasWidth(image.width);
      setCanvasHeight(image.height);
      setAspectRatio(image.width / image.height);
    }
  }, [image]);

  // ─── RF-02: Real-time preview with debounce ───
  useEffect(() => {
    if (!image || !canvasRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Fix: only reset canvas dimensions when they actually change
      if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
      if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d")!;

      if (showOriginal) {
        ctx.drawImage(image.element, 0, 0, canvasWidth, canvasHeight);
        return;
      }

      setIsProcessing(true);

      // Reduce target resolution by pixelSize so each dither dot = pixelSize px
      const targetW = Math.max(1, Math.round(canvasWidth / pixelSize));
      const targetH = Math.max(1, Math.round(canvasHeight / pixelSize));

      // Cache the scaled source ImageData; only rebuild on dimension/image/pixelSize change
      const imageId = image.name + image.width + image.height;
      if (
        !srcDataRef.current ||
        srcDimensionsRef.current.w !== targetW ||
        srcDimensionsRef.current.h !== targetH ||
        srcDimensionsRef.current.imageId !== imageId
      ) {
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = targetW;
        srcCanvas.height = targetH;
        const srcCtx = srcCanvas.getContext("2d")!;
        srcCtx.drawImage(image.element, 0, 0, targetW, targetH);
        srcDataRef.current = srcCtx.getImageData(0, 0, targetW, targetH);
        srcDimensionsRef.current = { w: targetW, h: targetH, imageId };
      }

      const id = workerProcess(srcDataRef.current, params, algorithm, "process");
      latestProcessIdRef.current = id;
    }, DEBOUNCE_BY_ALGORITHM[algorithm]);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [image, params, algorithm, showOriginal, canvasWidth, canvasHeight, pixelSize, workerProcess]);

  // ─── RF-09: Generate thumbnails — only on image load or committed params ───
  useEffect(() => {
    if (!image) return;

    const thumbSize = 80;
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = thumbSize;
    srcCanvas.height = thumbSize;
    const srcCtx = srcCanvas.getContext("2d")!;
    srcCtx.drawImage(image.element, 0, 0, thumbSize, thumbSize);
    const srcData = srcCtx.getImageData(0, 0, thumbSize, thumbSize);

    (Object.keys(ALGORITHMS) as AlgorithmId[]).forEach((key) => {
      workerProcess(srcData, committedParams, key, "thumbnail");
    });
  }, [image, committedParams, workerProcess]);

  // ─── RF-18: Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!image) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault();
        setShowOriginal((v) => !v);
      }
      if (e.code === "Digit1") setAlgorithm("floyd-steinberg");
      if (e.code === "Digit2") setAlgorithm("bayer");
      if (e.code === "Digit3") setAlgorithm("stucki");
      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) {
        handleReset();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        handleExport();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [image, handleReset, handleExport]);

  // ─── RF-08: Canvas resize (always proportional) ───
  const handleWidthChange = useCallback(
    (w: number) => {
      setCanvasWidth(w);
      if (aspectRatio) setCanvasHeight(Math.round(w / aspectRatio));
    },
    [aspectRatio]
  );

  const handleHeightChange = useCallback(
    (h: number) => {
      setCanvasHeight(h);
      if (aspectRatio) setCanvasWidth(Math.round(h * aspectRatio));
    },
    [aspectRatio]
  );

  const handleNewImage = useCallback(() => {
    setImage(null);
    setExportDialog(null);
    setThumbnails({});
    setParams({ ...DEFAULT_PARAMS });
    setCommittedParams({ ...DEFAULT_PARAMS });
    setAlgorithm(DEFAULT_ALGORITHM);
    setPixelSize(1);
    srcDataRef.current = null;
  }, []);

  const handleParamChange = useCallback(
    <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleParamCommit = useCallback(
    <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => {
      setCommittedParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ─── Render ───
  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden font-mono">
      <Header
        hasImage={!!image}
        showOriginal={showOriginal}
        onToggleOriginal={() => setShowOriginal((v) => !v)}
        onNewImage={handleNewImage}
        onReset={handleReset}
        onExport={handleExport}
      />

      {!image ? (
        <UploadScreen
          onImageLoad={handleImageLoad}
          onError={setUploadError}
          error={uploadError}
        />
      ) : (
        <div className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : ""}`}>
          {!isMobile && (
            <Sidebar
              params={params}
              algorithm={algorithm}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              pixelSize={pixelSize}
              thumbnails={thumbnails}
              onParamChange={handleParamChange}
              onParamCommit={handleParamCommit}
              onAlgorithmChange={setAlgorithm}
              onWidthChange={handleWidthChange}
              onHeightChange={handleHeightChange}
              onPixelSizeChange={setPixelSize}
            />
          )}

          <PreviewCanvas
            ref={canvasRef}
            showOriginal={showOriginal}
            isProcessing={isProcessing}
          />

          {isMobile && (
            <Sidebar
              params={params}
              algorithm={algorithm}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              pixelSize={pixelSize}
              thumbnails={thumbnails}
              onParamChange={handleParamChange}
              onParamCommit={handleParamCommit}
              onAlgorithmChange={setAlgorithm}
              onWidthChange={handleWidthChange}
              onHeightChange={handleHeightChange}
              onPixelSizeChange={setPixelSize}
              isMobile
              onReset={handleReset}
              onExport={handleExport}
            />
          )}
        </div>
      )}

      {exportDialog && (
        <ExportSuccess
          info={exportDialog}
          onNewImage={handleNewImage}
          onContinue={() => setExportDialog(null)}
        />
      )}
    </div>
  );
}
