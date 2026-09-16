"use client";

import { TargetIcon } from "@/components/icons";

interface DemoBitstreamBannerProps {
  jobId: string | null;
  loadDemoBitstream: () => void;
}

export default function DemoBitstreamBanner({
  jobId,
  loadDemoBitstream,
}: DemoBitstreamBannerProps) {
  if (jobId) return null;

  return (
    <div className="cockpit-panel border border-blue-500/25 bg-blue-50/50 dark:bg-gradient-to-r dark:from-blue-950/30 dark:via-[#0e1728] dark:to-slate-900/40 p-5 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-all duration-700" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-inner">
            <TargetIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm tracking-wide">Sample Blinky Bitstream</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-bold">
                READY TO FLASH
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Test real hardware programming with <span className="font-mono text-cyan-600 dark:text-cyan-300 font-semibold">blinky.bit</span> — a
              pre-built LED blinker bitstream compiled for Xilinx Spartan-3E &amp; 7-series FPGAs.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 self-end sm:self-center">
          <a
            href="/demo/blinky.bit"
            download="blinky.bit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-foreground rounded-lg hover:bg-foreground/5 transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </a>
          <button
            onClick={loadDemoBitstream}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-600/25 active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Load Sample
          </button>
        </div>
      </div>
    </div>
  );
}

