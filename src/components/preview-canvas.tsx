import { forwardRef, useRef, useState, useCallback, useEffect } from "react";
import { Play, Pause, Plus } from "lucide-react";
import type { AnimationFrame } from "@/lib/types";

interface PreviewCanvasProps {
  showOriginal: boolean;
  frames: AnimationFrame[];
  currentFrameIndex: number;
  isPlaying: boolean;
  animationDelay: number;
  animationMode: "normal" | "ping-pong";
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onReplaceFrameImage: (index: number, file: File) => void;
  onDeleteFrame: (index: number) => void;
  onTogglePlay: () => void;
  onDelayChange: (delay: number) => void;
  onToggleAnimationMode: () => void;
}

export const PreviewCanvas = forwardRef<HTMLCanvasElement, PreviewCanvasProps>(
  ({
    showOriginal,
    frames,
    currentFrameIndex,
    isPlaying,
    animationDelay,
    animationMode,
    onSelectFrame,
    onAddFrame,
    onReplaceFrameImage,
    onDeleteFrame,
    onTogglePlay,
    onDelayChange,
    onToggleAnimationMode,
  }, ref) => {
    const containerRef    = useRef<HTMLElement>(null);
    const fileInputRef    = useRef<HTMLInputElement>(null);
    const replaceTargetRef = useRef<number>(-1);

    // Zoom & pan state
    const [zoom, setZoom]       = useState(1);
    const [pan, setPan]         = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Dropdown: which frame index is open + where to paint it
    const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
    const [dropdownPos, setDropdownPos]             = useState<{ left: number; top: number } | null>(null);

    const zoomRef       = useRef(1);
    const panRef        = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragAnchorRef = useRef({ x: 0, y: 0 });

    const applyZoom = useCallback((z: number, px: number, py: number) => {
      zoomRef.current  = z;
      panRef.current   = { x: px, y: py };
      setZoom(z);
      setPan({ x: px, y: py });
    }, []);

    const resetView = useCallback(() => applyZoom(1, 0, 0), [applyZoom]);

    const closeDropdown = useCallback(() => {
      setOpenDropdownIndex(null);
      setDropdownPos(null);
    }, []);

    // Close dropdown on outside mousedown
    useEffect(() => {
      if (openDropdownIndex === null) return;
      document.addEventListener("mousedown", closeDropdown);
      return () => document.removeEventListener("mousedown", closeDropdown);
    }, [openDropdownIndex, closeDropdown]);

    // Non-passive wheel listener
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left  - rect.width  / 2;
        const my = e.clientY - rect.top   - rect.height / 2;
        const z  = zoomRef.current;
        const p  = panRef.current;

        if (e.ctrlKey || e.metaKey) {
          const factor  = e.deltaY < 0 ? 1.02 : 1 / 1.02;
          const newZoom = Math.max(1, Math.min(8, z * factor));
          if (newZoom <= 1) {
            applyZoom(1, 0, 0);
          } else {
            const scale = newZoom / z;
            applyZoom(
              newZoom,
              mx - (mx - p.x) * scale,
              my - (my - p.y) * scale,
            );
          }
        } else if (z > 1) {
          const np = { x: p.x - e.deltaX, y: p.y - e.deltaY };
          panRef.current = np;
          setPan(np);
        }
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [applyZoom]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
      if (e.button !== 0 || zoomRef.current <= 1) return;
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      dragAnchorRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      const np = {
        x: e.clientX - dragAnchorRef.current.x,
        y: e.clientY - dragAnchorRef.current.y,
      };
      panRef.current = np;
      setPan(np);
    }, []);

    const onMouseUp = useCallback(() => {
      isDraggingRef.current = false;
      setIsDragging(false);
    }, []);

    const handleFrameClick = useCallback((index: number, e: React.MouseEvent<HTMLButtonElement>) => {
      if (index === currentFrameIndex) {
        // Position dropdown relative to <main> so it escapes the overflow-x:auto container
        const btnRect  = e.currentTarget.getBoundingClientRect();
        const mainRect = (containerRef.current as HTMLElement).getBoundingClientRect();
        const pos = { left: btnRect.left - mainRect.left, top: btnRect.bottom - mainRect.top + 4 };
        setDropdownPos(pos);
        setOpenDropdownIndex(prev => prev === index ? null : index);
      } else {
        onSelectFrame(index);
        closeDropdown();
      }
    }, [currentFrameIndex, onSelectFrame, closeDropdown]);

    const handleNewImage = useCallback((index: number) => {
      replaceTargetRef.current = index;
      closeDropdown();
      fileInputRef.current?.click();
    }, [closeDropdown]);

    const handleDeleteFrame = useCallback((index: number) => {
      closeDropdown();
      onDeleteFrame(index);
    }, [closeDropdown, onDeleteFrame]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && replaceTargetRef.current >= 0) {
        onReplaceFrameImage(replaceTargetRef.current, file);
      }
      e.target.value = "";
    }, [onReplaceFrameImage]);

    const handleDelayInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) onDelayChange(val);
    }, [onDelayChange]);

    const cursor    = isDragging ? "grabbing" : zoom > 1 ? "grab" : "default";
    const isPingPong = animationMode === "ping-pong";

    return (
      <main
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="flex-1 min-h-0 flex items-center justify-center bg-neutral-950 relative overflow-hidden select-none"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={resetView}
      >
        {/* Subtle dot grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Zoomable/pannable canvas wrapper */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center",
          }}
        >
          <canvas
            ref={ref}
            className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-sm block"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* ── Frame strip + playback controls ── */}
        <div
          className="absolute top-2 left-2 right-2 flex items-center gap-1.5 z-10"
          onMouseDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        >
          {/* Frame thumbnails (scrollable) */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {frames.map((frame, index) => {
              const isSelected = index === currentFrameIndex;
              return (
                <button
                  key={frame.id}
                  onClick={e => handleFrameClick(index, e)}
                  title={isSelected ? "Opções do frame" : `Frame ${index + 1}`}
                  className={[
                    "relative flex-shrink-0 w-16 h-16 rounded overflow-hidden flex items-center justify-center",
                    "transition-all duration-100 bg-neutral-800",
                    isSelected
                      ? "border-[4px] border-white"
                      : "border border-white/15 hover:border-white/35",
                  ].join(" ")}
                >
                  {frame.thumbnailUrl ? (
                    <img
                      src={frame.thumbnailUrl}
                      alt={`Frame ${index + 1}`}
                      className="w-full h-full object-cover"
                      style={{ imageRendering: "pixelated" }}
                    />
                  ) : (
                    <div className="w-3 h-3 border border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[8px] text-white/50 font-mono leading-none pointer-events-none">
                    {index + 1}
                  </span>
                </button>
              );
            })}

            {/* Add frame button */}
            <button
              onClick={onAddFrame}
              title="Adicionar frame"
              className="flex-shrink-0 w-16 h-16 rounded border border-dashed border-white/20 hover:border-white/40 bg-neutral-900/60 hover:bg-neutral-800/60 transition-colors flex items-center justify-center"
            >
              <Plus className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Playback controls */}
          <div
            className="flex items-center gap-2.5 bg-black/50 backdrop-blur-sm rounded px-2.5 py-1.5 border border-white/10"
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={onTogglePlay}
              disabled={frames.length < 2}
              title={isPlaying ? "Pausar" : "Reproduzir"}
              className="text-neutral-300 hover:text-white disabled:text-neutral-600 transition-colors"
            >
              {isPlaying
                ? <Pause className="w-3.5 h-3.5" />
                : <Play  className="w-3.5 h-3.5" />
              }
            </button>

            <div className="flex items-center gap-1">
              <input
                type="number"
                value={animationDelay.toFixed(2)}
                min="0.01"
                step="0.01"
                onChange={handleDelayInput}
                className="w-14 bg-transparent text-neutral-300 text-[11px] font-mono text-right outline-none border-b border-white/20 focus:border-white/50 pb-px"
              />
              <span className="text-[10px] text-neutral-500 font-mono">s/f</span>
            </div>

            <div className="w-px h-3.5 bg-white/15" />

            {/* Ping-pong switch */}
            <label
              className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono cursor-pointer select-none"
              title="Ping pong mode"
            >
              <span>Ping pong</span>
              <button
                role="switch"
                aria-checked={isPingPong}
                onClick={onToggleAnimationMode}
                className={[
                  "w-7 h-[15px] rounded-full transition-colors flex items-center px-0.5",
                  isPingPong ? "bg-white/80" : "bg-neutral-600",
                ].join(" ")}
              >
                <span className={[
                  "block w-[11px] h-[11px] rounded-full bg-white shadow transition-transform",
                  isPingPong ? "translate-x-3" : "translate-x-0",
                ].join(" ")} />
              </button>
            </label>
          </div>
        </div>

        {/* ── Context dropdown — rendered outside the scroll container ── */}
        {openDropdownIndex !== null && dropdownPos && (
          <div
            className="absolute z-30 bg-neutral-900 border border-white/15 rounded shadow-xl overflow-hidden min-w-[132px]"
            style={{ left: dropdownPos.left, top: dropdownPos.top }}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={() => handleNewImage(openDropdownIndex)}
              className="w-full text-left px-3 py-2 text-[11px] font-mono text-neutral-200 hover:bg-white/10 transition-colors"
            >
              Nova imagem
            </button>
            <button
              onClick={() => handleDeleteFrame(openDropdownIndex)}
              disabled={frames.length <= 1}
              className="w-full text-left px-3 py-2 text-[11px] font-mono text-red-400 hover:bg-white/10 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
            >
              Excluir frame
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* "Original" badge */}
        {showOriginal && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm pointer-events-none">
            <span className="text-[10px] tracking-wider uppercase text-neutral-300">
              Original
            </span>
          </div>
        )}

        {/* Zoom level indicator */}
        {zoom > 1 && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm pointer-events-none">
            <span className="text-[10px] tracking-wider uppercase text-neutral-400 font-mono">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        )}

        {/* Keyboard hints */}
        <div className="hidden sm:flex absolute bottom-4 left-1/2 -translate-x-1/2 items-center gap-4 text-[9px] text-neutral-700 tracking-wider uppercase">
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-500 font-mono text-[9px]">
              Space
            </kbd>{" "}
            compare
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-500 font-mono text-[9px]">
              1-3
            </kbd>{" "}
            algorithm
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-500 font-mono text-[9px]">
              R
            </kbd>{" "}
            reset
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-500 font-mono text-[9px]">
              ⌘S
            </kbd>{" "}
            export
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-500 font-mono text-[9px]">
              scroll
            </kbd>{" "}
            zoom · pan
          </span>
        </div>
      </main>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";
