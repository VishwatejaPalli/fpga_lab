"use client";

import { Board } from "../../hooks/useProjectState";

interface ProjectSummaryViewProps {
  projectName: string;
  projectPath: string;
  productFamily: string;
  projectPart: string;
  topModuleName: string;
  targetLanguage: string;
  simulatorLanguage: string;
  targetSimulator: string;
  summarySubtab: "overview" | "dashboard";
  setSummarySubtab: (sub: "overview" | "dashboard") => void;
  handleOpenSettings: () => void;
  boards: Board[];
  selectedBoardId: string;
  setSelectedBoardId: (id: string) => void;
  handleRunSimulation: () => void;
  handleRunSynthesis: () => void;
  lutUsage: number;
  ffUsage: number;
  wnsValue: string;
  synthStatus: string;
}

export default function ProjectSummaryView({
  projectName,
  projectPath,
  productFamily,
  projectPart,
  topModuleName,
  targetLanguage,
  simulatorLanguage,
  targetSimulator,
  summarySubtab,
  setSummarySubtab,
  handleOpenSettings,
  boards,
  selectedBoardId,
  setSelectedBoardId,
  handleRunSimulation,
  handleRunSynthesis,
  lutUsage,
  ffUsage,
  wnsValue,
  synthStatus,
}: ProjectSummaryViewProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-3">
        <div>
          <h1 className="text-xl font-bold text-[#1e3a8a] flex items-center gap-2">
            <span>PROJECT MANAGER</span>
            <span className="text-slate-600 text-sm font-mono">- {projectName}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">FPGA Lab Design Suite Project Configuration</p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {(["overview", "dashboard"] as const).map((sub) => (
            <button
              key={sub}
              onClick={() => setSummarySubtab(sub)}
              className={`px-3 py-1 rounded font-semibold capitalize transition-colors ${
                summarySubtab === sub
                  ? "bg-[#2b579a] text-white"
                  : "bg-white text-slate-700 border border-[#cbd5e1] hover:bg-slate-50"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {summarySubtab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#c4d2e2] rounded-lg p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="font-bold text-sm text-[#1e3a8a]">Settings</h2>
              <button
                onClick={handleOpenSettings}
                className="text-blue-600 hover:underline text-xs font-semibold"
              >
                Edit
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Project name:</span>
                <span className="text-slate-900 font-bold">{projectName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Project location:</span>
                <span className="text-slate-800 truncate max-w-xs">{projectPath}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Product family:</span>
                <span className="text-slate-900">{productFamily}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Project part:</span>
                <span className="text-blue-700 font-bold">{projectPart}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Top module name:</span>
                <span className="text-blue-700 font-bold">{topModuleName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Target language:</span>
                <span className="text-slate-900">{targetLanguage}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Simulator language:</span>
                <span className="text-slate-900">{simulatorLanguage}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600 font-sans">Target Simulator:</span>
                <span className="text-slate-900">{targetSimulator}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-[#c4d2e2] rounded-lg p-5 space-y-3 shadow-sm">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="font-bold text-sm text-[#1e3a8a]">Target Board</h2>
              </div>
              {boards.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedBoardId}
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.boardType}) — {b.status}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-slate-500">
                    Family: {boards.find((b) => b.id === selectedBoardId)?.fpgaFamily || "—"}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-600 font-medium">
                  ⚠ No boards registered. Ask an admin to add boards.
                </div>
              )}
            </div>

            <div className="bg-white border border-[#c4d2e2] rounded-lg p-5 space-y-3 shadow-sm">
              <h2 className="font-bold text-sm text-[#1e3a8a] border-b border-slate-200 pb-2">
                Design Flow Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRunSimulation}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <span className="text-emerald-600">▶</span> Run Simulation
                </button>
                <button
                  onClick={handleRunSynthesis}
                  className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg text-blue-800 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <span className="text-blue-600">▶</span> Run Synthesis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {summarySubtab === "dashboard" && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#cbd5e1] rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-700 font-mono">{lutUsage}%</div>
            <div className="text-xs text-slate-600 mt-1">LUT Utilization</div>
          </div>
          <div className="bg-white border border-[#cbd5e1] rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-purple-700 font-mono">{ffUsage}%</div>
            <div className="text-xs text-slate-600 mt-1">FF Utilization</div>
          </div>
          <div className="bg-white border border-[#cbd5e1] rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-emerald-700 font-mono">{wnsValue}</div>
            <div className="text-xs text-slate-600 mt-1">WNS Timing Slack</div>
          </div>
          <div className="bg-white border border-[#cbd5e1] rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-amber-700 font-mono">{synthStatus}</div>
            <div className="text-xs text-slate-600 mt-1">Synthesis Run Status</div>
          </div>
        </div>
      )}
    </div>
  );
}
