import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, ImagePlus, RotateCcw, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ditherLogo from "../../public/ditherlogo.svg";

interface HeaderProps {
  hasImage: boolean;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onNewImage: () => void;
  onReset: () => void;
  onExportPng: () => void;
  onExportGif: () => void;
  canExportGif: boolean;
}

export function Header({
  hasImage,
  showOriginal,
  onToggleOriginal,
  onNewImage,
  onReset,
  onExportPng,
  onExportGif,
  canExportGif,
}: HeaderProps) {
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

          {/* Export dropdown */}
          <div className="relative" ref={menuRef}>
            <Button size="sm" onClick={() => setExportMenuOpen(v => !v)}>
              <Download size={12} />
              Export
              <ChevronDown size={10} className={`transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-white/15 rounded shadow-xl overflow-hidden min-w-[180px]">
                <button
                  onClick={() => { onExportPng(); setExportMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-mono text-neutral-200 hover:bg-white/10 transition-colors"
                >
                  PNG file (Current frame)
                </button>
                <button
                  onClick={() => { onExportGif(); setExportMenuOpen(false); }}
                  disabled={!canExportGif}
                  className="w-full text-left px-3 py-2 text-[11px] font-mono text-neutral-200 hover:bg-white/10 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                >
                  GIF file
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <span className="text-[10px] text-neutral-700 tracking-widest uppercase">
          v1.0
        </span>
      )}
    </header>
  );
}
