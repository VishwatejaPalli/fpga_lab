"use client";

interface ProjectSettingsModalProps {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  settingsTab: "general" | "simulation" | "synthesis" | "implementation";
  setSettingsTab: (tab: "general" | "simulation" | "synthesis" | "implementation") => void;
  draftProjectName: string;
  setDraftProjectName: (val: string) => void;
  draftProjectPart: string;
  setDraftProjectPart: (val: string) => void;
  draftTargetLanguage: string;
  setDraftTargetLanguage: (val: string) => void;
  draftTopModule: string;
  setDraftTopModule: (val: string) => void;
  draftSimTime: number;
  setDraftSimTime: (val: number) => void;
  draftVerilogVer: string;
  setDraftVerilogVer: (val: string) => void;
  handleSaveSettings: () => void;
  handleApplySettings: () => void;
}

export default function ProjectSettingsModal({
  isSettingsOpen,
  setIsSettingsOpen,
  settingsTab,
  setSettingsTab,
  draftProjectName,
  setDraftProjectName,
  draftProjectPart,
  setDraftProjectPart,
  draftTargetLanguage,
  setDraftTargetLanguage,
  draftTopModule,
  setDraftTopModule,
  draftSimTime,
  setDraftSimTime,
  draftVerilogVer,
  setDraftVerilogVer,
  handleSaveSettings,
  handleApplySettings,
}: ProjectSettingsModalProps) {
  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#f8fafc] border border-[#b0c4de] rounded-lg shadow-2xl overflow-hidden flex flex-col h-[520px] text-slate-800">
        <div className="h-9 px-4 bg-[#e0e8f8] border-b border-[#cbd5e1] flex items-center justify-between text-xs font-semibold text-[#0f172a]">
          <span className="flex items-center gap-2">
            <span>⚙️</span> Project Settings
          </span>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="w-5 h-5 rounded hover:bg-slate-300 flex items-center justify-center font-bold text-slate-600 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="w-48 border-r border-[#cbd5e1] bg-[#f0f4f9] p-2 text-xs">
            <div className="font-bold text-[#1e3a8a] text-[11px] px-2 py-1 uppercase tracking-wide border-b border-[#cbd5e1] mb-2">
              Settings Categories
            </div>

            <div className="space-y-1 font-medium text-[11px]">
              {[
                { id: "general", label: "⚙️ General" },
                { id: "simulation", label: "🧪 Simulation" },
                { id: "synthesis", label: "⚙️ Synthesis" },
                { id: "implementation", label: "🧩 Implementation" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSettingsTab(item.id as any)}
                  className={`w-full text-left px-3 py-1.5 rounded transition-colors ${
                    settingsTab === item.id
                      ? "bg-[#2b579a] text-white font-bold"
                      : "text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-200 pb-3 mb-5">
                <h2 className="text-base font-bold text-[#1e3a8a] capitalize">
                  {settingsTab} Project Settings
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure parameters used for compilation and simulation.
                </p>
              </div>

              {settingsTab === "general" && (
                <div className="space-y-4 text-xs font-medium">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Project Name:</label>
                    <input
                      type="text"
                      value={draftProjectName}
                      onChange={(e) => setDraftProjectName(e.target.value)}
                      className="flex-1 px-2.5 py-1 border border-[#cbd5e1] rounded font-mono text-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Target FPGA Device:</label>
                    <select
                      value={draftProjectPart}
                      onChange={(e) => setDraftProjectPart(e.target.value)}
                      className="flex-1 px-2 py-1 border border-[#cbd5e1] rounded font-mono text-blue-800 bg-slate-50"
                    >
                      <option value="pynq-z2 (xc7z020clg400-1)">pynq-z2 (xc7z020clg400-1)</option>
                      <option value="basys3 (xc7a35tcpg236-1)">basys3 (xc7a35tcpg236-1)</option>
                      <option value="arty-a7 (xc7a35tcsg324-1)">arty-a7 (xc7a35tcsg324-1)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Target HDL Language:</label>
                    <select
                      value={draftTargetLanguage}
                      onChange={(e) => setDraftTargetLanguage(e.target.value)}
                      className="flex-1 px-2 py-1 border border-[#cbd5e1] rounded text-slate-900 bg-white"
                    >
                      <option value="Verilog">Verilog</option>
                      <option value="SystemVerilog">SystemVerilog</option>
                      <option value="VHDL">VHDL</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Top Module Name:</label>
                    <input
                      type="text"
                      value={draftTopModule}
                      onChange={(e) => setDraftTopModule(e.target.value)}
                      className="flex-1 px-2.5 py-1 border border-[#cbd5e1] rounded font-mono text-slate-900"
                    />
                  </div>
                </div>
              )}

              {settingsTab === "simulation" && (
                <div className="space-y-4 text-xs font-medium">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Simulation Runtime:</label>
                    <input
                      type="number"
                      value={draftSimTime}
                      onChange={(e) => setDraftSimTime(Number(e.target.value))}
                      className="w-36 px-2.5 py-1 border border-[#cbd5e1] rounded font-mono"
                    />
                    <span className="text-slate-500 text-xs">ns</span>
                  </div>
                </div>
              )}

              {settingsTab === "synthesis" && (
                <div className="space-y-4 text-xs font-medium">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Verilog Standard:</label>
                    <select
                      value={draftVerilogVer}
                      onChange={(e) => setDraftVerilogVer(e.target.value)}
                      className="flex-1 px-2 py-1 border border-[#cbd5e1] rounded"
                    >
                      <option value="Verilog 2001">Verilog 2001</option>
                      <option value="SystemVerilog 2012">SystemVerilog 2012</option>
                    </select>
                  </div>
                </div>
              )}

              {settingsTab === "implementation" && (
                <div className="space-y-4 text-xs font-medium">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-slate-700 text-right">Constraints File:</label>
                    <input
                      type="text"
                      value="constraints/pynq_z2.xdc"
                      disabled
                      className="flex-1 px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-slate-600"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={handleSaveSettings}
                className="px-5 py-1.5 bg-[#2b579a] hover:bg-[#1e3a8a] text-white font-bold rounded shadow-sm"
              >
                OK
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-100 text-slate-700 font-medium rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySettings}
                className="px-4 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-100 text-slate-700 font-medium rounded"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
