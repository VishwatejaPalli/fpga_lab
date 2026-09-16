"use client";

import { ZapSolidIcon, RocketIcon, HomeIcon } from "@/components/icons";

interface EditorHeaderProps {
  viewMode: "welcome" | "workspace";
  setViewMode: (mode: "welcome" | "workspace") => void;
  projectName: string;
  projectPath: string;
}

export default function EditorHeader({
  viewMode,
  setViewMode,
  projectName,
  projectPath,
}: EditorHeaderProps) {
  return (
    <div className="h-7 px-3 flex items-center justify-between border-b border-slate-800 text-[11px] font-mono font-semibold tracking-wide text-slate-200 bg-slate-950">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
          <ZapSolidIcon className="w-2.5 h-2.5" />
        </span>
        <span className="truncate">
          {viewMode === "welcome"
            ? "FPGA Cloud IDE v2026.1 - Hardware Development Suite"
            : `${projectName} - [${projectPath}/${projectName}.xpr]`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode(viewMode === "welcome" ? "workspace" : "welcome")}
          className={`px-2.5 py-0.5 rounded font-mono text-[10px] flex items-center gap-1.5 transition-all ${
            viewMode === "welcome"
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/15"
          }`}
        >
          {viewMode === "welcome" ? (
            <>
              <RocketIcon className="w-3 h-3" />
              <span>Open Workspace</span>
            </>
          ) : (
            <>
              <HomeIcon className="w-3 h-3" />
              <span>Start Page</span>
            </>
          )}
        </button>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
          Ready
        </span>
        <span className="text-slate-400 text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
          Cockpit Layout ▾
        </span>
      </div>
    </div>
  );
}
