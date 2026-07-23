"use client";

import { useRouter } from "next/navigation";

interface FlowNavigatorProps {
  handleOpenSettings: () => void;
  openTab: (id: string, label: string, type: "file" | "view") => void;
  handleRunSimulation: () => void;
  handleRunSynthesis: () => void;
  handleRunImplementation: () => void;
  handleGenerateBitstream: () => void;
}

export default function FlowNavigator({
  handleOpenSettings,
  openTab,
  handleRunSimulation,
  handleRunSynthesis,
  handleRunImplementation,
  handleGenerateBitstream,
}: FlowNavigatorProps) {
  const router = useRouter();

  return (
    <div className="w-52 border-r border-[#c4d2e2] flex flex-col overflow-y-auto shrink-0 bg-[#f0f4f9] text-[#1e293b]">
      <div className="p-2 border-b border-[#c4d2e2] bg-[#e1ebf7] font-bold text-[11px] uppercase tracking-wider text-[#1e3a8a] flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span>📌</span> Flow Navigator
        </span>
        <span className="text-slate-500 text-[9px] font-mono">v2026.1</span>
      </div>

      <div className="p-1 space-y-3 text-[11px]">
        <div>
          <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
            <span>▾</span> PROJECT MANAGER
          </div>
          <div className="pl-3 space-y-0.5 mt-0.5">
            <button
              onClick={handleOpenSettings}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2 font-medium"
            >
              <span className="text-blue-600">⚙️</span> Settings
            </button>
            <button
              onClick={() => openTab("file:constraints/pynq_z2.xdc", "pynq_z2.xdc", "file")}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2"
            >
              <span className="text-emerald-600 font-bold">+</span> Add Sources
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
            <span>▾</span> SIMULATION
          </div>
          <div className="pl-3 space-y-0.5 mt-0.5">
            <button
              onClick={handleRunSimulation}
              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold"
            >
              <span className="text-emerald-600">▶</span> Run Simulation
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
            <span>▾</span> RTL ANALYSIS
          </div>
          <div className="pl-3 space-y-0.5 mt-0.5">
            <button
              onClick={handleRunSynthesis}
              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold"
            >
              <span className="text-emerald-600">▶</span> Run Linter
            </button>
            <button
              onClick={() => openTab("view:schematic", "Schematic Netlist", "view")}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2 font-medium"
            >
              <span>🔍</span> Open Elaborated Design
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
            <span>▾</span> SYNTHESIS
          </div>
          <div className="pl-3 space-y-0.5 mt-0.5">
            <button
              onClick={handleRunSynthesis}
              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold"
            >
              <span className="text-emerald-600">▶</span> Run Synthesis
            </button>
            <button
              onClick={() => openTab("view:schematic", "Schematic Netlist", "view")}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2"
            >
              <span>📂</span> Open Synthesized Design
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
            <span>▾</span> IMPLEMENTATION
          </div>
          <div className="pl-3 space-y-0.5 mt-0.5">
            <button
              onClick={handleRunImplementation}
              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold"
            >
              <span className="text-emerald-600">▶</span> Run Implementation
            </button>
            <button
              onClick={() => openTab("view:device", "Device Floorplan", "view")}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2"
            >
              <span>📂</span> Open Implemented Design
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
            <span>▾</span> PROGRAM AND DEBUG
          </div>
          <div className="pl-3 space-y-0.5 mt-0.5">
            <button
              onClick={handleGenerateBitstream}
              className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2 font-medium"
            >
              <span>📦</span> Generate Bitstream
            </button>
            <button
              onClick={() => router.push("/program")}
              className="w-full text-left px-2 py-1 rounded hover:bg-amber-600/15 text-amber-800 flex items-center gap-2 font-bold"
            >
              <span>⚡</span> Program Device
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
