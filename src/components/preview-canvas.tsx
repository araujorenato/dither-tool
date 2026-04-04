import { forwardRef, useRef, useState, useCallback, useEffect } from "react";

interface PreviewCanvasProps {
  showOriginal: boolean;
}

export const PreviewCanvas = forwardRef<HTMLCanvasElement, PreviewCanvasProps>(
  ({ showOriginal }, ref) => {
    const containerRef = useRef<HTMLElement>(null);

    // Zoom & pan state — rendered via CSS transform, canvas content unchanged
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Refs for stable access inside event handlers (no stale closures)
    const zoomRef       = useRef(1);
    const panRef        = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragAnchorRef = useRef({ x: 0, y: 0 });

    // Atomic setter: keeps ref and state in sync
    const applyZoom = useCallback((z: number, px: number, py: number) => {
      zoomRef.current  = z;
      panRef.current   = { x: px, y: py };
      setZoom(z);
      setPan({ x: px, y: py });
    }, []);

    const resetView = useCallback(() => applyZoom(1, 0, 0), [applyZoom]);

    // Non-passive wheel listener — needed to call preventDefault()
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        // Cursor position relative to the container centre
        const mx = e.clientX - rect.left  - rect.width  / 2;
        const my = e.clientY - rect.top   - rect.height / 2;
        const z  = zoomRef.current;
        const p  = panRef.current;

        if (e.ctrlKey || e.metaKey) {
          // Pinch / ctrl+wheel → zoom centred on cursor
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
          // Two-finger scroll / regular scroll → pan (only when zoomed)
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

    const cursor = isDragging ? "grabbing" : zoom > 1 ? "grab" : "default";

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

        {/* "Original" badge — fixed position, outside zoom wrapper */}
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
