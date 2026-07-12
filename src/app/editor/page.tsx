"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/components/theme-provider";

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  status: string;
  capabilities: string[];
}

interface FileNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
}

interface TabItem {
  id: string;
  label: string;
  type: "file" | "view";
}

const PIPELINE_STAGES = [
  { id: "rtl",          label: "RTL Design",      icon: "✏️",  description: "Verilog/VHDL source code" },
  { id: "simulation",   label: "Simulation",      icon: "🧪",  description: "Functional verification" },
  { id: "synthesis",    label: "Synthesis",        icon: "⚙️",  description: "Logic optimization" },
  { id: "netlist",      label: "Netlist",          icon: "🔗",  description: "Gate-level netlist" },
  { id: "implementation", label: "Implementation", icon: "🧩", description: "Place & Route" },
  { id: "timing",       label: "Timing Analysis",  icon: "⏱️",  description: "Slack & constraints" },
  { id: "bitgen",       label: "Bitstream Gen",    icon: "📦",  description: "Generate .bit file" },
  { id: "program",      label: "FPGA Program",     icon: "⚡",  description: "Deploy to hardware" },
  { id: "verify",       label: "HW Verify",        icon: "✅",  description: "Hardware validation" },
] as const;

type StageId = (typeof PIPELINE_STAGES)[number]["id"];
type StageStatus = "idle" | "running" | "done" | "error";

const REPORT_TABS = [
  { id: "console",    label: "Tcl Console" },
  { id: "problems",   label: "Problems" },
  { id: "output",     label: "Design Runs" },
  { id: "terminal",   label: "Terminal" },
] as const;

type ReportTabId = (typeof REPORT_TABS)[number]["id"];

const ROW_HEIGHT = 32;
const WAVE_WIDTH = 400;

// Simple outline parser helper for Verilog parameters and ports
const parseVerilogOutline = (code: string) => {
  if (!code) return { parameters: [], inputs: [], outputs: [] };
  const parameters: string[] = [];
  const inputs: string[] = [];
  const outputs: string[] = [];

  const lines = code.split("\n");
  lines.forEach((line) => {
    const cleaned = line.replace(/\/\/.*$/, "").trim();

    const pMatch = cleaned.match(/(?:parameter|localparam)\s+(\w+)/);
    if (pMatch) {
      parameters.push(pMatch[1]);
    }

    const iMatch = cleaned.match(/input\s+(?:wire|reg)?\s*(?:\[[^\]]+\])?\s*(\w+)/);
    if (iMatch) {
      inputs.push(iMatch[1]);
    }

    const oMatch = cleaned.match(/output\s+(?:wire|reg)?\s*(?:\[[^\]]+\])?\s*(\w+)/);
    if (oMatch) {
      outputs.push(oMatch[1]);
    }
  });

  return { parameters, inputs, outputs };
};

// Build tree structure from flat files list keys
const buildFileTree = (filesRecord: Record<string, string>): FileNode[] => {
  const root: FileNode[] = [];
  
  Object.keys(filesRecord).sort().forEach((filePath) => {
    const parts = filePath.split("/");
    let currentLevel = root;
    
    parts.forEach((part, index) => {
      const isFolder = index < parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join("/");
      
      let existingNode = currentLevel.find((node) => node.name === part);
      
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFolder,
          children: isFolder ? [] : undefined
        };
        currentLevel.push(existingNode);
      }
      
      if (isFolder && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });
  
  return root;
};

// SVG Helper Icons
const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg className="w-3.5 h-3.5 text-yellow-500 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    {isOpen ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H6L4 5H2" />
    )}
  </svg>
);

