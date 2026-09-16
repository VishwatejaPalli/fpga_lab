"use client";

import { useRouter } from "next/navigation";
import { Board, RecentProject } from "../hooks/useProjectState";

// --- Minimal Inline SVG Icons ---
function RocketIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function FolderPlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10v6" />
      <path d="M9 13h6" />
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function FolderIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ZapIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function BookOpenIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function PlugIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}


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
    <div className="flex-1 p-6 md:p-10 overflow-y-auto bg-background text-foreground transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Title Banner */}
        <div className="bg-primary text-primary-foreground p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-primary/20">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-white/20 text-white font-black text-2xl flex items-center justify-center shadow-inner">
                F
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">FPGA Lab Design Suite</h1>
            </div>
            <p className="text-primary-foreground/80 text-xs md:text-sm mt-1">
              Cloud-Based FPGA Hardware Synthesis, Behavioral Simulation & Remote Deployment
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsNewProjectOpen(true)}
              className="px-5 py-2.5 bg-background text-primary font-bold rounded-xl text-xs hover:bg-muted transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4 text-emerald-500" /> Create Project
            </button>
            <button
              onClick={() => setViewMode("workspace")}
              className="px-5 py-2.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground font-bold rounded-xl text-xs transition-all shadow-md border border-white/20 active:scale-95 flex items-center gap-2"
            >
              <RocketIcon className="w-4 h-4" /> Launch IDE
            </button>
          </div>
        </div>

        {/* Quick Start & Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Start Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground border-b border-border pb-3 font-bold text-base">
              <RocketIcon className="w-5 h-5 text-blue-500" /> Quick Start
            </div>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => setIsNewProjectOpen(true)}
                className="w-full text-left p-3 rounded-xl hover:bg-muted text-foreground flex items-center gap-3 border border-border/60 font-semibold group transition-all"
              >
                <FolderPlusIcon className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
                <div>
                  <div>Create Project</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Create a new FPGA project with HDL & constraints
                  </div>
                </div>
              </button>

              <button
                onClick={() => setViewMode("workspace")}
                className="w-full text-left p-3 rounded-xl hover:bg-muted text-foreground flex items-center gap-3 border border-border/60 font-semibold group transition-all"
              >
                <FolderIcon className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
                <div>
                  <div>Open Project</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Open an existing workspace project in IDE
                  </div>
                </div>
              </button>
            </div>

            {/* Example Projects */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Open Example Project</div>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleLoadExample("uart_tx")}
                  className="w-full text-left px-3 py-2 bg-muted/40 hover:bg-muted rounded-lg text-foreground flex items-center justify-between border border-border transition-colors"
                >
                  <span className="font-semibold text-blue-600 dark:text-blue-400">UART Transmitter</span>
                  <span className="text-[10px] text-muted-foreground font-mono">PYNQ-Z2</span>
                </button>
                <button
                  onClick={() => handleLoadExample("blinky")}
                  className="w-full text-left px-3 py-2 bg-muted/40 hover:bg-muted rounded-lg text-foreground flex items-center justify-between border border-border transition-colors"
                >
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Blinky LED Counter</span>
                  <span className="text-[10px] text-muted-foreground font-mono">PYNQ-Z2</span>
                </button>
                <button
                  onClick={() => handleLoadExample("ripple_adder")}
                  className="w-full text-left px-3 py-2 bg-muted/40 hover:bg-muted rounded-lg text-foreground flex items-center justify-between border border-border transition-colors"
                >
                  <span className="font-semibold text-blue-600 dark:text-blue-400">4-bit Ripple Carry Adder</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Basys3</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tasks & Management Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground border-b border-border pb-3 font-bold text-base">
              <SettingsIcon className="w-5 h-5 text-slate-500" /> Lab Tasks
            </div>

            <div className="space-y-2 text-xs">
              <button
                onClick={handleOpenSettings}
                className="w-full text-left p-3 rounded-xl hover:bg-muted text-foreground flex items-center gap-3 border border-border/60 font-semibold transition-colors"
              >
                <SettingsIcon className="w-6 h-6 text-blue-500" />
                <div>
                  <div>Project Settings</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Configure target FPGA board & HDL standards
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push("/program")}
                className="w-full text-left p-3 rounded-xl hover:bg-muted text-foreground flex items-center gap-3 border border-border/60 font-semibold transition-colors"
              >
                <ZapIcon className="w-6 h-6 text-amber-500" />
                <div>
                  <div>Open Hardware Programmer</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Deploy compiled bitstream to physical FPGA
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push("/help")}
                className="w-full text-left p-3 rounded-xl hover:bg-muted text-foreground flex items-center gap-3 border border-border/60 font-semibold transition-colors"
              >
                <BookOpenIcon className="w-6 h-6 text-emerald-500" />
                <div>
                  <div>Documentation & Manuals</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    View step-by-step FPGA guides and tutorials
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Cloud Hardware Status Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-base">
                  <PlugIcon className="w-5 h-5 text-indigo-500" /> FPGA Lab Status
                </div>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                  Connected ({activeSessions.length > 0 ? `${activeSessions.length} active` : "Online"})
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                {boards.length > 0 ? (
                  boards.slice(0, 2).map((b, idx) => (
                    <div
                      key={b.id}
                      className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-foreground">{b.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Board #{String(idx + 1).padStart(2, "0")} • {b.boardType} ({b.fpgaFamily})
                        </div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" title="Online" />
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground">PYNQ-Z2 (Zynq-7000)</div>
                        <div className="text-[10px] text-muted-foreground">Board #01 • xc7z020clg400-1</div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" title="Online" />
                    </div>
                    <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground">Basys3 (Artix-7)</div>
                        <div className="text-[10px] text-muted-foreground">Board #02 • xc7a35tcpg236-1</div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" title="Online" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border text-center">
              <button
                onClick={() => setViewMode("workspace")}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Open IDE Workspace
              </button>
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FolderIcon className="w-5 h-5 text-blue-500" /> Recent Projects
            </h2>
            <span className="text-xs text-muted-foreground font-mono">{recentProjects.length} projects</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="p-4 bg-muted/40 border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground truncate">{p.name}</span>
                    <span className="text-[9px] px-2 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono font-bold rounded border border-blue-500/30">
                      {p.targetBoard}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate mt-1">{p.path}</div>
                  <div className="text-xs text-muted-foreground mt-2 font-medium">
                    Top Module: <span className="font-mono text-foreground">{p.topModule}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-[10px] text-muted-foreground">{p.lastModified}</span>
                  <button
                    onClick={() => {
                      setProjectName(p.name);
                      setTopModuleName(p.topModule);
                      setViewMode("workspace");
                    }}
                    className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded text-[11px] transition-colors"
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
