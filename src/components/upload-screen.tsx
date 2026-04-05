import { useState, useRef, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { VALID_IMAGE_TYPES } from "@/lib/types";

interface UploadScreenProps {
  onImageLoad: (file: File) => void;
  onError: (message: string) => void;
  error: string | null;
}

export function UploadScreen({ onImageLoad, onError, error }: UploadScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        onError("Unsupported format. Use PNG, JPG, WEBP or GIF.");
        return;
      }
      onImageLoad(file);
    },
    [onImageLoad, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className={`
          relative w-full max-w-lg aspect-[4/3] rounded-2xl border-2 border-dashed
          transition-all duration-300 flex flex-col items-center justify-center gap-5 cursor-pointer
          ${isDragging
            ? "border-neutral-400 bg-neutral-800/30 scale-[1.02]"
            : "border-neutral-800 hover:border-neutral-600 bg-neutral-900/30"
          }
          ${error ? "border-red-800/60" : ""}
        `}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
            isDragging ? "bg-neutral-700/40" : "bg-neutral-800/60"
          }`}
        >
          <Upload
            size={28}
            className={`transition-colors ${isDragging ? "text-neutral-300" : "text-neutral-600"}`}
          />
        </div>

        <div className="text-center space-y-2">
          <p
            className={`text-sm font-medium transition-colors ${
              isDragging ? "text-neutral-200" : "text-neutral-400"
            }`}
          >
            Drop your image here
          </p>
          <p className="text-xs text-neutral-600">or click to browse</p>
          <p className="text-[10px] text-neutral-700 tracking-wider uppercase">
            PNG · JPG · WEBP · GIF
          </p>
        </div>

        {error && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/30">
            <X size={14} className="text-red-400 shrink-0" />
            <span className="text-xs text-red-300">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
