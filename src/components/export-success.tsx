import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALGORITHMS } from "@/lib/types";
import type { ExportInfo } from "@/lib/types";

interface ExportSuccessProps {
  info: ExportInfo;
  onNewImage: () => void;
  onContinue: () => void;
}

export function ExportSuccess({ info, onNewImage, onContinue }: ExportSuccessProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Check size={24} className="text-emerald-400" />
        </div>

        <div className="space-y-1">
          <h3 className="text-neutral-100 font-semibold text-lg">
            Exported successfully
          </h3>
          <p className="text-neutral-500 text-sm font-mono">{info.fileName}</p>
          <p className="text-neutral-600 text-xs">
            {info.width} × {info.height} · {ALGORITHMS[info.algorithm]?.name}
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onNewImage}>
            New image
          </Button>
          <Button className="flex-1" onClick={onContinue}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>
  );
}
