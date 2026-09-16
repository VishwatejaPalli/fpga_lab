"use client";

import { useRouter } from "next/navigation";

// --- Minimal Inline SVG Icons ---
function PinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.67V6a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4.67a2 2 0 0 1-1.11 1.88l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

function PackageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
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
    <div className="w-64 border-r border-border flex flex-col overflow-y-auto shrink-0 bg-muted/20 text-foreground transition-colors">
      <div className="p-3 border-b border-border bg-muted/40 font-bold text-[11px] uppercase tracking-wider text-foreground flex items-center justify-between">
        <span className="flex items-center gap-2">
          <PinIcon className="w-3.5 h-3.5 text-primary" />
          Flow Navigator
        </span>
        <span className="text-muted-foreground text-[9px] font-mono">v2026.1</span>
      </div>

      <div className="p-2 space-y-4 text-[12px] font-medium">
        <div>
          <div className="px-2 py-1.5 text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 bg-muted/30 rounded-md">
            <ChevronDownIcon className="w-3 h-3" /> PROJECT MANAGER
          </div>
          <div className="pl-4 space-y-1 mt-1">
            <button
              onClick={handleOpenSettings}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              <SettingsIcon className="w-4 h-4 text-primary" /> Settings
            </button>
            <button
              onClick={() => openTab("file:constraints/pynq_z2.xdc", "pynq_z2.xdc", "file")}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              <PlusIcon className="w-4 h-4 text-emerald-500" /> Add Sources
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1.5 text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 bg-muted/30 rounded-md">
            <ChevronDownIcon className="w-3 h-3" /> SIMULATION
          </div>
          <div className="pl-4 space-y-1 mt-1">
            <button
              onClick={handleRunSimulation}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold transition-colors"
            >
              <PlayIcon className="w-4 h-4 fill-emerald-500/20" /> Run Simulation
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1.5 text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 bg-muted/30 rounded-md">
            <ChevronDownIcon className="w-3 h-3" /> RTL ANALYSIS
          </div>
          <div className="pl-4 space-y-1 mt-1">
            <button
              onClick={handleRunSynthesis}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold transition-colors"
            >
              <PlayIcon className="w-4 h-4 fill-emerald-500/20" /> Run Linter
            </button>
            <button
              onClick={() => openTab("view:schematic", "Schematic Netlist", "view")}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              <SearchIcon className="w-4 h-4 text-blue-500" /> Open Elaborated Design
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1.5 text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 bg-muted/30 rounded-md">
            <ChevronDownIcon className="w-3 h-3" /> SYNTHESIS
          </div>
          <div className="pl-4 space-y-1 mt-1">
            <button
              onClick={handleRunSynthesis}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold transition-colors"
            >
              <PlayIcon className="w-4 h-4 fill-emerald-500/20" /> Run Synthesis
            </button>
            <button
              onClick={() => openTab("view:schematic", "Schematic Netlist", "view")}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              <FolderIcon className="w-4 h-4 text-blue-500" /> Open Synthesized Design
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1.5 text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 bg-muted/30 rounded-md">
            <ChevronDownIcon className="w-3 h-3" /> IMPLEMENTATION
          </div>
          <div className="pl-4 space-y-1 mt-1">
            <button
              onClick={handleRunImplementation}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold transition-colors"
            >
              <PlayIcon className="w-4 h-4 fill-emerald-500/20" /> Run Implementation
            </button>
            <button
              onClick={() => openTab("view:device", "Device Floorplan", "view")}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              <FolderIcon className="w-4 h-4 text-blue-500" /> Open Implemented Design
            </button>
          </div>
        </div>

        <div>
          <div className="px-2 py-1.5 text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 bg-muted/30 rounded-md">
            <ChevronDownIcon className="w-3 h-3" /> PROGRAM AND DEBUG
          </div>
          <div className="pl-4 space-y-1 mt-1">
            <button
              onClick={handleGenerateBitstream}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              <PackageIcon className="w-4 h-4 text-purple-500" /> Generate Bitstream
            </button>
            <button
              onClick={() => router.push("/program")}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-2 font-bold transition-colors"
            >
              <ZapIcon className="w-4 h-4 fill-amber-500/20 text-amber-500" /> Program Device
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
