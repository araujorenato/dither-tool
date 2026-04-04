import { Eye, EyeOff, ImagePlus, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ditherLogo from "../../public/ditherlogo.svg";

interface HeaderProps {
  hasImage: boolean;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onNewImage: () => void;
  onReset: () => void;
  onExport: () => void;
}

export function Header({
  hasImage,
  showOriginal,
  onToggleOriginal,
  onNewImage,
  onReset,
  onExport,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center">
          <img src={ditherLogo} alt="Dithering made easy" />
        </div>
        <h1 className="text-xs font-semibold tracking-wider uppercase text-neutral-400">
          Dither Tool
        </h1>
      </div>

      {hasImage ? (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleOriginal}
            className={showOriginal ? "bg-neutral-700/50 text-neutral-200" : ""}
          >
            {showOriginal ? <EyeOff size={12} /> : <Eye size={12} />}
            {showOriginal ? "Original" : "Edited"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onNewImage}>
            <ImagePlus size={12} />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw size={12} />
            Reset
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download size={12} />
            Export PNG
          </Button>
        </div>
      ) : (
        <span className="text-[10px] text-neutral-700 tracking-widest uppercase">
          v1.0
        </span>
      )}
    </header>
  );
}
