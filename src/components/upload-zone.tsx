"use client";

import { useCallback, useState } from "react";

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
      className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-colors touch-manipulation ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted"
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
          <div className="text-3xl mb-2">📄</div>
          <p className="font-medium">{fileName}</p>
          <p className="text-muted text-sm mt-1">Click or drag to replace</p>
        </>
      ) : (
        <>
          <div className="text-3xl mb-2">📂</div>
          <p className="font-medium">
            Drag & drop your bitstream file here
          </p>
          <p className="text-muted text-sm mt-1">
            Or click to browse. Supports: {ALLOWED_EXTENSIONS.join(", ")}
          </p>
        </>
      )}

      {error && (
        <p className="text-danger text-sm mt-3">{error}</p>
      )}
    </div>
  );
}
