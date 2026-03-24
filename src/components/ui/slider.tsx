import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  className?: string;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ min, max, step = 1, value, onValueChange, onValueCommit, className }, ref) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const currentValueRef = React.useRef(value);
    currentValueRef.current = value;

    const percentage = ((value - min) / (max - min)) * 100;

    const updateValue = React.useCallback(
      (clientX: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const raw = min + pct * (max - min);
        const stepped = Math.round(raw / step) * step;
        onValueChange(Math.max(min, Math.min(max, stepped)));
      },
      [min, max, step, onValueChange]
    );

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        updateValue(e.clientX);
      },
      [updateValue]
    );

    React.useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => updateValue(e.clientX);
      const handleMouseUp = () => {
        setIsDragging(false);
        onValueCommit?.(currentValueRef.current);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isDragging, updateValue]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center h-6 cursor-pointer group",
          className
        )}
        onMouseDown={handleMouseDown}
      >
        <div ref={trackRef} className="relative h-[3px] w-full rounded-full bg-neutral-800">
          {/* Active track: draw between center (50%) and current value */}
          <div
            className="absolute h-full bg-neutral-500 group-hover:bg-neutral-400 rounded-full transition-colors"
            style={{
              left: `${Math.min(percentage, 50)}%`,
              width: `${Math.abs(percentage - 50)}%`,
            }}
          />
          {/* Thumb */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border shadow-md transition-all",
              isDragging
                ? "bg-white border-neutral-500 scale-110"
                : "bg-neutral-200 border-neutral-600 group-hover:bg-white group-hover:scale-110"
            )}
            style={{ left: `calc(${percentage}% - 6px)` }}
          />
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";

export { Slider };
