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
  AnimationFrame,
} from "@/lib/types";

export default function App() {
  // ─── Frame state ──────────────────────────────────────────────────────────
  const [frames, setFrames]                       = useState<AnimationFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying]                 = useState(false);
  const [animationDelay, setAnimationDelay]       = useState(1.00); // seconds per frame
  const [animationMode, setAnimationMode]         = useState<"normal" | "ping-pong">("normal");

  // ─── Global state ─────────────────────────────────────────────────────────
  const [showOriginal, setShowOriginal]   = useState(false);
  const [exportDialog, setExportDialog]   = useState<ExportInfo | null>(null);
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth]     = useState(0);
  const [canvasHeight, setCanvasHeight]   = useState(0);
  const [aspectRatio, setAspectRatio]     = useState(1);
  const [thumbnails, setThumbnails]       = useState<Record<string, string>>({});

  const isMobile = useIsMobile();

  // ─── Derived current-frame values ─────────────────────────────────────────
  const currentFrame        = frames[currentFrameIndex] ?? null;
  const currentImage        = currentFrame?.image        ?? null;
  const currentParams       = currentFrame?.params       ?? DEFAULT_PARAMS;
  const currentCommitted    = currentFrame?.committedParams ?? DEFAULT_PARAMS;
  const currentAlgorithm    = currentFrame?.algorithm    ?? DEFAULT_ALGORITHM;
  const currentPixelSize    = currentFrame?.pixelSize    ?? 1;
  const isCpuAlgorithm      = currentAlgorithm === "floyd-steinberg" || currentAlgorithm === "stucki";

  // ─── Stable refs ──────────────────────────────────────────────────────────
  const imageLoadedRef        = useRef(false);
  const srcImageDataRef       = useRef<ImageData | null>(null);
  const latestCpuJobIdRef     = useRef<number>(-1);
  const currentFrameIndexRef  = useRef(currentFrameIndex);
  const framesRef             = useRef(frames);
  const framesLengthRef       = useRef(frames.length);
  const playbackTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationModeRef      = useRef(animationMode);
  const pingPongDirRef        = useRef<1 | -1>(1);

  currentFrameIndexRef.current = currentFrameIndex;
  framesRef.current            = frames;
  framesLengthRef.current      = frames.length;
  animationModeRef.current     = animationMode;

  // ─── WebGL renderer ───────────────────────────────────────────────────────
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

  // ─── Sync state → WebGL ───────────────────────────────────────────────────

  useEffect(() => {
    if (!currentImage) return;
    imageLoadedRef.current = true;
    glLoadImage(currentImage.element, canvasWidth, canvasHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImage]);

  useEffect(() => {
    if (!imageLoadedRef.current || canvasWidth === 0 || canvasHeight === 0) return;
    glSetCanvasSize(canvasWidth, canvasHeight);
  }, [canvasWidth, canvasHeight, glSetCanvasSize]);

  useEffect(() => {
    if (!isCpuAlgorithm) glSetParams(currentParams);
  }, [currentParams, isCpuAlgorithm, glSetParams]);

  useEffect(() => { glSetAlgorithm(currentAlgorithm);    }, [currentAlgorithm,  glSetAlgorithm]);
  useEffect(() => { glSetPixelSize(currentPixelSize);    }, [currentPixelSize,  glSetPixelSize]);
  useEffect(() => { glSetShowOriginal(showOriginal);     }, [showOriginal,       glSetShowOriginal]);

  // ─── Worker result handler ────────────────────────────────────────────────
  const handleWorkerResult = useCallback(
    (result: ImageData, type: "process" | "thumbnail", alg: AlgorithmId, id: number, frameIndex?: number) => {
      if (type === "thumbnail") {
        if (frameIndex !== undefined) {
          // Frame strip thumbnail (64×64)
          const tc = document.createElement("canvas");
          tc.width  = 64;
          tc.height = 64;
          tc.getContext("2d")!.putImageData(result, 0, 0);
          const url = tc.toDataURL();
          setFrames(prev => prev.map((f, i) => i === frameIndex ? { ...f, thumbnailUrl: url } : f));
        } else {
          // Algorithm card thumbnail (80×80)
          setThumbnails((prev) => {
            const tc = document.createElement("canvas");
            tc.width  = 80;
            tc.height = 80;
            tc.getContext("2d")!.putImageData(result, 0, 0);
            return { ...prev, [alg]: tc.toDataURL() };
          });
        }
        return;
      }

      // Full-res CPU frame — discard stale responses
      if (id !== latestCpuJobIdRef.current) return;
      const isCpu = alg === "floyd-steinberg" || alg === "stucki";
      if (!isCpu) return;

      if (frameIndex !== undefined) {
        // Generate 64×64 thumbnail from the processed result and cache both
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width  = result.width;
        srcCanvas.height = result.height;
        srcCanvas.getContext("2d")!.putImageData(result, 0, 0);
        const tc = document.createElement("canvas");
        tc.width  = 64;
        tc.height = 64;
        tc.getContext("2d")!.drawImage(srcCanvas, 0, 0, 64, 64);
        const thumbnailUrl = tc.toDataURL();

        setFrames(prev => prev.map((f, i) =>
          i === frameIndex ? { ...f, processedData: result, thumbnailUrl } : f
        ));
      }

      // Only display if this is still the current frame
      if (frameIndex === currentFrameIndexRef.current) {
        displayFrame(result);
      }
    },
    [displayFrame]
  );

  const { process: workerProcess } = useDitherWorker({ onResult: handleWorkerResult });

  // ─── Rebuild srcImageDataRef ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentImage || canvasWidth === 0 || canvasHeight === 0) return;
    const w = Math.max(1, Math.round(canvasWidth  / currentPixelSize));
    const h = Math.max(1, Math.round(canvasHeight / currentPixelSize));
    const offscreen = document.createElement("canvas");
    offscreen.width  = w;
    offscreen.height = h;
    offscreen.getContext("2d")!.drawImage(currentImage.element, 0, 0, w, h);
    srcImageDataRef.current = offscreen.getContext("2d")!.getImageData(0, 0, w, h);
  }, [currentImage, canvasWidth, canvasHeight, currentPixelSize]);

  // ─── Route to rendering path ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentImage || !srcImageDataRef.current) return;

    if (isCpuAlgorithm) {
      // Use cached result if available (e.g. switching frames during playback)
      const cached = framesRef.current[currentFrameIndexRef.current]?.processedData;
      if (cached) {
        displayFrame(cached);
        return;
      }
      const id = workerProcess(srcImageDataRef.current, currentCommitted, currentAlgorithm, "process", currentFrameIndex);
      latestCpuJobIdRef.current = id;
    } else {
      displayFrame(null); // Bayer: WebGL GPU path
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImage, currentAlgorithm, currentCommitted, canvasWidth, canvasHeight, currentPixelSize, currentFrameIndex, isCpuAlgorithm, workerProcess, displayFrame]);

  // ─── Algorithm card thumbnails (80×80) ───────────────────────────────────
  useEffect(() => {
    if (!currentImage || isPlaying) return;
    const thumbSize = 80;
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width  = thumbSize;
    srcCanvas.height = thumbSize;
    srcCanvas.getContext("2d")!.drawImage(currentImage.element, 0, 0, thumbSize, thumbSize);
    const srcData = srcCanvas.getContext("2d")!.getImageData(0, 0, thumbSize, thumbSize);
    (Object.keys(ALGORITHMS) as AlgorithmId[]).forEach((key) => {
      workerProcess(srcData, currentCommitted, key, "thumbnail");
    });
  }, [currentImage, currentCommitted, isPlaying, workerProcess]);

  // ─── Frame strip thumbnails (64×64) ──────────────────────────────────────
  useEffect(() => {
    if (!currentImage || isPlaying) return;
    // Only generate if missing (read via ref to avoid dep loop)
    if (framesRef.current[currentFrameIndex]?.thumbnailUrl) return;

    const thumbSize = 64;
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width  = thumbSize;
    srcCanvas.height = thumbSize;
    srcCanvas.getContext("2d")!.drawImage(currentImage.element, 0, 0, thumbSize, thumbSize);
    const srcData = srcCanvas.getContext("2d")!.getImageData(0, 0, thumbSize, thumbSize);
    workerProcess(srcData, currentCommitted, currentAlgorithm, "thumbnail", currentFrameIndex);
  }, [currentImage, currentCommitted, currentAlgorithm, currentFrameIndex, isPlaying, workerProcess]);

  // ─── Animation playback ───────────────────────────────────────────────────
  // Reset ping-pong direction when mode changes or playback stops
  useEffect(() => { pingPongDirRef.current = 1; }, [animationMode, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
      return;
    }
    const advance = () => {
      if (animationModeRef.current === "ping-pong") {
        // Read state from refs to avoid ref-mutation inside a functional updater
        // (React StrictMode double-invokes functional updaters, which would corrupt
        // pingPongDirRef if the mutation happened inside one)
        const len  = framesLengthRef.current;
        const prev = currentFrameIndexRef.current;
        const dir  = pingPongDirRef.current;
        const next = prev + dir;

        let nextIndex: number;
        if (next >= len - 1) {
          pingPongDirRef.current = -1;
          nextIndex = len - 1;
        } else if (next <= 0) {
          pingPongDirRef.current = 1;
          nextIndex = 0;
        } else {
          nextIndex = next;
        }
        setCurrentFrameIndex(nextIndex);
      } else {
        setCurrentFrameIndex(prev => (prev + 1) % framesLengthRef.current);
      }
      playbackTimerRef.current = setTimeout(advance, animationDelay * 1000);
    };
    playbackTimerRef.current = setTimeout(advance, animationDelay * 1000);
    return () => { if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current); };
  }, [isPlaying, animationDelay]);

  // ─── Frame operations ─────────────────────────────────────────────────────
  const addFrame = useCallback(() => {
    const newIndex = framesRef.current.length;
    setFrames(prev => {
      const last = prev[prev.length - 1];
      return [...prev, {
        id: crypto.randomUUID(),
        image: last.image,
        params: { ...last.params },
        committedParams: { ...last.committedParams },
        algorithm: last.algorithm,
        pixelSize: last.pixelSize,
        processedData: null,
        thumbnailUrl: null,
      }];
    });
    setCurrentFrameIndex(newIndex);
  }, []);

  const selectFrame = useCallback((index: number) => {
    if (isPlaying) return;
    setCurrentFrameIndex(index);
  }, [isPlaying]);

  const deleteFrame = useCallback((index: number) => {
    if (framesRef.current.length <= 1) return;
    if (framesRef.current.length <= 2) setIsPlaying(false);
    setFrames(prev => prev.filter((_, i) => i !== index));
    setCurrentFrameIndex(prev => {
      const newLen = framesRef.current.length - 1;
      if (index < prev) return prev - 1;
      if (index === prev) return Math.min(prev, newLen - 1);
      return prev;
    });
  }, []);

  const replaceFrameImage = useCallback((index: number, file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const loadedImage: LoadedImage = {
        file,
        name: file.name,
        element: img,
        width: img.width,
        height: img.height,
      };
      setFrames(prev => prev.map((f, i) =>
        i === index ? { ...f, image: loadedImage, processedData: null, thumbnailUrl: null } : f
      ));
    };
    img.src = url;
  }, []);

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

      const DEFAULT_CANVAS_SIZE = 600;
      if (w > DEFAULT_CANVAS_SIZE || h > DEFAULT_CANVAS_SIZE) {
        const scale = Math.min(DEFAULT_CANVAS_SIZE / w, DEFAULT_CANVAS_SIZE / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const loadedImage: LoadedImage = { file, name: file.name, element: img, width: w, height: h };

      setCanvasWidth(w);
      setCanvasHeight(h);
      setAspectRatio(w / h);
      setShowOriginal(false);
      setExportDialog(null);
      setIsPlaying(false);
      setCurrentFrameIndex(0);
      setFrames([{
        id: crypto.randomUUID(),
        image: loadedImage,
        params: { ...DEFAULT_PARAMS },
        committedParams: { ...DEFAULT_PARAMS },
        algorithm: DEFAULT_ALGORITHM,
        pixelSize: 1,
        processedData: null,
        thumbnailUrl: null,
      }]);
    };
    img.src = url;
  }, []);

  // ─── RF-10: Export PNG ────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!currentImage) return;
    const dataUrl = exportDataUrl("image/png");
    if (!dataUrl) return;

    const link     = document.createElement("a");
    const baseName = currentImage.name.replace(/\.[^.]+$/, "");
    const fileName = `${baseName}-dithered.png`;
    link.download  = fileName;
    link.href      = dataUrl;
    link.click();

    setExportDialog({ fileName, width: canvasWidth, height: canvasHeight, algorithm: currentAlgorithm });
  }, [currentImage, canvasWidth, canvasHeight, currentAlgorithm, exportDataUrl]);

  // ─── RF-11: Reset current frame ───────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFrames(prev => prev.map((f, i) => i === currentFrameIndex
      ? {
          ...f,
          params: { ...DEFAULT_PARAMS },
          committedParams: { ...DEFAULT_PARAMS },
          algorithm: DEFAULT_ALGORITHM,
          pixelSize: 1,
          processedData: null,
          thumbnailUrl: null,
        }
      : f
    ));
  }, [currentFrameIndex]);

  // ─── RF-18: Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentImage) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.code === "Space") { e.preventDefault(); setShowOriginal((v) => !v); }
      if (e.code === "Digit1") {
        setFrames(prev => prev.map((f, i) => i === currentFrameIndexRef.current
          ? { ...f, algorithm: "floyd-steinberg", processedData: null } : f));
      }
      if (e.code === "Digit2") {
        setFrames(prev => prev.map((f, i) => i === currentFrameIndexRef.current
          ? { ...f, algorithm: "bayer", processedData: null } : f));
      }
      if (e.code === "Digit3") {
        setFrames(prev => prev.map((f, i) => i === currentFrameIndexRef.current
          ? { ...f, algorithm: "stucki", processedData: null } : f));
      }
      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) handleReset();
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentImage, handleReset, handleExport]);

  // ─── RF-08: Canvas resize (locked aspect ratio) ───────────────────────────
  const handleWidthChange = useCallback((w: number) => {
    setCanvasWidth(w);
    if (aspectRatio) setCanvasHeight(Math.round(w / aspectRatio));
    // Invalidate processedData for all frames (canvas size changed)
    setFrames(prev => prev.map(f => ({ ...f, processedData: null })));
  }, [aspectRatio]);

  const handleHeightChange = useCallback((h: number) => {
    setCanvasHeight(h);
    if (aspectRatio) setCanvasWidth(Math.round(h * aspectRatio));
    setFrames(prev => prev.map(f => ({ ...f, processedData: null })));
  }, [aspectRatio]);

  const handleNewImage = useCallback(() => {
    imageLoadedRef.current = false;
    setFrames([]);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setExportDialog(null);
    setThumbnails({});
    setShowOriginal(false);
  }, []);

  const handleParamChange = useCallback(
    <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => {
      setFrames(prev => prev.map((f, i) =>
        i === currentFrameIndexRef.current ? { ...f, params: { ...f.params, [key]: value } } : f
      ));
    },
    []
  );

  const handleParamCommit = useCallback(
    <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => {
      setFrames(prev => prev.map((f, i) =>
        i === currentFrameIndexRef.current
          ? { ...f, committedParams: { ...f.committedParams, [key]: value }, processedData: null }
          : f
      ));
    },
    []
  );

  const handleAlgorithmChange = useCallback((alg: AlgorithmId) => {
    setFrames(prev => prev.map((f, i) =>
      i === currentFrameIndexRef.current ? { ...f, algorithm: alg, processedData: null } : f
    ));
  }, []);

  const handlePixelSizeChange = useCallback((px: number) => {
    setFrames(prev => prev.map((f, i) =>
      i === currentFrameIndexRef.current ? { ...f, pixelSize: px, processedData: null } : f
    ));
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden font-mono">
      <Header
        hasImage={!!currentImage}
        showOriginal={showOriginal}
        onToggleOriginal={() => setShowOriginal((v) => !v)}
        onNewImage={handleNewImage}
        onReset={handleReset}
        onExport={handleExport}
      />

      {!currentImage ? (
        <UploadScreen
          onImageLoad={handleImageLoad}
          onError={setUploadError}
          error={uploadError}
        />
      ) : (
        <div className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : ""}`}>
          {!isMobile && (
            <Sidebar
              params={currentParams}
              algorithm={currentAlgorithm}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              pixelSize={currentPixelSize}
              thumbnails={thumbnails}
              onParamChange={handleParamChange}
              onParamCommit={handleParamCommit}
              onAlgorithmChange={handleAlgorithmChange}
              onWidthChange={handleWidthChange}
              onHeightChange={handleHeightChange}
              onPixelSizeChange={handlePixelSizeChange}
            />
          )}

          <PreviewCanvas
            ref={canvasRef}
            showOriginal={showOriginal}
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            isPlaying={isPlaying}
            animationDelay={animationDelay}
            onSelectFrame={selectFrame}
            onAddFrame={addFrame}
            onReplaceFrameImage={replaceFrameImage}
            onDeleteFrame={deleteFrame}
            onTogglePlay={() => setIsPlaying(v => !v)}
            onDelayChange={setAnimationDelay}
            animationMode={animationMode}
            onToggleAnimationMode={() => setAnimationMode(m => m === "normal" ? "ping-pong" : "normal")}
          />

          {isMobile && (
            <Sidebar
              params={currentParams}
              algorithm={currentAlgorithm}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              pixelSize={currentPixelSize}
              thumbnails={thumbnails}
              onParamChange={handleParamChange}
              onParamCommit={handleParamCommit}
              onAlgorithmChange={handleAlgorithmChange}
              onWidthChange={handleWidthChange}
              onHeightChange={handleHeightChange}
              onPixelSizeChange={handlePixelSizeChange}
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
