"use client";

import { useRouter } from "next/navigation";
import { Board, RecentProject } from "../hooks/useProjectState";

interface WelcomeScreenProps {
  setIsNewProjectOpen: (open: boolean) => void;
  setViewMode: (mode: "welcome" | "workspace") => void;
  handleLoadExample: (exampleKey: string) => void;
  handleOpenSettings: () => void;
  boards: Board[];
  activeSessions: any[];
  recentProjects: RecentProject[];
  setProjectName: (name: string) => void;
  setTopModuleName: (name: string) => void;
}

export default function WelcomeScreen({
  setIsNewProjectOpen,
  setViewMode,
  handleLoadExample,
  handleOpenSettings,
  boards,
  activeSessions,
  recentProjects,
  setProjectName,
  setTopModuleName,
}: WelcomeScreenProps) {
  const router = useRouter();

  return (
    <div className="flex-1 p-6 md:p-10 overflow-y-auto bg-[#e8eef8]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Title Banner */}
        <div className="bg-[#2b579a] text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-white/20 text-white font-black text-2xl flex items-center justify-center">
                F
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">FPGA Lab Design Suite</h1>
            </div>
            <p className="text-blue-100 text-xs md:text-sm mt-1">
              Cloud-Based FPGA Hardware Synthesis, Behavioral Simulation & Remote Deployment
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsNewProjectOpen(true)}
              className="px-5 py-2.5 bg-white text-[#2b579a] font-bold rounded-xl text-xs hover:bg-blue-50 transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <span className="text-emerald-600 font-bold">+</span> Create Project
            </button>
            <button
              onClick={() => setViewMode("workspace")}
              className="px-5 py-2.5 bg-blue-700/80 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition-all shadow-md border border-white/20 active:scale-95 flex items-center gap-2"
            >
              <span>🚀</span> Launch IDE
            </button>
          </div>
        </div>

        {/* Quick Start & Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Start Card */}
          <div className="bg-white border border-[#c4d2e2] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#1e3a8a] border-b border-slate-200 pb-3 font-bold text-base">
              <span>🚀</span> Quick Start
            </div>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => setIsNewProjectOpen(true)}
                className="w-full text-left p-3 rounded-xl hover:bg-blue-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold group transition-all"
              >
                <span className="text-xl text-blue-600 group-hover:scale-110 transition-transform">📁</span>
                <div>
                  <div>Create Project</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Create a new FPGA project with HDL & constraints
                  </div>
                </div>
              </button>

              <button
                onClick={() => setViewMode("workspace")}
                className="w-full text-left p-3 rounded-xl hover:bg-blue-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold group transition-all"
              >
                <span className="text-xl text-purple-600 group-hover:scale-110 transition-transform">📂</span>
                <div>
                  <div>Open Project</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Open an existing workspace project in IDE
                  </div>
                </div>
              </button>
            </div>

            {/* Example Projects */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="text-slate-600 font-bold text-xs">Open Example Project</div>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleLoadExample("uart_tx")}
                  className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 rounded-lg text-slate-700 flex items-center justify-between border border-slate-200"
                >
                  <span className="font-semibold text-blue-700">UART Transmitter</span>
                  <span className="text-[10px] text-slate-500 font-mono">PYNQ-Z2</span>
                </button>
                <button
                  onClick={() => handleLoadExample("blinky")}
                  className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 rounded-lg text-slate-700 flex items-center justify-between border border-slate-200"
                >
                  <span className="font-semibold text-blue-700">Blinky LED Counter</span>
                  <span className="text-[10px] text-slate-500 font-mono">PYNQ-Z2</span>
                </button>
                <button
                  onClick={() => handleLoadExample("ripple_adder")}
                  className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 rounded-lg text-slate-700 flex items-center justify-between border border-slate-200"
                >
                  <span className="font-semibold text-blue-700">4-bit Ripple Carry Adder</span>
                  <span className="text-[10px] text-slate-500 font-mono">Basys3</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tasks & Management Card */}
          <div className="bg-white border border-[#c4d2e2] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#1e3a8a] border-b border-slate-200 pb-3 font-bold text-base">
              <span>⚙️</span> Lab Tasks
            </div>

            <div className="space-y-2 text-xs">
              <button
                onClick={handleOpenSettings}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold"
              >
                <span className="text-xl text-blue-600">⚙️</span>
                <div>
                  <div>Project Settings</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Configure target FPGA board & HDL standards
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push("/program")}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold"
              >
                <span className="text-xl text-amber-600">⚡</span>
                <div>
                  <div>Open Hardware Programmer</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Deploy compiled bitstream to physical FPGA
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push("/help")}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold"
              >
                <span className="text-xl text-emerald-600">📘</span>
                <div>
                  <div>Documentation & Manuals</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    View step-by-step FPGA guides and tutorials
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Cloud Hardware Status Card */}
          <div className="bg-white border border-[#c4d2e2] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-[#1e3a8a] font-bold text-base">
                  <span>🔌</span> FPGA Lab Status
                </div>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                  Connected ({activeSessions.length > 0 ? `${activeSessions.length} active` : "Online"})
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                {boards.length > 0 ? (
                  boards.slice(0, 2).map((b, idx) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{b.name}</div>
                        <div className="text-[10px] text-slate-500">
                          Board #{String(idx + 1).padStart(2, "0")} • {b.boardType} ({b.fpgaFamily})
                        </div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">PYNQ-Z2 (Zynq-7000)</div>
                        <div className="text-[10px] text-slate-500">Board #01 • xc7z020clg400-1</div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">Basys3 (Artix-7)</div>
                        <div className="text-[10px] text-slate-500">Board #02 • xc7a35tcpg236-1</div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 text-center">
              <button
                onClick={() => setViewMode("workspace")}
                className="w-full py-2.5 bg-[#2b579a] hover:bg-[#1e3a8a] text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Open IDE Workspace
              </button>
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div className="bg-white border border-[#c4d2e2] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
              <span>📂</span> Recent Projects
            </h2>
            <span className="text-xs text-slate-500 font-mono">{recentProjects.length} projects</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-blue-900 truncate">{p.name}</span>
                    <span className="text-[9px] px-2 py-0.5 bg-blue-100 text-blue-700 font-mono font-bold rounded">
                      {p.targetBoard}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate mt-1">{p.path}</div>
                  <div className="text-xs text-slate-600 mt-2 font-medium">
                    Top Module: <span className="font-mono text-slate-800">{p.topModule}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">{p.lastModified}</span>
                  <button
                    onClick={() => {
                      setProjectName(p.name);
                      setTopModuleName(p.topModule);
                      setViewMode("workspace");
                    }}
                    className="px-3 py-1 bg-[#2b579a] hover:bg-[#1e3a8a] text-white font-bold rounded text-[11px]"
                  >
                    Launch IDE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