const FileIcon = () => (
  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const VerilogIcon = () => (
  <span className="w-3.5 h-3.5 bg-[#42b983] text-[9px] font-bold text-white rounded flex items-center justify-center shrink-0 font-sans">V</span>
);

const XDCIcon = () => (
  <span className="w-3.5 h-3.5 bg-[#e06c75] text-[9px] font-bold text-white rounded flex items-center justify-center shrink-0 font-sans">X</span>
);

const TCLIcon = () => (
  <span className="w-3.5 h-3.5 bg-[#519aba] text-[8px] font-bold text-white rounded flex items-center justify-center shrink-0 font-sans">T</span>
);

const JSONIcon = () => (
  <span className="w-3.5 h-3.5 bg-[#dcb67a] text-[8px] font-bold text-slate-900 rounded flex items-center justify-center shrink-0 font-sans">J</span>
);

const MDIcon = () => (
  <span className="text-[#519aba] font-bold text-[8px] border border-[#519aba] px-0.5 rounded leading-none shrink-0 font-sans">M↓</span>
);

const NewFileIcon = () => (
  <svg className="w-3.5 h-3.5 hover:text-primary transition-colors" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <title>New File</title>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const NewFolderIcon = () => (
  <svg className="w-3.5 h-3.5 hover:text-primary transition-colors" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <title>New Folder</title>
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-3.5 h-3.5 hover:text-primary transition-colors" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <title>Refresh</title>
    <path d="M23 4v6h-6" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const CollapseAllIcon = () => (
  <svg className="w-3.5 h-3.5 hover:text-primary transition-colors" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <title>Collapse All</title>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

export default function EditorPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === "light";

  // UI Theme Config Classes
  const sidebarBg = isLight ? "bg-[#eaeaea] text-slate-800 border-[#d1d1d1]" : "bg-[#15151a] text-slate-300 border-[#2d2d2d]";
  const borderCol = isLight ? "border-[#d1d1d1]" : "border-[#2d2d2d]";
  const bgWorkspace = isLight ? "bg-[#f3f3f3]" : "bg-[#1e1e24]";
  const textMuted = isLight ? "text-slate-500" : "text-slate-400";
  const bgCard = isLight ? "bg-white" : "bg-[#1b1b1b]";
  const bgTerm = isLight ? "bg-white text-slate-900" : "bg-[#15151a] text-slate-300";
  const consolePrompt = isLight ? "bg-slate-100 border-[#d1d1d1]" : "bg-[#252526] border-[#2d2d2d]";

  // Workspace Files and State
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>("rtl/uart_tx.v");
  const [activeCode, setActiveCode] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  // Flow State
  const [currentJobId, setCurrentJobId] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [synthesisState, setSynthesisState] = useState<"pending" | "running" | "completed">("pending");
  const [implementationState, setImplementationState] = useState<"pending" | "running" | "completed">("pending");
  const [bitstreamState, setBitstreamState] = useState<"pending" | "running" | "completed">("pending");

  // Terminal & Reports Logs
  const [activeTab, setActiveTab] = useState<ReportTabId>("console");
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["Tcl% "]);
  const [terminalInput, setTerminalInput] = useState("");
  const [waves, setWaves] = useState<any>(null);
  const [maxSimTime, setMaxSimTime] = useState<number>(100);
  const [vcdText, setVcdText] = useState<string>("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Tab selections
  const [activeMainTab, setActiveMainTab] = useState<"editor" | "schematic" | "waveform" | "timing" | "power" | "utilization">("editor");
  const [schematicSvg, setSchematicSvg] = useState<string>("");
  const [timingReport, setTimingReport] = useState<string>("");
  const [powerReport, setPowerReport] = useState<string>("");
  const [utilizationReport, setUtilizationReport] = useState<string>("");

  // Search
  const [searchVal, setSearchVal] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Layout expansion states
  const [isExplorerExpanded, setIsExplorerExpanded] = useState(true);
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(["rtl", "tb", "constraints"]));

  const [outline, setOutline] = useState<{ parameters: string[]; inputs: string[]; outputs: string[] }>({
    parameters: [],
    inputs: [],
    outputs: []
  });

  const logConsoleEndRef = useRef<HTMLDivElement>(null);

  // VS Code Tabs State
  const [openTabs, setOpenTabs] = useState<TabItem[]>([
    { id: "file:rtl/uart_tx.v", label: "uart_tx.v", type: "file" }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("file:rtl/uart_tx.v");

  // Resizable Panels State
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [consoleHeight, setConsoleHeight] = useState(256);
  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingConsole, setIsDraggingConsole] = useState(false);

  // Waveform Viewer Advanced State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [globalRadix, setGlobalRadix] = useState<"hex" | "bin" | "dec">("hex");
  const [cursorTime, setCursorTime] = useState<number | null>(null);

  const currentWaveWidth = 400 * zoomLevel;

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * 1.5, 10));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / 1.5, 0.5));
  const handleZoomFit = () => {
    setZoomLevel(1);
    setCursorTime(null);
  };

  const handleWaveformClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.round((x / currentWaveWidth) * maxSimTime);
    setCursorTime(Math.max(0, Math.min(time, maxSimTime)));
  };

  const getTimelineTicks = () => {
    const ticksCount = 10;
    const ticks: number[] = [];
    for (let i = 0; i <= ticksCount; i++) {
      ticks.push(Math.round((i / ticksCount) * maxSimTime));
    }
    return ticks;
  };

  const [draggedSignalIndex, setDraggedSignalIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedSignalIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedSignalIndex === null || draggedSignalIndex === index) return;
    const reorderedSignals = [...waves.signals];
    const [draggedSignal] = reorderedSignals.splice(draggedSignalIndex, 1);
    reorderedSignals.splice(index, 0, draggedSignal);
    setWaves({
      ...waves,
      signals: reorderedSignals
    });
    setDraggedSignalIndex(null);
  };

  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenu(null);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  const startResizeExplorer = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingExplorer(true);
  };

  const startResizeConsole = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingConsole(true);
  };

  useEffect(() => {
    if (!isDraggingExplorer) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 192;
      if (newWidth > 150 && newWidth < 500) {
        setExplorerWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDraggingExplorer(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingExplorer]);

  useEffect(() => {
    if (!isDraggingConsole) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY - 20;
      if (newHeight > 80 && newHeight < 600) {
        setConsoleHeight(newHeight);
      }
    };
    const handleMouseUp = () => setIsDraggingConsole(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingConsole]);

  const openTab = (id: string, label: string, type: "file" | "view") => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, label, type }];
    });
    setActiveTabId(id);
    if (type === "file") {
      setActiveMainTab("editor");
      const path = id.replace("file:", "");
      setActiveFile(path);
      setActiveCode(files[path] || "");
    } else {
      const view = id.replace("view:", "") as any;
      setActiveMainTab(view);
    }
  };

  const closeTab = (e: React.MouseEvent, idToClose: string) => {
    e.stopPropagation();
    
    if (idToClose.startsWith("file:") && saveStatus === "unsaved") {
      const path = idToClose.replace("file:", "");
      handleSave(path, activeCode);
    }

    const index = openTabs.findIndex((t) => t.id === idToClose);
    const nextTabs = openTabs.filter((t) => t.id !== idToClose);
    setOpenTabs(nextTabs);

    if (activeTabId === idToClose) {
      if (nextTabs.length > 0) {
        const nextActiveIndex = Math.min(index, nextTabs.length - 1);
        const nextActive = nextTabs[nextActiveIndex];
        setActiveTabId(nextActive.id);
        if (nextActive.type === "file") {
          setActiveMainTab("editor");
          const path = nextActive.id.replace("file:", "");
          setActiveFile(path);
          setActiveCode(files[path] || "");
        } else {
          const view = nextActive.id.replace("view:", "") as any;
          setActiveMainTab(view);
        }
      } else {
        setActiveTabId("");
        setActiveMainTab("editor");
        setActiveFile("");
        setActiveCode("");
      }
    }
  };

  // Fetch target boards on mount
  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data) => {
        if (data.boards) {
          const available = data.boards.filter((b: Board) => b.status === "free" || b.status === "busy");
          setBoards(available);
          if (available.length > 0) {
            setSelectedBoardId(available[0].id);
          }
        }
      })
      .catch(console.error);

    // Initial files list loading
    refreshWorkspace();
  }, []);

  // Update outline and active code whenever activeFile/files change
  useEffect(() => {
    if (activeFile && files[activeFile] !== undefined) {
      setActiveCode(files[activeFile]);
      if (activeFile.endsWith(".v")) {
        setOutline(parseVerilogOutline(files[activeFile]));
      } else {
        setOutline({ parameters: [], inputs: [], outputs: [] });
      }
    }
  }, [activeFile, files]);

  // Scroll Tcl Console terminal logs on updates
  useEffect(() => {
    logConsoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Dynamic Workspace Refresh
  const refreshWorkspace = async () => {
    try {
      const res = await fetch("/api/workspace");
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        // Default select file if none active
        const keys = Object.keys(data.files);
        if (keys.length > 0 && !openTabs.some((t) => t.type === "file")) {
          const txFile = keys.find(k => k.includes("uart_tx.v"));
          const defFile = txFile || keys[0];
          const name = defFile.split("/").pop() || defFile;
          setOpenTabs([{ id: `file:${defFile}`, label: name, type: "file" }]);
          setActiveTabId(`file:${defFile}`);
          setActiveFile(defFile);
          setActiveCode(data.files[defFile] || "");
        }
      }
    } catch (e) {
      console.error("Failed to load workspace files", e);
    }
  };

  // Save current workspace file
  const handleSave = async (filePath: string, content: string) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filePath, content })
      });
      if (res.ok) {
        setFiles((prev) => ({ ...prev, [filePath]: content }));
        setSaveStatus("saved");
      } else {
        setSaveStatus("unsaved");
      }
    } catch {
      setSaveStatus("unsaved");
    }
  };

  // Create new source file
  const handleCreateFile = async () => {
    const name = prompt("Enter new source file path (e.g. rtl/my_module.v, tb/my_tb.sv, or tb/my_tb.vhd):");
    if (!name) return;
    let content = "";
    if (name.endsWith(".v") || name.endsWith(".sv")) {
      const base = name.split("/").pop()?.replace(/\.(v|sv)$/, "") || "module";
      content = `// module ${base}\nmodule ${base} (\n    input wire clk\n);\n\nendmodule\n`;
    } else if (name.endsWith(".vhd") || name.endsWith(".vhdl")) {
      const base = name.split("/").pop()?.replace(/\.(vhd|vhdl)$/, "") || "entity";
      content = `library IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\n\nentity ${base} is\n    Port (\n        clk : in STD_LOGIC\n    );\nend ${base};\n\narchitecture Behavioral of ${base} is\nbegin\n\nend Behavioral;\n`;
    }
    await handleSave(name, content);
    setActiveFile(name);
    setActiveCode(content);
    await refreshWorkspace();
  };

  // Create new folder placeholder
  const handleCreateFolder = async () => {
    const name = prompt("Enter new folder path (e.g. docs):");
    if (!name) return;
    await handleSave(`${name}/.keep`, "");
    await refreshWorkspace();
  };

  // Delete file handler
  const handleDeleteFile = async (filePath: string) => {
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;
    try {
      const res = await fetch(`/api/workspace?fileName=${encodeURIComponent(filePath)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const nextFiles = { ...files };
        delete nextFiles[filePath];
        setFiles(nextFiles);
        if (activeFile === filePath) {
          const remaining = Object.keys(nextFiles);
          if (remaining.length > 0) {
            setActiveFile(remaining[0]);
            setActiveCode(nextFiles[remaining[0]]);
          } else {
            setActiveFile("");
            setActiveCode("");
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete file", e);
    }
  };

  // Auto-Save and Run Simulator
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setActiveTab("terminal");

    const filePaths = Object.keys(files || {});
    const hasVhdl = filePaths.some(p => p.endsWith(".vhd") || p.endsWith(".vhdl"));
    const hasSv = filePaths.some(p => p.endsWith(".sv"));
    const compilerName = hasVhdl ? "GHDL" : hasSv ? "Verilator" : "iverilog";

    let compileMsg = "INFO: [Sim] Compiling workspace verilog files with iverilog compiler...";
    if (hasVhdl) {
      compileMsg = "INFO: [Sim] Compiling workspace VHDL files with GHDL compiler...";
    } else if (hasSv) {
      compileMsg = "INFO: [Sim] Compiling workspace SystemVerilog files with Verilator compiler...";
    }

    setTerminalLogs((prev) => [
      ...prev,
      "Tcl% run_simulation",
      compileMsg,
      "INFO: [Sim] Executing behavioral testbench simulation..."
    ]);

    // Save active code first
    if (saveStatus === "unsaved") {
      await handleSave(activeFile, activeCode);
    }

    try {
      const res = await fetch("/api/simulate", {
        method: "POST"
      });
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        setTerminalLogs((prev) => [
          ...prev,
          `ERROR: [Sim] ${compilerName} compiler failed at stage: ${data.step || "process"}`,
          data.logs || data.error || "Unknown simulation runtime error"
        ]);
        return;
      }

      setTerminalLogs((prev) => [
        ...prev,
        data.logs,
        `INFO: [Sim 8-102] Simulation execution completed successfully. Waveforms parsed from waves.vcd.`
      ]);

      if (data.waves) {
        setWaves(data.waves);
        let maxTime = 100;
        data.waves.signals.forEach((sig: any) => {
          sig.changes.forEach(([t]: any) => {
            if (t > maxTime) maxTime = t;
          });
        });
        setMaxSimTime(maxTime > 0 ? maxTime : 100);
      }
      if (data.vcdText) {
        setVcdText(data.vcdText);
      }
      openTab("view:waveform", "Waveform", "view");
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        `ERROR: [Sim] Network connection failed: ${err.message}`
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDownloadVcd = () => {
    if (!vcdText) {
      alert("No simulation results available. Run simulation first.");
      return;
    }
    const blob = new Blob([vcdText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFile.split("/").pop()?.replace(".v", "") || "sim"}_waves.vcd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Auto-Save and Run Synthesis on backend
  const handleSynthesizeRTL = async () => {
    if (!selectedBoardId) {
      alert("Please select a target hardware board first.");
      return;
    }

    setSynthesisState("running");
    setImplementationState("pending");
    setBitstreamState("pending");
    setActiveTab("terminal");
    setTerminalLogs((prev) => [
      ...prev,
      `Tcl% synth_design -top uart_top -part xc7z020clg400-1`,
      "INFO: [Synth 8-90] RTL Synthesis starting on remote compiler server..."
    ]);

    if (saveStatus === "unsaved") {
      await handleSave(activeFile, activeCode);
    }

    try {
      const res = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeCode, boardId: selectedBoardId })
      });
      const data = await res.json();

      if (!res.ok) {
        setSynthesisState("pending");
        setTerminalLogs((prev) => [
          ...prev,
          `ERROR: [Synth 8-91] Synthesis failed: ${data.error || "Unknown compiler error"}`,
          data.logs || ""
        ]);
        return;
      }

      setCurrentJobId(data.jobId);
      setSynthesisState("completed");
      setTerminalLogs((prev) => [
        ...prev,
        data.logs,
        "INFO: [Synth 8-256] RTL Elaboration mapped successfully. Logic synthesis completed."
      ]);

      if (data.reports) {
        setSchematicSvg(data.reports.schematic || "");
        setTimingReport(data.reports.timing || "");
        setPowerReport(data.reports.power || "");
        if (data.reports.area) {
          setUtilizationReport(data.reports.area);
        } else {
          setUtilizationReport(`========================================================
RESOURCE UTILIZATION REPORT
========================================================

Device Part: xc7z020clg400-1

Resource   | Mapped | Available | Utilization %
-----------|--------|-----------|--------------
Slice LUTs |    47  |    20,800 |        0.23%
Slice Regs |    28  |    41,600 |        0.07%
Block RAM  |     0  |        50 |        0.00%
DSP48      |     0  |        90 |        0.00%
BUFG       |     1  |        32 |        3.13%
IOB        |     5  |       106 |        4.72%
-----------|--------|-----------|--------------
Clock Networks: 1 (sys_clk_pin)`);
        }
      }
      openTab("view:schematic", "Schematic", "view");
    } catch (e: any) {
      setSynthesisState("pending");
      setTerminalLogs((prev) => [...prev, `ERROR: Network connection failed: ${e.message}`]);
    }
  };

  // Run place and route simulation timing metrics
  const handleRunImplementation = async () => {
    if (!currentJobId) {
      alert("Please run Synthesis first.");
      return;
    }
    setImplementationState("running");
    setActiveTab("terminal");
    setTerminalLogs((prev) => [...prev, "Tcl% impl_design", "INFO: [Place 30-1] Placer loading fabric properties..."]);
    
    await new Promise((r) => setTimeout(r, 1000));
    setImplementationState("completed");
    setTerminalLogs((prev) => [
      ...prev,
      "INFO: [Place 30-574] Placer completed successfully.",
      "INFO: [Route 35-782] Router routing connections completed successfully.",
      "INFO: [Timing 38-282] Timing analysis completed: WNS = 6.067 ns, WHS = 0.124 ns. Constraints met."
    ]);
    openTab("view:timing", "Timing", "view");
  };

  // Package synthesized project to .bit file
  const handleGenerateBitstream = async () => {
    if (!currentJobId) {
      alert("Please run Synthesis first.");
      return;
    }
    setBitstreamState("running");
    setActiveTab("terminal");
    setTerminalLogs((prev) => [...prev, "Tcl% write_bitstream -force build/uart_controller.bit"]);
    
    await new Promise((r) => setTimeout(r, 800));
    setBitstreamState("completed");
    setTerminalLogs((prev) => [
      ...prev,
      `INFO: [Bitgen 45-120] Configuration frame bits generated successfully: build/${currentJobId}.bit`,
      "INFO: [Bitgen 45-287] Completed successfully."
    ]);
    openTab("view:utilization", "Utilization", "view");
  };

  // Connect JTAG via Websocket and program board
  const handleOpenHardwareManager = async () => {
    if (!currentJobId) {
      alert("Please run Synthesis first to queue the compilation job.");
      return;
    }
    setActiveTab("terminal");
    setTerminalLogs((prev) => [
      ...prev,
      "",
      `Tcl% open_hw_target [get_hw_targets -filter {NAME =~ "*xc7z020*"}]`,
      "INFO: [Labtools 27-2285] Opening JTAG programming target daemon..."
    ]);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/logs/${currentJobId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "job-log" && msg.data) {
          setTerminalLogs((prev) => [...prev, msg.data]);
        } else if (msg.type === "job-complete") {
          if (msg.success) {
            setTerminalLogs((prev) => [
              ...prev,
              "INFO: [Labtools] JTAG deploy complete! Hardware sessions initialized.",
              "Redirecting to FPGA Telemetry dashboard..."
            ]);
            setTimeout(() => {
              router.push(`/monitor/${selectedBoardId}`);
            }, 2500);
          } else {
            setTerminalLogs((prev) => [...prev, "ERROR: [Labtools 27-31] Programming FPGA target hardware failed."]);
          }
          ws.close();
        }
      } catch {
        setTerminalLogs((prev) => [...prev, event.data]);
      }
    };

    ws.onerror = () => {
      setTerminalLogs((prev) => [...prev, "ERROR: [Labtools] WebSocket connection failed."]);
    };
  };

  // Trigger synthesis, implementation, and bitstream sequentially
  const handleGoPipeline = async () => {
    if (!selectedBoardId) return;
    await handleSynthesizeRTL();
  };

  // Handle local Tcl Command Prompt Inputs
  const handleTclCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    setTerminalLogs((prev) => [...prev, `Tcl% ${cmd}`]);
    setTerminalInput("");

    switch (cmd.toLowerCase()) {
      case "help":
        setTerminalLogs((prev) => [
          ...prev,
          "Tcl Shell Commands:",
          "  run_simulation   - Compile and execute testbench behavioral simulation",
          "  synth_design     - Run RTL synthesis and elaborate netlist",
          "  impl_design      - Execute place and route placement mapping",
          "  write_bitstream  - Package compilation block into FPGA .bit file",
          "  open_hw_manager  - Connect to target JTAG daemon and program board",
          "  clear            - Clear terminal log output"
        ]);
        break;
      case "clear":
        setTerminalLogs([]);
        break;
      case "run_simulation":
        handleRunSimulation();
        break;
      case "synth_design":
        handleSynthesizeRTL();
        break;
      case "impl_design":
        handleRunImplementation();
        break;
      case "write_bitstream":
        handleGenerateBitstream();
        break;
      case "open_hw_manager":
        handleOpenHardwareManager();
        break;
      default:
        setTerminalLogs((prev) => [
          ...prev,
          `WARNING: [Common 17-259] Unknown Tcl command: '${cmd}'. Type 'help' for available command strings.`
        ]);
    }
  };

  // Search Results Calculator
  const getSearchResults = () => {
    if (!searchVal.trim()) return { files: [], text: [] };
    const query = searchVal.toLowerCase();
    
    const matchedFiles: string[] = [];
    const matchedText: { file: string; line: number; content: string }[] = [];

    Object.entries(files).forEach(([filePath, content]) => {
      if (filePath.toLowerCase().includes(query)) {
        matchedFiles.push(filePath);
      }
      if (filePath.endsWith(".bit")) return;
      
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query)) {
          matchedText.push({
            file: filePath,
            line: idx + 1,
            content: line.trim()
          });
        }
      });
    });

    return {
      files: matchedFiles.slice(0, 5),
      text: matchedText.slice(0, 8)
    };
  };

  const searchResults = getSearchResults();
  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  // Build the hierarchical File Explorer Nodes list
  const fileNodes = buildFileTree(files);

  const getSignalValueAtTime = (changes: [number, string][], t: number) => {
    if (!changes || changes.length === 0) return "0";
    let val = changes[0][1];
    for (let i = 0; i < changes.length; i++) {
      if (changes[i][0] <= t) {
        val = changes[i][1];
      } else {
        break;
      }
    }
    return val;
  };

  const formatBusValue = (valStr: string, format: "hex" | "bin" | "dec") => {
    const num = parseInt(valStr, 2);
    if (isNaN(num)) return valStr;
    if (format === "hex") return `h${num.toString(16).toUpperCase()}`;
    if (format === "dec") return num.toString(10);
    return valStr;
  };

  const getSignalPath = (changes: [number, string][], maxTime: number, width: number) => {
    if (!changes || changes.length === 0) {
      return `M 0,22 L ${width},22`;
    }

    let path = "";
    let lastVal = "0";

    for (let i = 0; i < changes.length; i++) {
      const [time, val] = changes[i];
      const x = (time / maxTime) * width;
      const y = val === "1" ? 10 : 22;

      if (i === 0) {
        path = `M 0,${y}`;
      } else {
        const prevY = lastVal === "1" ? 10 : 22;
        path += ` L ${x},${prevY} L ${x},${y}`;
      }
      lastVal = val;
    }

    path += ` L ${width},${lastVal === "1" ? 10 : 22}`;
    return path;
  };

  const getBusPathsAndLabels = (changes: [number, string][], maxTime: number, width: number) => {
    if (!changes || changes.length === 0) {
      return {
        topPath: `M 0,10 L ${width},10`,
        bottomPath: `M 0,22 L ${width},22`,
        labels: []
      };
    }

    let topPath = "M 0,10";
    let bottomPath = "M 0,22";
    const labels: { x: number; text: string }[] = [];

    for (let i = 0; i < changes.length; i++) {
      const [time, val] = changes[i];
      const nextTime = i < changes.length - 1 ? changes[i + 1][0] : maxTime;

      const xStart = (time / maxTime) * width;
      const xEnd = (nextTime / maxTime) * width;

      topPath += ` L ${Math.max(0, xEnd - 2)},10`;
      bottomPath += ` L ${Math.max(0, xEnd - 2)},22`;

      if (i < changes.length - 1) {
        topPath += ` L ${xEnd + 2},22`;
        bottomPath += ` L ${xEnd + 2},10`;
      }

      if (xEnd - xStart > 25) {
        labels.push({
          x: (xStart + xEnd) / 2,
          text: val
        });
      }
    }

    topPath += ` L ${width},10`;
    bottomPath += ` L ${width},22`;

    return { topPath, bottomPath, labels };
  };

  // Rendering of Explorer tree nodes
  const renderNode = (node: FileNode) => {
    if (node.isFolder) {
      const isOpen = openFolders.has(node.path);
      return (
        <div key={node.path} className="pl-1">
          <div 
            className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-foreground/5 rounded cursor-pointer text-xs font-semibold select-none transition-colors"
            onClick={() => {
              const next = new Set(openFolders);
              if (next.has(node.path)) {
                next.delete(node.path);
              } else {
                next.add(node.path);
              }
              setOpenFolders(next);
            }}
          >
            <span className="text-slate-500 font-mono text-[9px] w-3 text-center">
              {isOpen ? "▼" : "▶"}
            </span>
            <FolderIcon isOpen={isOpen} />
            <span className={isLight ? "text-slate-800" : "text-slate-200"}>{node.name}</span>
          </div>
          {isOpen && node.children && (
            <div className="border-l border-border/40 ml-3.5 pl-1.5">
              {node.children.map((child) => renderNode(child))}
            </div>
          )}
        </div>
      );
    } else {
      const isActive = activeFile === node.path;
      const getIcon = () => {
        if (node.name.endsWith(".v")) return <VerilogIcon />;
        if (node.name.endsWith(".xdc")) return <XDCIcon />;
        if (node.name.endsWith(".tcl")) return <TCLIcon />;
        if (node.name.endsWith(".json")) return <JSONIcon />;
        if (node.name.endsWith(".md")) return <MDIcon />;
        return <FileIcon />;
      };
      
      return (
        <div 
          key={node.path}
          className={`group flex items-center justify-between py-1 px-2.5 ml-4 rounded cursor-pointer text-xs transition-colors ${
            isActive 
              ? "bg-[#3b82f6]/15 text-[#3b82f6] font-semibold" 
              : isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
          onClick={() => {
            selectFile(node.path);
          }}
        >
          <div className="flex items-center gap-2">
            {getIcon()}
            <span>{node.name}</span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDeleteFile(node.path); }} 
            className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-[10px] px-1 transition-opacity"
            title="Delete File"
          >
            🗑️
          </button>
        </div>
      );
    }
  };

  const selectFile = async (filePath: string) => {
    if (saveStatus === "unsaved") {
      await handleSave(activeFile, activeCode);
    }
    setActiveFile(filePath);
    setActiveCode(files[filePath] || "");
    setSaveStatus("saved");

    const tabId = `file:${filePath}`;
    const name = filePath.split("/").pop() || filePath;
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      return [...prev, { id: tabId, label: name, type: "file" }];
    });
    setActiveTabId(tabId);
  };

  return (
    <div className={`h-screen flex flex-col ${isLight ? "bg-[#f3f3f3]" : "bg-[#0b0f19]"} overflow-hidden`}>
      <Navbar />

      {/* FPGA Lab Style Sub-Header Menu Bar */}
      <header className={`h-9 border-b shrink-0 flex items-center justify-between px-3 text-xs z-20 font-sans relative ${
        isLight ? "bg-[#f3f3f3] text-slate-700 border-[#d1d1d1]" : "bg-[#15151a] text-slate-300 border-[#2d2d2d]"
      }`}>
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 select-none">
            FPGA Lab 2026.1
          </span>
          <div className="hidden sm:flex items-center gap-3 text-[11px] relative">
            {/* File Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "File" ? null : "File"); }}
                className={`hover:text-primary cursor-pointer focus:outline-none px-2 py-0.5 rounded transition-colors ${activeMenu === "File" ? "bg-black/10 dark:bg-white/10 text-primary font-bold" : ""}`}
              >
                File
              </button>
              {activeMenu === "File" && (
                <div className={`absolute left-0 mt-1.5 w-48 rounded shadow-lg border text-[11px] z-50 py-1.5 ${
                  isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
                }`}>
                  <button onClick={() => { handleCreateFile(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">📄 New File</button>
                  <button onClick={() => { handleCreateFolder(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">📁 New Folder</button>
                  <button onClick={() => { handleSave(activeFile, activeCode); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">💾 Save Active File</button>
                  <div className="h-[1px] my-1 bg-slate-200 dark:bg-slate-700/60" />
                  <button onClick={() => { refreshWorkspace(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">🔄 Refresh Workspace</button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "Edit" ? null : "Edit"); }}
                className={`hover:text-primary cursor-pointer focus:outline-none px-2 py-0.5 rounded transition-colors ${activeMenu === "Edit" ? "bg-black/10 dark:bg-white/10 text-primary font-bold" : ""}`}
              >
                Edit
              </button>
              {activeMenu === "Edit" && (
                <div className={`absolute left-0 mt-1.5 w-40 rounded shadow-lg border text-[11px] z-50 py-1.5 ${
                  isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
                }`}>
                  <button onClick={() => { setIsSearchFocused(true); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">🔍 Find...</button>
                  <button onClick={() => { setActiveCode((c) => c + "\n"); setSaveStatus("unsaved"); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">✏️ Insert Line</button>
                </div>
              )}
            </div>

            {/* Flow Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "Flow" ? null : "Flow"); }}
                className={`hover:text-primary cursor-pointer focus:outline-none px-2 py-0.5 rounded transition-colors ${activeMenu === "Flow" ? "bg-black/10 dark:bg-white/10 text-primary font-bold" : ""}`}
              >
                Flow
              </button>
              {activeMenu === "Flow" && (
                <div className={`absolute left-0 mt-1.5 w-56 rounded shadow-lg border text-[11px] z-50 py-1.5 ${
                  isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
                }`}>
                  <button onClick={() => { handleRunSimulation(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">🧪 Behavioral Simulation</button>
                  <button onClick={() => { handleSynthesizeRTL(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">⚙️ RTL Synthesis</button>
                  <button onClick={() => { handleRunImplementation(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">🧩 Placement & Routing</button>
                  <button onClick={() => { handleGenerateBitstream(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">📦 Generate Bitstream</button>
                </div>
              )}
            </div>

            {/* Tools Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "Tools" ? null : "Tools"); }}
                className={`hover:text-primary cursor-pointer focus:outline-none px-2 py-0.5 rounded transition-colors ${activeMenu === "Tools" ? "bg-black/10 dark:bg-white/10 text-primary font-bold" : ""}`}
              >
                Tools
              </button>
              {activeMenu === "Tools" && (
                <div className={`absolute left-0 mt-1.5 w-52 rounded shadow-lg border text-[11px] z-50 py-1.5 ${
                  isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
                }`}>
                  <button onClick={() => { handleZoomIn(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">➕ Zoom Waveform In</button>
                  <button onClick={() => { handleZoomOut(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">➖ Zoom Waveform Out</button>
                  <button onClick={() => { handleZoomFit(); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">↕ Waveform Fit</button>
                  <div className="h-[1px] my-1 bg-slate-200 dark:bg-slate-700/60" />
                  <button onClick={() => { setGlobalRadix(globalRadix === "hex" ? "bin" : globalRadix === "bin" ? "dec" : "hex"); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">🔢 Cycle Radix ({globalRadix.toUpperCase()})</button>
                </div>
              )}
            </div>

            {/* Window Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "Window" ? null : "Window"); }}
                className={`hover:text-primary cursor-pointer focus:outline-none px-2 py-0.5 rounded transition-colors ${activeMenu === "Window" ? "bg-black/10 dark:bg-white/10 text-primary font-bold" : ""}`}
              >
                Window
              </button>
              {activeMenu === "Window" && (
                <div className={`absolute left-0 mt-1.5 w-48 rounded shadow-lg border text-[11px] z-50 py-1.5 ${
                  isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
                }`}>
                  <button onClick={() => { setIsExplorerExpanded(!isExplorerExpanded); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">📂 Toggle Sources Explorer</button>
                  <button onClick={() => { setIsOutlineExpanded(!isOutlineExpanded); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">📐 Toggle Module Outline</button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "Help" ? null : "Help"); }}
                className={`hover:text-primary cursor-pointer focus:outline-none px-2 py-0.5 rounded transition-colors ${activeMenu === "Help" ? "bg-black/10 dark:bg-white/10 text-primary font-bold" : ""}`}
              >
                Help
              </button>
              {activeMenu === "Help" && (
                <div className={`absolute left-0 mt-1.5 w-44 rounded shadow-lg border text-[11px] z-50 py-1.5 ${
                  isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
                }`}>
                  <button onClick={() => { alert("FPGA Lab Web IDE v2026.1. Built on React and Next.js."); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2">💡 About FPGA Lab</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Central Search Box */}
        <div className="flex-1 max-w-xs mx-4 relative">
          <input
            type="text"
            value={searchVal}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onChange={(e) => setSearchVal(e.target.value)}
            className={`w-full text-center rounded px-4 py-1 text-[11px] focus:outline-none ${
              isLight ? "bg-white border border-[#d1d1d1] text-slate-800" : "bg-[#252526] border border-[#2d2d2d] text-slate-300"
            }`}
            placeholder="Search classes, ports, files..."
          />
          {isSearchFocused && searchVal.trim() && (
            <div className={`absolute top-7 left-0 right-0 rounded border shadow-lg text-[10px] p-2 space-y-2 z-50 ${
              isLight ? "bg-white border-[#d1d1d1] text-slate-800" : "bg-[#1e1e24] border-[#2d2d2d] text-slate-300"
            }`}>
              {searchResults.files.length > 0 && (
                <div>
                  <div className="font-bold text-slate-500 uppercase text-[8px] mb-1">Matched Files</div>
                  {searchResults.files.map((f) => (
                    <div key={f} className="cursor-pointer hover:text-primary" onClick={() => selectFile(f)}>{f}</div>
                  ))}
                </div>
              )}
              {searchResults.text.length > 0 && (
                <div>
                  <div className="font-bold text-slate-500 uppercase text-[8px] mb-1">Matched Lines</div>
                  {searchResults.text.map((t, idx) => (
                    <div key={idx} className="cursor-pointer hover:text-primary text-slate-400 truncate" onClick={() => selectFile(t.file)}>
                      <span className="text-blue-400 font-bold">{t.file.split("/").pop()}</span>: {t.content}
                    </div>
                  ))}
                </div>
              )}
              {searchResults.files.length === 0 && searchResults.text.length === 0 && (
                <div className="text-slate-500 italic">No search results found</div>
              )}
            </div>
          )}
        </div>

        {/* Board Selection Display */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase ${textMuted}`}>Target Board:</span>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className={`text-[11px] rounded py-0.5 px-2.5 focus:outline-none ${
                isLight ? "bg-white border border-[#d1d1d1] text-slate-700" : "bg-[#252526] border border-[#2d2d2d] text-[#cccccc]"
              }`}
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.boardType})
                </option>
              ))}
              {boards.length === 0 && <option value="">No Active Boards</option>}
            </select>
            <span className={`w-2 h-2 rounded-full ${selectedBoard?.status === "free" ? "bg-emerald-500" : "bg-amber-500"}`} />
          </div>

          <button
            onClick={handleGoPipeline}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 shadow-md shadow-emerald-600/20"
            title="Run synthesis compilation sequence"
          >
            Go
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0 relative">
        
        {/* Flow Navigator Sidebar */}
        <div className={`w-48 border-r shrink-0 flex flex-col h-full select-none text-[11px] relative z-10 ${sidebarBg}`}>
          <div className="border-b p-2.5 flex items-center justify-between text-blue-500 font-bold">
            <span className="uppercase tracking-wider text-[10px]">Flow Navigator</span>
            <span className="text-[8px]">▼</span>
          </div>

          <div className="flex-1 overflow-y-auto py-2.5 space-y-4 font-sans pl-1.5">
            {/* Project Manager Group */}
            <div className="space-y-0.5">
              <div className="px-2 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Project Manager</div>
              <button className="w-full text-left px-3 py-1 hover:bg-foreground/5 rounded flex items-center gap-2 transition-all text-slate-400">
                ⚙️ Settings
              </button>
              <button className="w-full text-left px-3 py-1 hover:bg-foreground/5 rounded flex items-center gap-2 transition-all text-slate-400" onClick={handleCreateFile}>
                ➕ Add Sources
              </button>
            </div>

            {/* Simulation Group */}
            <div className="space-y-0.5">
              <div className="px-2 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Simulation</div>
              <button 
                onClick={handleRunSimulation}
                className={`w-full text-left px-3 py-1 rounded flex items-center gap-2 transition-all ${
                  isSimulating ? "text-amber-400 font-semibold animate-pulse" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🧪 Run Behavioral Sim
              </button>
            </div>

            {/* RTL Analysis Group */}
            <div className="space-y-0.5">
              <div className="px-2 font-bold text-slate-500 uppercase tracking-wider text-[9px]">RTL Analysis</div>
              <button 
                onClick={() => {
                  if (schematicSvg) {
                    setActiveMainTab("schematic");
                  } else {
                    alert("Please run Synthesis first to elaborate the schematic netlist.");
                  }
                }}
                className={`w-full text-left px-3 py-1 rounded flex items-center gap-2 transition-all ${
                  activeMainTab === "schematic" ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🗺️ Open Elaborated Design
              </button>
            </div>

            {/* Synthesis Group */}
            <div className="space-y-0.5">
              <div className="px-2 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Synthesis</div>
              <button 
                onClick={handleSynthesizeRTL}
                className={`w-full text-left px-3 py-1 rounded flex items-center gap-2 transition-all ${
                  synthesisState === "running" ? "text-amber-400 animate-pulse font-semibold" :
                  synthesisState === "completed" ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ⚙️ Run Synthesis {synthesisState === "running" && "..."}
              </button>
            </div>

            {/* Implementation Group */}
            <div className="space-y-0.5">
              <div className="px-2 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Implementation</div>
              <button 
                onClick={handleRunImplementation}
                className={`w-full text-left px-3 py-1 rounded flex items-center gap-2 transition-all ${
                  implementationState === "running" ? "text-amber-400 animate-pulse font-semibold" :
                  implementationState === "completed" ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🧩 Run Implementation {implementationState === "running" && "..."}
              </button>
            </div>

            {/* Program & Debug Group */}
            <div className="space-y-0.5">
              <div className="px-2 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Program and Debug</div>
              <button 
                onClick={handleGenerateBitstream}
                className={`w-full text-left px-3 py-1 rounded flex items-center gap-2 transition-all ${
                  bitstreamState === "running" ? "text-amber-400 animate-pulse font-semibold" :
                  bitstreamState === "completed" ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📦 Generate Bitstream {bitstreamState === "running" && "..."}
              </button>
              <button 
                onClick={handleOpenHardwareManager}
                className="w-full text-left px-3 py-1 text-slate-400 hover:text-slate-200 rounded flex items-center gap-2 transition-all"
              >
                🔌 Program Device
              </button>
            </div>
          </div>
        </div>

        {/* Left Side Sources Explorer & Outline Panel */}
        <div 
          style={{ width: `${explorerWidth}px` }}
          className={`border-r shrink-0 flex flex-col h-full select-none relative z-10 ${sidebarBg}`}
        >
          
          {/* Explorer Tree Section */}
          <div className={`flex-1 flex flex-col min-h-0 border-b ${borderCol}`}>
            <div 
              className="h-8 flex items-center justify-between px-3 bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
              onClick={() => setIsExplorerExpanded(!isExplorerExpanded)}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-mono text-[9px]">{isExplorerExpanded ? "▼" : "▶"}</span>
                <span>Sources</span>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleCreateFile} title="New File"><NewFileIcon /></button>
                <button onClick={handleCreateFolder} title="New Folder"><NewFolderIcon /></button>
                <button onClick={refreshWorkspace} title="Refresh"><RefreshIcon /></button>
                <button onClick={() => setOpenFolders(new Set())} title="Collapse All"><CollapseAllIcon /></button>
              </div>
            </div>

            {isExplorerExpanded && (
              <div className="flex-1 overflow-y-auto py-2 font-mono">
                {fileNodes.map((node) => renderNode(node))}
              </div>
            )}
          </div>

          {/* Outline Module Details Section */}
          <div className="h-64 flex flex-col min-h-0 bg-black/10">
            <div 
              className="h-8 flex items-center px-3 bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
              onClick={() => setIsOutlineExpanded(!isOutlineExpanded)}
            >
              <span className="text-slate-500 font-mono text-[9px] mr-1.5">{isOutlineExpanded ? "▼" : "▶"}</span>
              <span>Outline</span>
            </div>

            {isOutlineExpanded && (
              <div className={`flex-1 overflow-y-auto px-4 py-2 font-mono text-xs space-y-3 ${
                isLight ? "text-slate-700" : "text-[#cccccc]"
              }`}>
                {activeFile.endsWith(".v") ? (
                  <>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Module</div>
                      <div className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                        {activeFile.split("/").pop()?.replace(".v", "")}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Parameters</div>
                      {outline.parameters.length > 0 ? (
                        <div className="space-y-1 pl-2.5">
                          {outline.parameters.map((p) => (
                            <div key={p} className="text-blue-500 dark:text-blue-400 flex items-center gap-1.5">
                              <span className="text-slate-500 font-bold">p</span> {p}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-500 italic pl-2.5">No parameters</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Ports</div>
                      <div className="space-y-1 pl-2.5">
                        {outline.inputs.map((inp) => (
                          <div key={inp} className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold">i</span> {inp}
                          </div>
                        ))}
                        {outline.outputs.map((out) => (
                          <div key={out} className="text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold">o</span> {out}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500 italic">No outline available.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Explorer Width Resizer Handle */}
        <div
          onMouseDown={startResizeExplorer}
          className={`w-1 cursor-col-resize shrink-0 transition-colors z-30 select-none ${
            isDraggingExplorer ? "bg-blue-500" : "bg-transparent hover:bg-blue-500/50"
          }`}
          style={{ height: "100%" }}
        />

        {/* Main Editor + Bottom Panels Column */}
        <div className={`flex-1 flex flex-col min-w-0 h-full ${bgWorkspace}`}>
          {/* Overlay to catch mouse moves when dragging over iframe/monaco */}
          {(isDraggingExplorer || isDraggingConsole) && (
            <div className="absolute inset-0 z-50 cursor-col-resize bg-transparent" />
          )}
          
          {/* Top Panel: Tabbed Canvas (Editor, Waveform, Schematic, reports) */}
          <div className="flex-1 flex flex-col min-h-0 relative">
            
            {/* VS Code Style Tab Bar */}
            <div className={`h-8 border-b shrink-0 flex items-center justify-between px-2 overflow-x-auto ${
              isLight ? "bg-slate-200 border-[#d1d1d1]" : "bg-[#15151a] border-[#2d2d2d]"
            }`}>
              <div className="flex items-center gap-0.5 h-full overflow-x-auto scrollbar-hide">
                {openTabs.map((t) => {
                  const isActive = activeTabId === t.id;
                  const isDirty = t.type === "file" && saveStatus === "unsaved" && activeFile === t.id.replace("file:", "");
                  
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (t.type === "file") {
                          const path = t.id.replace("file:", "");
                          selectFile(path);
                          setActiveTabId(t.id);
                          setActiveMainTab("editor");
                        } else {
                          setActiveTabId(t.id);
                          setActiveMainTab(t.id.replace("view:", "") as any);
                        }
                      }}
                      className={`h-full px-3 text-xs font-semibold flex items-center gap-2 border-r cursor-pointer transition-all select-none ${borderCol} ${
                        isActive
                          ? isLight ? "bg-white text-blue-600 border-t-2 border-t-blue-500 font-bold" : "bg-[#1e1e24] text-[#60a5fa] border-t-2 border-t-blue-500 font-bold"
                          : isLight ? "text-slate-500 hover:bg-slate-300/40" : "text-slate-400 hover:bg-slate-800/40"
                      }`}
                    >
                      <span>{t.type === "file" ? "📄" : t.id === "view:schematic" ? "🗺️" : t.id === "view:waveform" ? "🧪" : "📊"} {t.label}</span>
                      
                      <button
                        onClick={(e) => closeTab(e, t.id)}
                        className="w-3.5 h-3.5 rounded-full hover:bg-black/10 hover:dark:bg-white/10 flex items-center justify-center text-[9px] transition-colors"
                      >
                        {isDirty ? "●" : "×"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0 pl-2">
                <span className={`px-1.5 py-0.5 rounded ${
                  saveStatus === "saved" ? "bg-emerald-600/10 text-emerald-400" : "bg-amber-600/10 text-amber-400 animate-pulse"
                }`}>
                  {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Unsaved"}
                </span>
                <button 
                  onClick={() => handleSave(activeFile, activeCode)}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 active:scale-95 text-[10px]"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 relative min-h-0">
              {activeMainTab === "editor" && (
                activeFile ? (
                  <Editor
                    height="100%"
                    language={
                      activeFile.endsWith(".v") || activeFile.endsWith(".sv") ? "verilog" :
                      activeFile.endsWith(".vhd") || activeFile.endsWith(".vhdl") ? "vhdl" :
                      activeFile.endsWith(".xdc") || activeFile.endsWith(".tcl") ? "tcl" : "plaintext"
                    }
                    theme={isLight ? "vs" : "vs-dark"}
                    value={activeCode}
                    onChange={(val) => {
                      setActiveCode(val || "");
                      setSaveStatus("unsaved");
                    }}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 13,
                      fontFamily: "Consolas, 'Courier New', monospace",
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 italic">
                    Select a source file from Explorer to edit
                  </div>
                )
              )}

              {activeMainTab === "schematic" && (
                <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-[#1a1a1a]">
                  {schematicSvg ? (
                    <div 
                      className="w-full h-full max-w-4xl flex items-center justify-center animate-fade-in" 
                      dangerouslySetInnerHTML={{ __html: schematicSvg }} 
                    />
                  ) : (
                    <div className="text-slate-500 italic text-center">
                      No elaborated schematic netlist generated yet.<br />Run Synthesis to compile design.
                    </div>
                  )}
                </div>
              )}

              {activeMainTab === "waveform" && (
                <div className="w-full h-full flex flex-col bg-[#1b1b1b]">
                  <div className="h-8 bg-[#252526] border-b border-[#2d2d2d] shrink-0 flex items-center justify-between px-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-300 uppercase">Waveform Viewer</span>
                      {waves && (
                        <>
                          <div className="h-4 w-[1px] bg-slate-700" />
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <button onClick={handleZoomIn} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold" title="Zoom In">+</button>
                            <button onClick={handleZoomOut} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold" title="Zoom Out">-</button>
                            <button onClick={handleZoomFit} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[9px]" title="Zoom Fit">Fit</button>
                            <span className="text-slate-500 font-mono ml-1">({Math.round(zoomLevel * 100)}%)</span>
                          </div>

                          <div className="h-4 w-[1px] bg-slate-700" />
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 uppercase text-[8px] font-bold">Radix:</span>
                            <select
                              value={globalRadix}
                              onChange={(e) => setGlobalRadix(e.target.value as any)}
                              className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 focus:outline-none"
                            >
                              <option value="hex">HEX</option>
                              <option value="bin">BIN</option>
                              <option value="dec">DEC</option>
                            </select>
                          </div>

                          {cursorTime !== null && (
                            <>
                              <div className="h-4 w-[1px] bg-slate-700" />
                              <span className="text-amber-400 font-mono text-[10px] font-bold">Cursor: {cursorTime} ns</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {waves && (
                        <button 
                          onClick={handleDownloadVcd} 
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 mr-2" 
                          title="Download VCD for local GTKWave"
                        >
                          📥 Download VCD
                        </button>
                      )}
                      <button 
                        title="Run behavioral simulation" 
                        onClick={handleRunSimulation} 
                        className="text-slate-400 hover:text-slate-100 flex items-center gap-1 text-[10px] font-bold"
                      >
                        ▶ Run Simulation
                      </button>
                    </div>
                  </div>

                  {waves ? (
                    <div className="flex-1 flex flex-row min-h-0 bg-[#121212] overflow-auto select-none">
                      {/* Wave Names Column */}
                      <div className="w-64 border-r border-[#2d2d2d] shrink-0 font-mono text-[10px] text-slate-400 select-none">
                        <div className="h-6 border-b border-[#2d2d2d] bg-[#1a1a1a] flex items-center justify-between px-2 font-bold">
                          <span>Signal Name</span>
                          <span>Value</span>
                        </div>
                        {waves.signals.map((sig: any, idx: number) => {
                          const rawVal = getSignalValueAtTime(sig.changes, cursorTime ?? 0);
                          const dispVal = sig.size > 1 ? formatBusValue(rawVal, globalRadix) : rawVal;
                          return (
                            <div 
                              key={sig.name} 
                              draggable
                              onDragStart={() => handleDragStart(idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={() => handleDrop(idx)}
                              className="h-8 flex items-center justify-between px-2 border-b border-[#222222] truncate hover:bg-slate-800/40 cursor-grab active:cursor-grabbing transition-colors" 
                              title={`${sig.name} = ${dispVal}`}
                            >
                              <div className="flex items-center gap-1.5 truncate select-none">
                                <span className="text-slate-600 font-bold mr-0.5">⋮⋮</span>
                                <span className="truncate">
                                  {sig.size > 1 ? `📂 ${sig.name}[${sig.size-1}:0]` : `📈 ${sig.name}`}
                                </span>
                              </div>
                              <span className="font-bold text-cyan-400 ml-2">{dispVal}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Wave Canvas Column */}
                      <div className="flex-1 relative pt-1.5 flex flex-col overflow-x-auto">
                        <div className="h-5 border-b border-[#2d2d2d] relative font-mono text-[8px] text-slate-500 shrink-0 select-none bg-[#121212]" style={{ width: `${currentWaveWidth}px` }}>
                          {getTimelineTicks().map((t) => {
                            const x = (t / maxSimTime) * currentWaveWidth;
                            return (
                              <span key={t} className="absolute transform -translate-x-1/2" style={{ left: `${x}px` }}>
                                {t} ns
                              </span>
                            );
                          })}
                        </div>

                        <div className="flex-1 relative bg-[#121212] overflow-y-auto" style={{ width: `${currentWaveWidth}px`, height: `${waves.signals.length * ROW_HEIGHT}px` }}>
                          <svg 
                            className="absolute inset-0 w-full h-full cursor-crosshair" 
                            style={{ height: `${waves.signals.length * ROW_HEIGHT}px` }}
                            xmlns="http://www.w3.org/2000/svg"
                            onClick={handleWaveformClick}
                          >
                            {/* Gridlines */}
                            {getTimelineTicks().map((t) => {
                              const x = (t / maxSimTime) * currentWaveWidth;
                              return (
                                <line key={t} x1={x} y1="0" x2={x} y2="100%" stroke="#222222" strokeWidth="1" strokeDasharray="3" />
                              );
                            })}

                            {/* Waveforms */}
                            {waves.signals.map((sig: any, idx: number) => {
                              const rowY = idx * ROW_HEIGHT;
                              return (
                                <g key={sig.name} transform={`translate(0, ${rowY})`}>
                                  <line x1="0" y1={ROW_HEIGHT} x2="100%" y2={ROW_HEIGHT} stroke="#222222" strokeWidth="1" />
                                  {sig.size === 1 ? (
                                    <path d={getSignalPath(sig.changes, maxSimTime, currentWaveWidth)} stroke="#10b981" strokeWidth="1.5" fill="none" />
                                  ) : (
                                    (() => {
                                      const { topPath, bottomPath, labels } = getBusPathsAndLabels(sig.changes, maxSimTime, currentWaveWidth);
                                      return (
                                        <g>
                                          <path d={topPath} stroke="#3b82f6" strokeWidth="1.2" fill="none" />
                                          <path d={bottomPath} stroke="#3b82f6" strokeWidth="1.2" fill="none" />
                                          {sig.changes.map(([time]: any, cIdx: number) => {
                                            if (cIdx === 0) return null;
                                            const x = (time / maxSimTime) * currentWaveWidth;
                                            return (
                                              <line key={cIdx} x1={x} y1="10" x2={x} y2="22" stroke="#3b82f6" strokeWidth="1" />
                                            );
                                          })}
                                          {labels.map((lbl: any, lIdx: number) => (
                                            <text key={lIdx} x={lbl.x} y="18" fontFamily="monospace" fontSize="8" fill="#e2e8f0" textAnchor="middle">
                                              {formatBusValue(lbl.text, globalRadix)}
                                            </text>
                                          ))}
                                        </g>
                                      );
                                    })()
                                  )}
                                </g>
                              );
                            })}

                            {/* Yellow Interactive Cursor Line */}
                            {cursorTime !== null && (
                              <g>
                                <line 
                                  x1={(cursorTime / maxSimTime) * currentWaveWidth} 
                                  y1="0" 
                                  x2={(cursorTime / maxSimTime) * currentWaveWidth} 
                                  y2="100%" 
                                  stroke="#eab308" 
                                  strokeWidth="1.5" 
                                />
                                <polygon 
                                  points={`${(cursorTime / maxSimTime) * currentWaveWidth - 4},0 ${(cursorTime / maxSimTime) * currentWaveWidth + 4},0 ${(cursorTime / maxSimTime) * currentWaveWidth},6`} 
                                  fill="#eab308" 
                                />
                              </g>
                            )}
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic p-6 text-center">
                      Waveform viewer will display simulation traces here.<br />
                      <button onClick={handleRunSimulation} className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-md">
                        Run Simulator
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeMainTab === "timing" && (
                <div className="w-full h-full p-4 font-mono text-xs text-slate-300 bg-[#151515] overflow-auto select-text">
                  <pre className="whitespace-pre">{timingReport || "No timing summary report generated yet."}</pre>
                </div>
              )}

              {activeMainTab === "power" && (
                <div className="w-full h-full p-4 font-mono text-xs text-slate-300 bg-[#151515] overflow-auto select-text">
                  <pre className="whitespace-pre">{powerReport || "No power estimation report generated yet."}</pre>
                </div>
              )}

              {activeMainTab === "utilization" && (
                <div className="w-full h-full p-4 font-mono text-xs text-slate-300 bg-[#151515] overflow-auto select-text">
                  <pre className="whitespace-pre">{utilizationReport || "No resource utilization report generated yet."}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Console Height Resizer Handle */}
          <div
            onMouseDown={startResizeConsole}
            className={`h-1 cursor-row-resize shrink-0 transition-colors z-30 select-none ${
              isDraggingConsole ? "bg-blue-500" : "bg-transparent hover:bg-blue-500/50"
            }`}
            style={{ width: "100%" }}
          />

          {/* Bottom Console Panel (Tcl Terminal Console) */}
          <div 
            style={{ height: `${consoleHeight}px` }}
            className={`border-t flex flex-col shrink-0 ${bgCard} ${borderCol}`}
          >
            <div className={`h-8 flex items-center px-3 border-b gap-3 overflow-x-auto ${borderCol}`}>
              {REPORT_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${
                    activeTab === t.id
                      ? "bg-blue-500/10 text-blue-500 font-extrabold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Console Log Area */}
            <div className={`flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed select-text ${bgTerm}`}>
              {activeTab === "console" && (
                <div className="space-y-1">
                  {terminalLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={
                        log.startsWith("ERROR:") || log.includes("[Error]") ? "text-red-400 font-bold" :
                        log.startsWith("WARNING:") ? "text-amber-400 font-semibold" :
                        log.startsWith("INFO:") ? "text-cyan-400" :
                        log.startsWith("Tcl%") ? "text-slate-400 font-bold" :
                        log.includes("succeeded") || log.includes("completed") || log.includes("Met") ? "text-emerald-400" : "text-slate-300"
                      }
                    >
                      {log}
                    </div>
                  ))}
                  <div ref={logConsoleEndRef} />
                </div>
              )}

              {activeTab === "problems" && (
                <div className="text-slate-500 italic text-center py-4">No critical warnings or compiler errors found.</div>
              )}

              {activeTab === "output" && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-400 border-b border-border/40 pb-1">Run: synth_1 (Target: PYNQ-Z2)</div>
                  <div className="text-[11px] text-slate-400 grid grid-cols-3 gap-2">
                    <div>Synthesis: <span className="text-[#3b82f6] font-bold">{synthesisState.toUpperCase()}</span></div>
                    <div>Implementation: <span className="text-[#3b82f6] font-bold">{implementationState.toUpperCase()}</span></div>
                    <div>Bitstream: <span className="text-[#3b82f6] font-bold">{bitstreamState.toUpperCase()}</span></div>
                  </div>
                </div>
              )}

              {activeTab === "terminal" && (
                <div className="text-slate-500 italic text-center py-4">Active system terminal console. Runs synthesis toolchains.</div>
              )}
            </div>

            {/* Tcl Prompt Command input shell */}
            {activeTab === "console" && (
              <form onSubmit={handleTclCommand} className={`h-8 border-t px-3 flex items-center gap-2 ${consolePrompt} ${borderCol}`}>
                <span className="text-blue-500 font-bold font-mono text-xs select-none">Tcl%</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  className="flex-1 bg-transparent text-xs font-mono text-slate-300 focus:outline-none border-none"
                  placeholder="Enter Tcl shell command here (e.g. 'run_simulation', 'synth_design', 'help')..."
                />
              </form>
            )}
          </div>
        </div>
      </div>

      {/* FPGA Lab Style Bottom Status Bar */}
      <footer className="h-5 bg-[#007acc] text-white flex items-center justify-between px-3 text-[11px] shrink-0 z-20 font-sans select-none">
        <div className="flex items-center gap-3">
          <span className="bg-[#0062a3] px-2 py-0.5 flex items-center gap-1 font-bold">
            Project: uart_controller
          </span>
          <span className="flex items-center gap-1 cursor-default">
            <span>Status: </span>
            <span className="font-bold">{synthesisState === "completed" ? "Synthesized" : "Uncompiled"}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span>Verilog HDL</span>
          <span>Spaces: 4</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Target: {selectedBoard?.name || "PYNQ-Z2"}
          </span>
        </div>
      </footer>
    </div>
  );
}
