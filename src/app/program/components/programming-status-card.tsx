"use client";

import { useState } from "react";
import { CheckCircleSolidIcon, XCircleSolidIcon, CopyIcon, SaveIcon } from "@/components/icons";

interface ProgrammingStatusCardProps {
  jobStatus: string | null;
  logConnected: boolean;
  logError: string | null;
  logs: string[];
  isRedirecting?: boolean;
  onReset?: () => void;
}

export default function ProgrammingStatusCard({
  jobStatus,
  logConnected,
  logError,
  logs,
  isRedirecting,
  onReset,
}: ProgrammingStatusCardProps) {
  const [copied, setCopied] = useState(false);

  if (!jobStatus) return null;

  const handleCopyLogs = () => {
    const text = logs.join("");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = logs.join("");
    blobToDownload(text);
  };

  const blobToDownload = (text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fpga-programming-log-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cockpit-panel p-5 sm:p-6 rounded-2xl border border-blue-500/30 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/30 text-xs font-mono font-bold">
            03
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-base flex items-center gap-2">
              JTAG Flashing &amp; Verification
            </h2>
            <p className="text-xs text-muted">
              Real-time hardware programming progress and OpenOCD output
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase ${
            jobStatus === "success"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : jobStatus === "failed"
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
              : jobStatus === "programming"
              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              jobStatus === "success"
                ? "led-glow-green"
                : jobStatus === "failed"
                ? "led-glow-red"
                : jobStatus === "programming"
                ? "led-glow-cyan animate-pulse"
                : "led-glow-amber"
            }`}
          />
          {jobStatus}
        </span>
      </div>

      {/* Progress bar */}
      {(jobStatus === "programming" || jobStatus === "queued") && (
        <div className="w-full bg-muted/30 rounded-full h-2 mb-4 overflow-hidden border border-border">
          <div
            className="bg-gradient-to-r from-blue-600 to-cyan-400 h-2 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
            style={{
              width:
                jobStatus === "queued"
                  ? "8%"
                  : `${Math.min(95, Math.max(15, logs.length * 4))}%`,
            }}
          />
        </div>
      )}

      {jobStatus === "success" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircleSolidIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">FPGA programmed successfully!</p>
              <p className="text-xs text-muted mt-0.5">
                {isRedirecting
                  ? "Redirecting to board hardware monitor console..."
                  : "Device configured and active on bus."}
              </p>
            </div>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-foreground font-mono transition-all"
            >
              Program Another File
            </button>
          )}
        </div>
      )}

      {jobStatus === "failed" && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
              <XCircleSolidIcon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Programming failed</p>
              <p className="text-xs text-muted mt-0.5">
                Check terminal logs below for tool exit codes, boundary scan, or part mismatch.
              </p>
            </div>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono font-medium transition-all shadow-md shadow-rose-600/20"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Live Terminal Logs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
              OpenOCD / JTAG Bus Terminal
            </span>
            {jobStatus === "programming" && logConnected && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                LIVE STREAM
              </span>
            )}
            {logError && <span className="text-xs text-amber-500 dark:text-amber-400 font-mono">{logError}</span>}
          </div>

          {logs.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLogs}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground bg-card hover:bg-muted px-2.5 py-1 rounded-lg border border-border transition-all font-mono"
              >
                <CopyIcon className="w-3.5 h-3.5" />
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
              <button
                onClick={handleDownloadLogs}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground bg-card hover:bg-muted px-2.5 py-1 rounded-lg border border-border transition-all font-mono"
              >
                <SaveIcon className="w-3.5 h-3.5" />
                <span>Save Log</span>
              </button>
            </div>
          )}
        </div>

        <div
          className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-400 max-h-80 overflow-y-auto scroll-smooth border border-border shadow-inner"
          ref={(el) => {
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          <div className="whitespace-pre-wrap leading-relaxed font-mono">
            {logs.length > 0 ? logs.join("") : "Waiting for programmer execution logs..."}
          </div>
        </div>
      </div>
    </div>
  );
}

