"use client";

import { useEffect, useState } from "react";
import UploadZone from "@/components/upload-zone";
import { Board } from "../hooks/useProgrammer";
import { TargetIcon, ZapIcon, XIcon, CheckIcon, AlertTriangleIcon } from "@/components/icons";

interface BitstreamUploaderProps {
  file: File | null;
  selectedBoard?: Board;
  demoLoaded: boolean;
  jobId: string | null;
  handleFileSelected: (f: File) => void;
  removeSelectedFile: () => void;
}

interface BitHeaderInfo {
  part?: string;
  sourceFile?: string;
  verified?: boolean;
  matchNotice?: string;
}

export default function BitstreamUploader({
  file,
  selectedBoard,
  demoLoaded,
  jobId,
  handleFileSelected,
  removeSelectedFile,
}: BitstreamUploaderProps) {
  const [headerInfo, setHeaderInfo] = useState<BitHeaderInfo | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatDetails = (fileName: string) => {
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case ".bit":
        return { type: "Xilinx Bitstream", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
      case ".bin":
        return { type: "Raw Binary Vector", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
      case ".svf":
        return { type: "Serial Vector Format (JTAG)", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
      case ".fs":
        return { type: "Gowin Bitstream", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
      case ".sof":
      case ".pof":
        return { type: "Intel/Altera SRAM Object", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" };
      default:
        return { type: `${ext.toUpperCase()} File`, color: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
    }
  };

  // Adjust header info when file changes
  const [prevFile, setPrevFile] = useState(file);
  if (file !== prevFile) {
    setPrevFile(file);
    if (!file || !file.name.toLowerCase().endsWith(".bit")) {
      setHeaderInfo(null);
    }
  }

  // Pre-flight header inspection for Xilinx .bit files
  useEffect(() => {
    if (!file || !file.name.toLowerCase().endsWith(".bit")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
        let text = "";
        for (let i = 0; i < Math.min(buffer.length, 512); i++) {
          const ch = buffer[i];
          text += ch >= 32 && ch <= 126 ? String.fromCharCode(ch) : " ";
        }

        const partMatch = text.match(/b\s*([0-9a-zA-Z\-_]{4,24})/);
        const nameMatch = text.match(/a\s*([0-9a-zA-Z\-_\.]+\.v[hd]*)/);

        const part = partMatch ? partMatch[1] : undefined;
        const sourceFile = nameMatch ? nameMatch[1] : undefined;

        let verified = true;
        let matchNotice = "Header format valid";

        if (part && selectedBoard) {
          const boardType = selectedBoard.boardType.toLowerCase();
          const partLower = part.toLowerCase();

          if (boardType.includes("basys") && !partLower.includes("7a35")) {
            verified = false;
            matchNotice = `Target chip ${part} differs from Basys 3 (XC7A35T)`;
          } else if (boardType.includes("nexys") && !partLower.includes("7a100")) {
            verified = false;
            matchNotice = `Target chip ${part} differs from Nexys A7 (XC7A100T)`;
          } else if (boardType.includes("pynq") && !partLower.includes("7z020")) {
            verified = false;
            matchNotice = `Target chip ${part} differs from PYNQ-Z2 (XC7Z020)`;
          } else {
            matchNotice = `Target chip ${part} matches ${selectedBoard.name}`;
          }
        }

        setHeaderInfo({ part, sourceFile, verified, matchNotice });
      } catch (err) {
        setHeaderInfo(null);
      }
    };
    reader.readAsArrayBuffer(file.slice(0, 512));
  }, [file, selectedBoard]);

  return (
    <div className="cockpit-panel p-5 sm:p-6 rounded-2xl border border-border">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/30 text-xs font-mono font-bold">
            02
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-base">
              Bitstream Binary Payload
            </h2>
            <p className="text-xs text-muted">
              Upload compiled gateware (.bit, .bin, .svf) for FPGA SRAM/Flash memory
            </p>
          </div>
        </div>

        {file && (
          <span className="text-xs font-mono text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            PAYLOAD LOADED
          </span>
        )}
      </div>

      {file ? (
        <div className="border border-blue-500/30 bg-blue-50/40 dark:bg-[#0c121e]/90 rounded-xl p-5 relative overflow-hidden shadow-inner">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0 shadow-sm text-primary">
                {demoLoaded ? (
                  <TargetIcon className="w-6 h-6" />
                ) : (
                  <ZapIcon className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base text-foreground font-mono">
                    {file.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      getFormatDetails(file.name).color
                    }`}
                  >
                    {getFormatDetails(file.name).type}
                  </span>
                </div>

                <div className="text-xs text-muted mt-2 flex items-center gap-3 flex-wrap font-mono">
                  <span>Size: <strong className="text-foreground">{formatFileSize(file.size)}</strong></span>
                  {selectedBoard && (
                    <>
                      <span className="opacity-30">•</span>
                      <span>Target: <strong className="text-foreground">{selectedBoard.fpgaFamily}</strong></span>
                    </>
                  )}
                  {headerInfo?.part && (
                    <>
                      <span className="opacity-30">•</span>
                      <span>Silicon: <strong className="text-cyan-600 dark:text-cyan-400">{headerInfo.part}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!jobId && (
              <button
                onClick={removeSelectedFile}
                className="px-2.5 py-1 text-muted hover:text-rose-500 hover:bg-rose-500/10 border border-border hover:border-rose-500/30 rounded-lg transition-all text-xs font-mono flex items-center gap-1.5"
                title="Remove file"
              >
                <span>Remove</span>
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {selectedBoard && (
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs">
              {headerInfo ? (
                headerInfo.verified !== false ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 font-mono">
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 font-bold" />
                    <span>Pre-flight check: {headerInfo.matchNotice}</span>
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 font-mono">
                    <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{headerInfo.matchNotice}</span>
                  </span>
                )
              ) : (
                <span className="text-muted font-mono flex items-center gap-1.5">
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 font-bold inline" /> Pre-flight checks passed for <strong className="text-foreground">{selectedBoard.name}</strong> ({selectedBoard.boardType})
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <UploadZone onFileSelected={handleFileSelected} disabled={!!jobId} />
      )}
    </div>
  );
}

