"use client";

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
    <div className="h-7 px-3 flex items-center justify-between border-b border-[#c8d6e8] text-[11px] font-semibold tracking-wide text-[#0f172a] bg-[#e0e8f8]">
      <div className="flex items-center gap-2">
        <span className="w-3.5 h-3.5 rounded bg-[#2b579a] flex items-center justify-center text-[9px] font-extrabold text-white">
          F
        </span>
        <span>
          {viewMode === "welcome"
            ? "FPGA Lab Design Suite v2026.1 - Getting Started"
            : `${projectName} - [${projectPath}/${projectName}.xpr] - FPGA Lab Design Suite`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode(viewMode === "welcome" ? "workspace" : "welcome")}
          className={`px-2.5 py-0.5 rounded font-bold text-[10px] flex items-center gap-1 transition-all shadow-xs ${
            viewMode === "welcome"
              ? "bg-[#2b579a] hover:bg-[#1e3a8a] text-white"
              : "bg-white hover:bg-slate-100 text-slate-800 border border-[#cbd5e1]"
          }`}
        >
          <span>{viewMode === "welcome" ? "🚀 Open IDE Workspace" : "🏠 Getting Started"}</span>
        </button>

        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold shadow-sm">
          Ready
        </span>
        <span className="text-slate-600 text-[10px] bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">
          Default Layout ▾
        </span>
      </div>
    </div>
  );
}
