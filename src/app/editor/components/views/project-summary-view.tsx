"use client";

import { Board } from "../../hooks/useProjectState";

// --- Minimal Inline SVG Icons ---
function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

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
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-foreground bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="text-primary font-black uppercase tracking-wider">PROJECT MANAGER</span>
            <span className="text-muted-foreground font-normal">- {projectName}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">FPGA Lab Design Suite Project Configuration</p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-muted/30 p-1 rounded-lg border border-border">
          {(["overview", "dashboard"] as const).map((sub) => (
            <button
              key={sub}
              onClick={() => setSummarySubtab(sub)}
              className={`px-4 py-1.5 rounded-md font-semibold capitalize transition-all ${
                summarySubtab === sub
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {summarySubtab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-bold text-sm text-foreground">Settings</h2>
              <button
                onClick={handleOpenSettings}
                className="text-primary hover:underline text-xs font-semibold"
              >
                Edit
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Project name:</span>
                <span className="text-foreground font-bold">{projectName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Project location:</span>
                <span className="text-muted-foreground truncate max-w-xs" title={projectPath}>{projectPath}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Product family:</span>
                <span className="text-foreground">{productFamily}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Project part:</span>
                <span className="text-primary font-bold">{projectPart}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Top module name:</span>
                <span className="text-primary font-bold">{topModuleName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Target language:</span>
                <span className="text-foreground">{targetLanguage}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-sans font-medium">Simulator language:</span>
                <span className="text-foreground">{simulatorLanguage}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground font-sans font-medium">Target Simulator:</span>
                <span className="text-foreground">{targetSimulator}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
              <div className="border-b border-border pb-3">
                <h2 className="font-bold text-sm text-foreground">Target Board</h2>
              </div>
              {boards.length > 0 ? (
                <div className="space-y-3">
                  <select
                    value={selectedBoardId}
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-xs bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.boardType}) — {b.status}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    Family: <span className="text-foreground">{boards.find((b) => b.id === selectedBoardId)?.fpgaFamily || "—"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-600 dark:text-amber-500 font-medium flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <AlertTriangleIcon className="w-4 h-4 shrink-0" />
                  No boards registered. Ask an admin to add boards.
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
              <h2 className="font-bold text-sm text-foreground border-b border-border pb-3">
                Design Flow Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRunSimulation}
                  className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors group"
                >
                  <PlayIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-500 group-hover:scale-110 transition-transform fill-emerald-500/20" /> Run Simulation
                </button>
                <button
                  onClick={handleRunSynthesis}
                  className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-700 dark:text-blue-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors group"
                >
                  <PlayIcon className="w-4 h-4 text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform fill-blue-500/20" /> Run Synthesis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {summarySubtab === "dashboard" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-500 font-mono tracking-tight">{lutUsage}%</div>
            <div className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">LUT Utilization</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-500 font-mono tracking-tight">{ffUsage}%</div>
            <div className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">FF Utilization</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500 font-mono tracking-tight">{wnsValue}</div>
            <div className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">WNS Timing Slack</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500 font-mono tracking-tight">{synthStatus}</div>
            <div className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">Synthesis Status</div>
          </div>
        </div>
      )}
    </div>
  );
}
