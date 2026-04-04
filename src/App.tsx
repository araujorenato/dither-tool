import { useState, useRef, useCallback, useEffect } from "react";
import { Header } from "@/components/header";
import { UploadScreen } from "@/components/upload-screen";
import { Sidebar } from "@/components/sidebar";
import { PreviewCanvas } from "@/components/preview-canvas";
import { ExportSuccess } from "@/components/export-success";
import { useDitherWorker } from "@/hooks/use-dither-worker";
import { useWebGLDither } from "@/hooks/use-webgl-dither";
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

export default function App() {
  // ─── State ───
  const [image, setImage]                       = useState<LoadedImage | null>(null);
  const [params, setParams]                     = useState<ImageParams>({ ...DEFAULT_PARAMS });
  const [committedParams, setCommittedParams]   = useState<ImageParams>({ ...DEFAULT_PARAMS });
  const [algorithm, setAlgorithm]               = useState<AlgorithmId>(DEFAULT_ALGORITHM);
  const [showOriginal, setShowOriginal]         = useState(false);
  const [exportDialog, setExportDialog]         = useState<ExportInfo | null>(null);
  const [uploadError, setUploadError]           = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth]           = useState(0);
  const [canvasHeight, setCanvasHeight]         = useState(0);
  const [aspectRatio, setAspectRatio]           = useState(1);
  const [thumbnails, setThumbnails]             = useState<Record<string, string>>({});
  const [pixelSize, setPixelSize]               = useState(1);

  const isMobile = useIsMobile();

  // ─── WebGL renderer ───
  const {
    canvasRef,
    loadImage:        glLoadImage,
    setCanvasSize:    glSetCanvasSize,
    setParams:        glSetParams,
    setAlgorithm:     glSetAlgorithm,
    setPixelSize:     glSetPixelSize,
    setShowOriginal:  glSetShowOriginal,
    displayFrame,
    exportDataUrl,
  } = useWebGLDither();

  // True when the active algorithm must be computed on CPU (error diffusion)
  const isCpuAlgorithm = algorithm === "floyd-steinberg" || algorithm === "stucki";

  // Ref so the canvas-size effect doesn't fire on the initial 0→w transition
  // when triggered by the same batch as the image load
  const imageLoadedRef = useRef(false);

  // Full-res ImageData at the current canvas dimensions — fed to CPU worker for FS/Stucki
  const srcImageDataRef = useRef<ImageData | null>(null);
  // Latest CPU job id — used to discard stale worker responses
  const latestCpuJobIdRef = useRef<number>(-1);

  // ─── Sync state → WebGL (each fires at most once per render batch) ────────

  // New image: upload texture + set initial canvas dimensions
  useEffect(() => {
    if (!image) return;
    imageLoadedRef.current = true;
    glLoadImage(image.element, canvasWidth, canvasHeight);
    // canvasWidth/canvasHeight are correct here because handleImageLoad sets
    // all three in one synchronous call and React 18 batches them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  // Canvas resize: update viewport (skip before first image load)
  useEffect(() => {
    if (!imageLoadedRef.current || canvasWidth === 0 || canvasHeight === 0) return;
    glSetCanvasSize(canvasWidth, canvasHeight);
  }, [canvasWidth, canvasHeight, glSetCanvasSize]);

  // Live params only flow to WebGL when on Bayer; CPU algorithms ignore live drag
  useEffect(() => {
    if (!isCpuAlgorithm) glSetParams(params);
  }, [params, isCpuAlgorithm, glSetParams]);
  useEffect(() => { glSetAlgorithm(algorithm);     }, [algorithm,    glSetAlgorithm]);
  useEffect(() => { glSetPixelSize(pixelSize);     }, [pixelSize,    glSetPixelSize]);
  useEffect(() => { glSetShowOriginal(showOriginal);}, [showOriginal, glSetShowOriginal]);

  // ─── Worker (CPU) — thumbnails + full-res FS/Stucki ─────────────────────
  const handleWorkerResult = useCallback(
    (result: ImageData, type: "process" | "thumbnail", alg: AlgorithmId, id: number) => {
      if (type === "thumbnail") {
        setThumbnails((prev) => {
          const tc = document.createElement("canvas");
          tc.width  = 80;
          tc.height = 80;
          tc.getContext("2d")!.putImageData(result, 0, 0);
          return { ...prev, [alg]: tc.toDataURL() };
        });
        return;
      }
      // Full-res CPU frame — discard stale responses
      if (id !== latestCpuJobIdRef.current) return;
      const isCpu = alg === "floyd-steinberg" || alg === "stucki";
      if (!isCpu) return;
      displayFrame(result);
    },
    [displayFrame]
  );

  const { process: workerProcess } = useDitherWorker({ onResult: handleWorkerResult });

  // Thumbnail generation (80×80, all algorithms)
  useEffect(() => {
    if (!image) return;
    const thumbSize = 80;
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width  = thumbSize;
    srcCanvas.height = thumbSize;
    const ctx = srcCanvas.getContext("2d")!;
    ctx.drawImage(image.element, 0, 0, thumbSize, thumbSize);
    const srcData = ctx.getImageData(0, 0, thumbSize, thumbSize);

    (Object.keys(ALGORITHMS) as AlgorithmId[]).forEach((key) => {
      workerProcess(srcData, committedParams, key, "thumbnail");
    });
  }, [image, committedParams, workerProcess]);

  // Populate srcImageDataRef scaled by pixelSize — smaller image yields pixelated result via NEAREST upscale
  useEffect(() => {
    if (!image || canvasWidth === 0 || canvasHeight === 0) return;
    const w = Math.max(1, Math.round(canvasWidth  / pixelSize));
    const h = Math.max(1, Math.round(canvasHeight / pixelSize));
    const offscreen = document.createElement("canvas");
    offscreen.width  = w;
    offscreen.height = h;
    offscreen.getContext("2d")!.drawImage(image.element, 0, 0, w, h);
    srcImageDataRef.current = offscreen.getContext("2d")!.getImageData(0, 0, w, h);
  }, [image, canvasWidth, canvasHeight, pixelSize]);

  // Route FS/Stucki to CPU worker; Bayer resumes WebGL shader
  useEffect(() => {
    if (!image || !srcImageDataRef.current) return;
    if (isCpuAlgorithm) {
      const id = workerProcess(srcImageDataRef.current, committedParams, algorithm, "process");
      latestCpuJobIdRef.current = id;
    } else {
      displayFrame(null);
    }
  }, [image, algorithm, committedParams, canvasWidth, canvasHeight, pixelSize, isCpuAlgorithm, workerProcess, displayFrame]);

  // ─── RF-01: Load image ────────────────────────────────────────────────────
  const handleImageLoad = useCallback((file: File) => {
    setUploadError(null);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      // Default canvas size: at most 600px on either side
      const DEFAULT_CANVAS_SIZE = 600;
      if (w > DEFAULT_CANVAS_SIZE || h > DEFAULT_CANVAS_SIZE) {
        const scale = Math.min(DEFAULT_CANVAS_SIZE / w, DEFAULT_CANVAS_SIZE / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      setImage({
        file,
        name:    file.name,
        element: img,
        width:   w,
        height:  h,
      });
      setCanvasWidth(w);
      setCanvasHeight(h);
      setAspectRatio(w / h);
      setParams({ ...DEFAULT_PARAMS });
      setCommittedParams({ ...DEFAULT_PARAMS });
      setAlgorithm(DEFAULT_ALGORITHM);
      setPixelSize(1);
      setShowOriginal(false);
      setExportDialog(null);
    };
    img.src = url;
  }, []);

  // ─── RF-10: Export PNG ────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!image) return;
    const dataUrl = exportDataUrl("image/png");
    if (!dataUrl) return;

    const link      = document.createElement("a");
    const baseName  = image.name.replace(/\.[^.]+$/, "");
    const fileName  = `${baseName}-dithered.png`;
    link.download   = fileName;
    link.href       = dataUrl;
    link.click();

    setExportDialog({ fileName, width: canvasWidth, height: canvasHeight, algorithm });
  }, [image, canvasWidth, canvasHeight, algorithm, exportDataUrl]);

  // ─── RF-11: Reset all ─────────────────────────────────────────────────────
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

  // ─── RF-18: Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!image) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.code === "Space") { e.preventDefault(); setShowOriginal((v) => !v); }
      if (e.code === "Digit1") setAlgorithm("floyd-steinberg");
      if (e.code === "Digit2") setAlgorithm("bayer");
      if (e.code === "Digit3") setAlgorithm("stucki");
      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) handleReset();
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [image, handleReset, handleExport]);

  // ─── RF-08: Canvas resize (locked aspect ratio) ───────────────────────────
  const handleWidthChange = useCallback((w: number) => {
    setCanvasWidth(w);
    if (aspectRatio) setCanvasHeight(Math.round(w / aspectRatio));
  }, [aspectRatio]);

  const handleHeightChange = useCallback((h: number) => {
    setCanvasHeight(h);
    if (aspectRatio) setCanvasWidth(Math.round(h * aspectRatio));
  }, [aspectRatio]);

  const handleNewImage = useCallback(() => {
    imageLoadedRef.current = false;
    setImage(null);
    setExportDialog(null);
    setThumbnails({});
    setParams({ ...DEFAULT_PARAMS });
    setCommittedParams({ ...DEFAULT_PARAMS });
    setAlgorithm(DEFAULT_ALGORITHM);
    setPixelSize(1);
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

  // ─── Render ───────────────────────────────────────────────────────────────
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
