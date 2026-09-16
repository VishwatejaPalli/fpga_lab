"use client";

import { SettingsIcon, PlayIcon, BoxIcon } from "@/components/icons";

interface QuickToolbarProps {
  handleOpenSettings: () => void;
  openTab: (id: string, label: string, type: "file" | "view") => void;
  handleRunSimulation: () => void;
  isSimulating: boolean;
  handleRunSynthesis: () => void;
  isSynthesizing: boolean;
  handleRunImplementation: () => void;
  isImplementing: boolean;
  handleGenerateBitstream: () => void;
  isBitgen: boolean;
  projectPart: string;
}

export default function QuickToolbar({
  handleOpenSettings,
  openTab,
  handleRunSimulation,
  isSimulating,
  handleRunSynthesis,
  isSynthesizing,
  handleRunImplementation,
  isImplementing,
  handleGenerateBitstream,
  isBitgen,
  projectPart,
}: QuickToolbarProps) {
  return (
    <div className="h-8 px-3 border-t border-[#c8d6e8] flex items-center gap-3 text-xs bg-[#eef3f9]">
      <button
        onClick={handleOpenSettings}
        className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2b579a]/10 rounded text-slate-700 text-[11px] font-medium border border-[#cbd5e1] bg-white"
        title="Project Settings"
      >
        <SettingsIcon className="w-3.5 h-3.5 text-blue-600" /> Settings
      </button>

      <button
        onClick={() => openTab("file:constraints/pynq_z2.xdc", "pynq_z2.xdc", "file")}
        className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2b579a]/10 rounded text-slate-700 text-[11px] font-medium border border-[#cbd5e1] bg-white"
        title="Add Sources (Alt+A)"
      >
        <span className="text-emerald-600 font-bold">+</span> Add Sources
      </button>

      <div className="h-4 w-[1px] bg-[#cbd5e1]" />

      <button
        onClick={handleRunSimulation}
        disabled={isSimulating}
        className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-emerald-50 border border-[#cbd5e1] text-emerald-700 rounded text-[11px] font-bold disabled:opacity-50"
        title="Run Behavioral Simulation"
      >
        <PlayIcon className="w-2.5 h-2.5 text-emerald-600" /> Run Simulation
      </button>

      <button
        onClick={handleRunSynthesis}
        disabled={isSynthesizing}
        className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-blue-50 border border-[#cbd5e1] text-blue-700 rounded text-[11px] font-bold disabled:opacity-50"
        title="Run Logic Synthesis (F11)"
      >
        <PlayIcon className="w-2.5 h-2.5 text-blue-600" /> Run Synthesis
      </button>

      <button
        onClick={handleRunImplementation}
        disabled={isImplementing}
        className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-purple-50 border border-[#cbd5e1] text-purple-700 rounded text-[11px] font-bold disabled:opacity-50"
        title="Run Implementation (Place & Route)"
      >
        <PlayIcon className="w-2.5 h-2.5 text-purple-600" /> Run Implementation
      </button>

      <button
        onClick={handleGenerateBitstream}
        disabled={isBitgen}
        className="flex items-center gap-1.5 px-2 py-0.5 bg-[#ffffff] hover:bg-amber-50 border border-[#cbd5e1] text-amber-700 rounded text-[11px] font-bold disabled:opacity-50"
        title="Generate Bitstream (.bit)"
      >
        <BoxIcon className="w-3.5 h-3.5 text-amber-600" /> Generate Bitstream
      </button>

      <div className="ml-auto flex items-center gap-2 text-[11px]">
        <span className="text-slate-600 font-medium">Target FPGA:</span>
        <span className="font-mono text-blue-700 font-bold bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">
          {projectPart}
        </span>
      </div>
    </div>
  );
}
