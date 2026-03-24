import React from "react";
import type { LucideIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip } from "@/components/ui/tooltip";

interface SliderControlProps {
  label: string;
  icon: LucideIcon;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  onChangeCommitted?: (value: number) => void;
}

export const SliderControl = React.memo(function SliderControl({
  label,
  icon: Icon,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  onChange,
  onChangeCommitted,
}: SliderControlProps) {
  const handleDoubleClick = () => {
    onChange(defaultValue);
    onChangeCommitted?.(defaultValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-neutral-500" />
          <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
            {label}
          </span>
        </div>
        <Tooltip content="Double-click slider to reset" side="left">
          <span className="text-[11px] tabular-nums text-neutral-500 font-mono">
            {value > 0 ? `+${value}` : value}
          </span>
        </Tooltip>
      </div>
      <div onDoubleClick={handleDoubleClick}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={onChange}
          onValueCommit={onChangeCommitted}
        />
      </div>
    </div>
  );
});
