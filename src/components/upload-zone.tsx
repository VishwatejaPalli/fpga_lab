"use client";

import { useCallback, useState } from "react";
import { FileTextIcon, FolderIcon, AlertTriangleIcon } from "@/components/icons";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ALLOWED_EXTENSIONS = [
  ".bit", ".bin", ".svf", ".jed", ".mcs", ".rbf", ".sof", ".pof", ".cfg", ".fs", ".gw",
];

export default function UploadZone({ onFileSelected, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File too large. Maximum size: 50MB");
      return false;
    }
    setError(null);
    return true;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        setFileName(file.name);
        onFileSelected(file);
      }
    },
    [validateFile, onFileSelected]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all touch-manipulation ${
        dragOver
          ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          : "border-border hover:border-primary/50 bg-card/50 hover:bg-card"
      } ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ALLOWED_EXTENSIONS.join(",");
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) handleFile(file);
        };
        input.click();
      }}
    >
      {fileName ? (
        <>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 text-primary">
            <FileTextIcon className="w-6 h-6" />
          </div>
          <p className="font-medium text-foreground font-mono">{fileName}</p>
          <p className="text-muted text-xs font-mono mt-1">Click or drag to replace bitstream</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 text-primary">
            <FolderIcon className="w-6 h-6" />
          </div>
          <p className="font-medium text-foreground text-sm">
            Drag &amp; drop your compiled gateware bitstream file here
          </p>
          <p className="text-muted text-xs font-mono mt-1.5">
            Or click to browse. Supports: {ALLOWED_EXTENSIONS.join(", ")}
          </p>
        </>
      )}

      {error && (
        <div className="inline-flex items-center gap-1.5 text-rose-500 text-xs font-mono mt-3">
          <AlertTriangleIcon className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
