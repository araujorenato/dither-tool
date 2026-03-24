import { useState, useEffect } from "react";
import { RectangleHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";

const MIN = 80;
const MAX = 1000;

function clamp(v: number) {
  return Math.min(MAX, Math.max(MIN, v));
}

interface CanvasSizeProps {
  width: number;
  height: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
}

export function CanvasSize({ width, height, onWidthChange, onHeightChange }: CanvasSizeProps) {
  const [draftW, setDraftW] = useState<string>("");
  const [draftH, setDraftH] = useState<string>("");

  // Keep draft in sync with external value when not focused
  useEffect(() => { setDraftW(String(width)); }, [width]);
  useEffect(() => { setDraftH(String(height)); }, [height]);

  function commitWidth(raw: string) {
    const n = parseInt(raw);
    onWidthChange(clamp(isNaN(n) ? MIN : n));
  }

  function commitHeight(raw: string) {
    const n = parseInt(raw);
    onHeightChange(clamp(isNaN(n) ? MIN : n));
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>, commit: (v: string) => void, draft: string) {
    if (e.key === "Enter") {
      commit(draft);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RectangleHorizontal size={13} className="text-neutral-500" />
        <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
          Canvas Size
        </span>
      </div>
      <Slider
        min={MIN}
        max={MAX}
        step={1}
        value={Math.min(MAX, Math.max(MIN, width))}
        onValueChange={onWidthChange}
      />
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-600 uppercase shrink-0">W</span>
          <input
            type="number"
            value={draftW}
            min={MIN}
            max={MAX}
            onChange={(e) => setDraftW(e.target.value)}
            onBlur={(e) => commitWidth(e.target.value)}
            onKeyDown={(e) => handleKey(e, commitWidth, draftW)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1 text-[11px] tabular-nums text-neutral-300 font-mono focus:outline-none focus:border-neutral-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <span className="text-[10px] text-neutral-700">×</span>
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-600 uppercase shrink-0">H</span>
          <input
            type="number"
            value={draftH}
            min={MIN}
            max={MAX}
            onChange={(e) => setDraftH(e.target.value)}
            onBlur={(e) => commitHeight(e.target.value)}
            onKeyDown={(e) => handleKey(e, commitHeight, draftH)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1 text-[11px] tabular-nums text-neutral-300 font-mono focus:outline-none focus:border-neutral-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>
    </div>
  );
}
