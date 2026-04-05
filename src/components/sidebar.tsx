import React, { useState, useRef, useEffect } from "react";
import { Contrast, Sun, Moon, Layers, CircleDot, Grid2X2, RotateCcw, Download, ChevronDown } from "lucide-react";
import { SliderControl } from "@/components/slider-control";
import { AlgorithmCard } from "@/components/algorithm-card";
import { CanvasSize } from "@/components/canvas-size";
import { Button } from "@/components/ui/button";
import { ALGORITHMS } from "@/lib/types";
import type { ImageParams, AlgorithmId } from "@/lib/types";

interface SidebarProps {
  params: ImageParams;
  algorithm: AlgorithmId;
  canvasWidth: number;
  canvasHeight: number;
  thumbnails: Record<string, string>;
  onParamChange: <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => void;
  onParamCommit: <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => void;
  onAlgorithmChange: (algorithm: AlgorithmId) => void;
  pixelSize: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onPixelSizeChange: (value: number) => void;
  isMobile?: boolean;
  onReset?: () => void;
  onExportPng?: () => void;
  onExportGif?: () => void;
  canExportGif?: boolean;
  allFrames?: boolean;
  hasMultipleFrames?: boolean;
  onToggleAllFrames?: () => void;
}

export const Sidebar = React.memo(function Sidebar({
  params,
  algorithm,
  canvasWidth,
  canvasHeight,
  thumbnails,
  onParamChange,
  onParamCommit,
  onAlgorithmChange,
  pixelSize,
  onWidthChange,
  onHeightChange,
  onPixelSizeChange,
  isMobile,
  onReset,
  onExportPng,
  onExportGif,
  canExportGif,
  allFrames,
  hasMultipleFrames,
  onToggleAllFrames,
}: SidebarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  const content = (
    <>
      {/* Adjustments (RF-03 to RF-07) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600">
            Adjustments
          </h2>
          {hasMultipleFrames && (
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono cursor-pointer select-none">
              <span>All frames</span>
              <button
                role="switch"
                aria-checked={allFrames}
                onClick={onToggleAllFrames}
                className={[
                  "w-7 h-[15px] rounded-full transition-colors flex items-center px-0.5",
                  allFrames ? "bg-white/80" : "bg-neutral-600",
                ].join(" ")}
              >
                <span className={[
                  "block w-[11px] h-[11px] rounded-full bg-white shadow transition-transform",
                  allFrames ? "translate-x-3" : "translate-x-0",
                ].join(" ")} />
              </button>
            </label>
          )}
        </div>

        <SliderControl
          label="Contrast"
          icon={Contrast}
          value={params.contrast}
          min={-100}
          max={100}
          onChange={(v) => onParamChange("contrast", v)}
          onChangeCommitted={(v) => onParamCommit("contrast", v)}
        />
        <SliderControl
          label="Highlights"
          icon={Sun}
          value={params.highlights}
          min={-100}
          max={100}
          onChange={(v) => onParamChange("highlights", v)}
          onChangeCommitted={(v) => onParamCommit("highlights", v)}
        />
        <SliderControl
          label="Shadows"
          icon={Moon}
          value={params.shadows}
          min={-100}
          max={100}
          onChange={(v) => onParamChange("shadows", v)}
          onChangeCommitted={(v) => onParamCommit("shadows", v)}
        />
        <SliderControl
          label="Gamma"
          icon={Layers}
          value={params.gamma}
          min={-100}
          max={100}
          onChange={(v) => onParamChange("gamma", v)}
          onChangeCommitted={(v) => onParamCommit("gamma", v)}
        />
        <SliderControl
          label="Grain"
          icon={CircleDot}
          value={params.granulation}
          min={-100}
          max={100}
          onChange={(v) => onParamChange("granulation", v)}
          onChangeCommitted={(v) => onParamCommit("granulation", v)}
        />
      </div>

      {/* Canvas Size (RF-08) */}
      <CanvasSize
        width={canvasWidth}
        height={canvasHeight}
        onWidthChange={onWidthChange}
        onHeightChange={onHeightChange}
      />

      {/* Pixel Size */}
      <SliderControl
        label="Pixel Size"
        icon={Grid2X2}
        value={pixelSize}
        min={1}
        max={8}
        step={1}
        defaultValue={1}
        onChange={onPixelSizeChange}
      />

      {/* Algorithm Selection (RF-09) */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600">
          Algorithm
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(ALGORITHMS) as [AlgorithmId, { name: string }][]).map(
            ([key, algo]) => (
              <AlgorithmCard
                key={key}
                name={algo.name}
                selected={algorithm === key}
                thumbnail={thumbnails[key] ?? null}
                onClick={() => onAlgorithmChange(key)}
              />
            )
          )}
        </div>
      </div>

    </>
  );

  if (isMobile) {
    return (
      <div className="shrink-0 h-1/2 border-t border-neutral-900 bg-neutral-950 flex flex-col rounded-t-2xl overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-neutral-700" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">{content}</div>
        {/* Sticky action buttons */}
        <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-neutral-900 bg-neutral-950">
          <Button variant="ghost" size="sm" className="flex-1" onClick={onReset}>
            <RotateCcw size={12} />
            Reset
          </Button>
          <div className="relative flex-1" ref={menuRef}>
            <Button size="sm" className="w-full" onClick={() => setExportMenuOpen(v => !v)}>
              <Download size={12} />
              Export
              <ChevronDown size={10} className={`transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-50 bg-neutral-900 border border-white/15 rounded shadow-xl overflow-hidden min-w-[180px]">
                <button
                  onClick={() => { onExportPng?.(); setExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-mono text-neutral-200 hover:bg-white/10 transition-colors"
                >
                  PNG file (Current frame)
                </button>
                <button
                  onClick={() => { onExportGif?.(); setExportMenuOpen(false); }}
                  disabled={!canExportGif}
                  className="w-full text-left px-3 py-2 text-[11px] font-mono text-neutral-200 hover:bg-white/10 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                >
                  GIF file
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-900 flex flex-col overflow-y-auto">
      <div className="p-4 space-y-6 flex-1">{content}</div>
    </aside>
  );
});
