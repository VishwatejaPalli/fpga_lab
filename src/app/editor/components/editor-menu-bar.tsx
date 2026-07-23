"use client";

import { useRouter } from "next/navigation";

interface EditorMenuBarProps {
  activeMenu: string | null;
  setActiveMenu: (menu: string | null) => void;
  setIsNewProjectOpen: (open: boolean) => void;
  setViewMode: (mode: "welcome" | "workspace") => void;
  openTab: (id: string, label: string, type: "file" | "view") => void;
  handleOpenSettings: () => void;
  handleRunSimulation: () => void;
  handleRunSynthesis: () => void;
  handleRunImplementation: () => void;
  handleGenerateBitstream: () => void;
  setBottomDockTab: (tab: any) => void;
}

export default function EditorMenuBar({
  activeMenu,
  setActiveMenu,
  setIsNewProjectOpen,
  setViewMode,
  openTab,
  handleOpenSettings,
  handleRunSimulation,
  handleRunSynthesis,
  handleRunImplementation,
  handleGenerateBitstream,
  setBottomDockTab,
}: EditorMenuBarProps) {
  const router = useRouter();

  const menuItems = [
    {
      id: "file",
      label: "File",
      items: [
        { label: "New Project...", action: () => setIsNewProjectOpen(true) },
        { label: "Open Project...", action: () => setViewMode("welcome") },
        {
          label: "Add Sources... (Alt+A)",
          action: () => openTab("file:constraints/pynq_z2.xdc", "pynq_z2.xdc", "file"),
        },
        { label: "Simulation Waveform ▸", action: handleRunSimulation },
        { label: "Exit", action: () => router.push("/dashboard") },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { label: "Undo (Ctrl+Z)", action: () => {} },
        { label: "Redo (Ctrl+Shift+Z)", action: () => {} },
        { label: "Copy (Ctrl+C)", action: () => {} },
        { label: "Paste (Ctrl+V)", action: () => {} },
        { label: "Delete (Delete)", action: () => {} },
      ],
    },
    {
      id: "flow",
      label: "Flow",
      items: [
        {
          label: "Project Manager",
          action: () => {
            setViewMode("workspace");
            openTab("view:project_summary", "Project Summary", "view");
          },
        },
        { label: "Project Settings...", action: handleOpenSettings },
        { label: "Run Simulation", action: handleRunSimulation },
        {
          label: "Open Elaborated Design",
          action: () => {
            setViewMode("workspace");
            openTab("view:schematic", "Schematic Netlist", "view");
          },
        },
        { label: "Run Synthesis (F11)", action: handleRunSynthesis },
        { label: "Run Implementation", action: handleRunImplementation },
        { label: "Generate Bitstream", action: handleGenerateBitstream },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { label: "Getting Started Screen", action: () => setViewMode("welcome") },
        {
          label: "Project Summary",
          action: () => {
            setViewMode("workspace");
            openTab("view:project_summary", "Project Summary", "view");
          },
        },
        {
          label: "Schematic Netlist",
          action: () => {
            setViewMode("workspace");
            openTab("view:schematic", "Schematic Netlist", "view");
          },
        },
        {
          label: "Waveform Viewer",
          action: () => {
            setViewMode("workspace");
            openTab("view:waveform", "Behavioral Waveform", "view");
          },
        },
        {
          label: "Device Floorplan",
          action: () => {
            setViewMode("workspace");
            openTab("view:device", "Device Floorplan", "view");
          },
        },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      items: [
        {
          label: "Run Tcl Script...",
          action: () => {
            setViewMode("workspace");
            setBottomDockTab("tcl");
          },
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      items: [
        {
          label: "FPGA Lab Documentation",
          action: () => window.open("https://www.xilinx.com/support/documentation.html", "_blank"),
        },
        { label: "About FPGA Lab Design Suite", action: () => alert("FPGA Lab Design Suite v2026.1") },
      ],
    },
  ];

  return (
    <div className="h-7 px-2 flex items-center gap-1 text-[11px] relative font-medium bg-[#e6ecf7]">
      {menuItems.map((m) => (
        <div key={m.id} className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === m.id ? null : m.id)}
            className={`px-2.5 py-0.5 rounded hover:bg-[#2b579a]/10 font-medium transition-colors ${
              activeMenu === m.id ? "bg-[#2b579a] text-white font-bold" : "text-[#1e293b]"
            }`}
          >
            {m.label}
          </button>

          {activeMenu === m.id && (
            <div className="absolute top-full left-0 mt-0.5 w-56 bg-white border border-[#b0c4de] rounded-md shadow-xl z-50 py-1 text-slate-800">
              {m.items.map((it, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    it.action();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2b579a] hover:text-white text-[11px] transition-colors flex items-center justify-between"
                >
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Quick Search Bar */}
      <div className="ml-auto flex items-center gap-2">
        <input
          type="text"
          placeholder="Q- Quick Access"
          className="w-44 px-2 py-0.5 text-[10px] bg-white border border-[#cbd5e1] rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
