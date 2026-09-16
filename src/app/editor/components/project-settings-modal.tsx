"use client";

function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CpuIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function PuzzleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049.322-.059.648-.029.975.112 1.234 1.149 2.127 2.451 1.968a.39.39 0 0 1 .425.292c.3 1.196.4 2.408.28 3.593a.384.384 0 0 1-.32.33c-1.302.16-2.339 1.053-2.451 2.287-.03.327-.02.653.03.975a.396.396 0 0 1-.22.42c-1.077.5-2.22 1.056-3.35 1.549a.382.382 0 0 1-.41-.05c-.933-.873-2.316-1.066-3.374-.473-.244.136-.452.331-.614.577a.391.391 0 0 1-.36.19c-1.19-.05-2.38-.25-3.52-.61a.38.38 0 0 1-.27-.3c-.23-1.28-1.2-2.21-2.5-2.14a.39.39 0 0 1-.4-.28c-.46-1.13-.81-2.29-1.03-3.48a.39.39 0 0 1 .23-.42c1.17-.49 1.95-1.57 1.84-2.8-.02-.27-.08-.53-.16-.78a.393.393 0 0 1 .15-.46c.99-.7 2.06-1.28 3.2-1.74a.388.388 0 0 1 .43.08c1 .82 2.37.95 3.51.35.34-.18.63-.44.86-.77a.384.384 0 0 1 .37-.18c1.18.06 2.38.27 3.52.61.16.05.29.17.33.34Z" />
    </svg>
  );
}

function FlaskConicalIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.31L4.17 19.5A2 2 0 0 0 5.89 22h12.22a2 2 0 0 0 1.72-2.5L14 9.31V2" />
      <line x1="8" y1="2" x2="16" y2="2" />
      <line x1="8.5" y1="14" x2="15.5" y2="14" />
    </svg>
  );
}

function WrenchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border bg-muted/30 flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-primary" />
            <span>Project Settings</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="w-7 h-7 rounded-md hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className="w-52 border-r border-border bg-muted/10 p-3 flex flex-col gap-1">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Categories
            </div>
            {[
              { id: "general", label: "General", icon: SettingsIcon },
              { id: "simulation", label: "Simulation", icon: FlaskConicalIcon },
              { id: "synthesis", label: "Synthesis", icon: CpuIcon },
              { id: "implementation", label: "Implementation", icon: PuzzleIcon },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = settingsTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSettingsTab(item.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-card flex flex-col justify-between">
            <div>
              <div className="border-b border-border pb-4 mb-6">
                <h2 className="text-lg font-semibold capitalize text-foreground flex items-center gap-2">
                  {settingsTab === "general" && <SettingsIcon className="w-5 h-5 text-primary" />}
                  {settingsTab === "simulation" && <FlaskConicalIcon className="w-5 h-5 text-primary" />}
                  {settingsTab === "synthesis" && <CpuIcon className="w-5 h-5 text-primary" />}
                  {settingsTab === "implementation" && <PuzzleIcon className="w-5 h-5 text-primary" />}
                  {settingsTab} Settings
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure parameters used for compilation and simulation.
                </p>
              </div>

              {settingsTab === "general" && (
                <div className="space-y-5 text-sm">
                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Project Name</label>
                    <input
                      type="text"
                      value={draftProjectName}
                      onChange={(e) => setDraftProjectName(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-border rounded-md font-mono bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Target FPGA Device</label>
                    <select
                      value={draftProjectPart}
                      onChange={(e) => setDraftProjectPart(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-border rounded-md font-mono bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="pynq-z2 (xc7z020clg400-1)">pynq-z2 (xc7z020clg400-1)</option>
                      <option value="basys3 (xc7a35tcpg236-1)">basys3 (xc7a35tcpg236-1)</option>
                      <option value="arty-a7 (xc7a35tcsg324-1)">arty-a7 (xc7a35tcsg324-1)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Target HDL Language</label>
                    <select
                      value={draftTargetLanguage}
                      onChange={(e) => setDraftTargetLanguage(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Verilog">Verilog</option>
                      <option value="SystemVerilog">SystemVerilog</option>
                      <option value="VHDL">VHDL</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Top Module Name</label>
                    <input
                      type="text"
                      value={draftTopModule}
                      onChange={(e) => setDraftTopModule(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-border rounded-md font-mono bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {settingsTab === "simulation" && (
                <div className="space-y-5 text-sm">
                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Simulation Runtime</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={draftSimTime}
                        onChange={(e) => setDraftSimTime(Number(e.target.value))}
                        className="w-32 px-3 py-1.5 border border-border rounded-md font-mono bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-muted-foreground font-mono">ns</span>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "synthesis" && (
                <div className="space-y-5 text-sm">
                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Verilog Standard</label>
                    <select
                      value={draftVerilogVer}
                      onChange={(e) => setDraftVerilogVer(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Verilog 2001">Verilog 2001</option>
                      <option value="SystemVerilog 2012">SystemVerilog 2012</option>
                    </select>
                  </div>
                </div>
              )}

              {settingsTab === "implementation" && (
                <div className="space-y-5 text-sm">
                  <div className="flex items-center gap-4">
                    <label className="w-40 text-muted-foreground text-right font-medium">Constraints File</label>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value="constraints/pynq_z2.xdc"
                        disabled
                        className="w-full px-3 py-1.5 border border-border rounded-md font-mono bg-muted/50 text-muted-foreground cursor-not-allowed"
                      />
                      <WrenchIcon className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-5 mt-4 border-t border-border flex items-center justify-end gap-3 text-sm">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySettings}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-medium rounded-md transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md shadow-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
