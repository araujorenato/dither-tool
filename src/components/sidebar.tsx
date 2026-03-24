import React from "react";
import { Contrast, Sun, Moon, Layers, CircleDot, Grid2X2, RotateCcw, Download } from "lucide-react";
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
  onExport?: () => void;
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
  onExport,
}: SidebarProps) {
  const content = (
    <>
      {/* Adjustments (RF-03 to RF-07) */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600">
          Adjustments
        </h2>

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
          <Button size="sm" className="flex-1" onClick={onExport}>
            <Download size={12} />
            Export PNG
          </Button>
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
