import { forwardRef } from "react";

interface PreviewCanvasProps {
  showOriginal: boolean;
  isProcessing: boolean;
}

export const PreviewCanvas = forwardRef<HTMLCanvasElement, PreviewCanvasProps>(
  ({ showOriginal, isProcessing }, ref) => {
    return (
      <main className="flex-1 min-h-0 flex items-center justify-center bg-neutral-950 relative overflow-hidden">
        {/* Subtle dot grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative max-w-[90%] max-h-[90%]">
          <canvas
            ref={ref}
            className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-sm"
            style={{ imageRendering: "pixelated" }}
          />

          {/* RF-13: Original/Edited indicator */}
          {showOriginal && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm">
              <span className="text-[10px] tracking-wider uppercase text-neutral-300">
                Original
              </span>
            </div>
          )}

          {isProcessing && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm">
              <span className="text-[10px] tracking-wider uppercase text-neutral-500 animate-pulse">
                Processing…
              </span>
            </div>
          )}
        </div>

        {/* Keyboard hints (RF-18) */}
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
        </div>
      </main>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";
