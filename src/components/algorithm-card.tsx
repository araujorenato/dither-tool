import React from "react";
import { Check, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlgorithmCardProps {
  name: string;
  selected: boolean;
  thumbnail: string | null;
  onClick: () => void;
}

export const AlgorithmCard = React.memo(function AlgorithmCard({
  name,
  selected,
  thumbnail,
  onClick,
}: AlgorithmCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all cursor-pointer",
        selected
          ? "border-neutral-400 bg-neutral-800/80 ring-1 ring-neutral-500/40"
          : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-800/40"
      )}
    >
      <div className="w-full aspect-square rounded overflow-hidden bg-neutral-950 flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="w-full h-full object-cover"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <Grid3X3 size={16} className="text-neutral-700" />
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium tracking-wider uppercase",
          selected ? "text-neutral-200" : "text-neutral-500"
        )}
      >
        {name}
      </span>
      {selected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-200 rounded-full flex items-center justify-center">
          <Check size={10} className="text-neutral-900" />
        </div>
      )}
    </button>
  );
});
