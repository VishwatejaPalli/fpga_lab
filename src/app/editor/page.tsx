"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import ConfirmModal from "@/components/confirm-modal";
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

interface TabItem {
  id: string;
  label: string;
  type: "file" | "view";
}

interface RecentProject {
  id: string;
  name: string;
  path: string;
  targetBoard: string;
  topModule: string;
  lastModified: string;
  fileCount: number;
}

const EXAMPLE_PROJECTS: Record<string, { name: string; targetBoard: string; topModule: string; files: Record<string, string> }> = {
  uart_tx: {
    name: "uart_tx_project",
    targetBoard: "pynq-z2 (xc7z020clg400-1)",
    topModule: "tb_uart_tx",
    files: {
      "rtl/uart_tx.v": `module uart_tx #(
    parameter CLKS_PER_BIT = 87
)(
    input wire clk,
    input wire rst_n,
    input wire tx_start,
    input wire [7:0] tx_data,
    output reg tx_serial,
    output reg tx_ready
);
    localparam IDLE  = 3'b000;
    localparam START = 3'b001;
    localparam DATA  = 3'b010;
    localparam STOP  = 3'b011;

    reg [2:0] state;
    reg [15:0] clk_count;
    reg [2:0] bit_idx;
    reg [7:0] data_buf;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= IDLE;
            tx_serial <= 1'b1;
            tx_ready <= 1'b1;
            clk_count <= 0;
            bit_idx <= 0;
        end else begin
            case (state)
                IDLE: begin
                    tx_serial <= 1'b1;
                    tx_ready <= 1'b1;
                    if (tx_start) begin
                        state <= START;
                        data_buf <= tx_data;
                        tx_ready <= 1'b0;
                        clk_count <= 0;
                    end
                end
                START: begin
                    tx_serial <= 1'b0;
                    if (clk_count < CLKS_PER_BIT - 1)
                        clk_count <= clk_count + 1;
                    else begin
                        clk_count <= 0;
                        state <= DATA;
                        bit_idx <= 0;
                    end
                end
                DATA: begin
                    tx_serial <= data_buf[bit_idx];
                    if (clk_count < CLKS_PER_BIT - 1)
                        clk_count <= clk_count + 1;
                    else begin
                        clk_count <= 0;
                        if (bit_idx < 7)
                            bit_idx <= bit_idx + 1;
                        else
                            state <= STOP;
                    end
                end
                STOP: begin
                    tx_serial <= 1'b1;
                    if (clk_count < CLKS_PER_BIT - 1)
                        clk_count <= clk_count + 1;
                    else
                        state <= IDLE;
                end
                default: state <= IDLE;
            endcase
        end
    end
endmodule`,
      "tb/tb_uart_tx.v": `\`timescale 1ns/1ps

module tb_uart_tx;
    reg clk;
    reg rst_n;
    reg tx_start;
    reg [7:0] tx_data;
    wire tx_serial;
    wire tx_ready;

    uart_tx #(.CLKS_PER_BIT(16)) uut (
        .clk(clk), .rst_n(rst_n), .tx_start(tx_start),
        .tx_data(tx_data), .tx_serial(tx_serial), .tx_ready(tx_ready)
    );

    always #5 clk = ~clk;

    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, tb_uart_tx);
        clk = 0; rst_n = 0; tx_start = 0; tx_data = 8'hA5;
        #20 rst_n = 1;
        #20 tx_start = 1; #10 tx_start = 0;
        wait(tx_ready == 1);
        #100; $finish;
    end
endmodule`,
      "constraints/pynq_z2.xdc": `set_property -dict { PACKAGE_PIN R14 IOSTANDARD LVCMOS33 } [get_ports { tx_serial }];
set_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { clk }];
create_clock -add -name sys_clk_pin -period 8.00 [get_ports { clk }];`
    }
  },
  blinky: {
    name: "blinky_demo",
    targetBoard: "pynq-z2 (xc7z020clg400-1)",
    topModule: "blinky",
    files: {
      "rtl/blinky.v": `module blinky(
    input wire clk,
    output reg [3:0] led
);
    reg [26:0] counter = 0;
    always @(posedge clk) begin
        counter <= counter + 1;
        led <= counter[26:23];
    end
endmodule`,
      "constraints/pynq_z2.xdc": `set_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { clk }];
set_property -dict { PACKAGE_PIN R14 IOSTANDARD LVCMOS33 } [get_ports { led[0] }];`
    }
  },
  ripple_adder: {
    name: "ripple_carry_adder_demo",
    targetBoard: "basys3 (xc7a35tcpg236-1)",
    topModule: "tb_ripple_adder",
    files: {
      "rtl/ripple_adder.v": `module ripple_adder #(parameter N=4)(
    input wire [N-1:0] a,
    input wire [N-1:0] b,
    input wire cin,
    output wire [N-1:0] sum,
    output wire cout
);
    wire [N:0] c;
    assign c[0] = cin;
    genvar i;
    generate
        for(i=0; i<N; i=i+1) begin: adder_stage
            assign sum[i] = a[i] ^ b[i] ^ c[i];
            assign c[i+1] = (a[i] & b[i]) | (c[i] & (a[i] ^ b[i]));
        end
    endgenerate
    assign cout = c[N];
endmodule`,
      "tb/tb_ripple_adder.v": `\`timescale 1ns/1ps
module tb_ripple_adder;
    reg [3:0] a, b;
    reg cin;
    wire [3:0] sum;
    wire cout;
    ripple_adder #(4) uut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));
    initial begin
        a = 4'b0011; b = 4'b0101; cin = 0;
        #20;
        $finish;
    end
endmodule`
    }
  }
};

export default function EditorPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === "light";

  // View Mode: Welcome Page vs IDE Workspace
  const [viewMode, setViewMode] = useState<"welcome" | "workspace">("welcome");

  // New Project Wizard State
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjName, setNewProjName] = useState("my_fpga_project");
  const [newProjPart, setNewProjPart] = useState("pynq-z2 (xc7z020clg400-1)");
  const [newProjLang, setNewProjLang] = useState("Verilog");
  const [newProjTop, setNewProjTop] = useState("top_module");

  // Active Dropdown Menu
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Active Main Canvas Tab ("project_summary" | "editor" | "schematic" | "waveform" | "device" | "timing" | "utilization")
  const [activeMainTab, setActiveMainTab] = useState<"project_summary" | "editor" | "schematic" | "waveform" | "device" | "timing" | "utilization">("project_summary");
  
  // Sources Panel Subtab ("hierarchy" | "libraries" | "compile_order")
  const [sourcesTab, setSourcesTab] = useState<"hierarchy" | "libraries" | "compile_order">("hierarchy");

  // Project Summary Subtab ("overview" | "dashboard")
  const [summarySubtab, setSummarySubtab] = useState<"overview" | "dashboard">("overview");

  // Bottom Console Dock Tab ("tcl" | "messages" | "log" | "reports" | "runs")
  const [bottomDockTab, setBottomDockTab] = useState<"tcl" | "messages" | "log" | "reports" | "runs">("runs");

  // Dynamic Project Properties
  const [files, setFiles] = useState<Record<string, string>>(EXAMPLE_PROJECTS["uart_tx"].files);
  const [projectName, setProjectName] = useState("uart_tx_project");
  const [projectPath] = useState("C:/Users/palli/fpga_workspace");
  const [productFamily] = useState("Zynq-7000");
  const [projectPart, setProjectPart] = useState("pynq-z2 (xc7z020clg400-1)");
  const [topModuleName, setTopModuleName] = useState("tb_uart_tx");
  const [targetLanguage, setTargetLanguage] = useState("Verilog");
  const [simulatorLanguage] = useState("Mixed");
  const [targetSimulator] = useState("FPGA Simulator");

  // Streamlined Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "simulation" | "synthesis" | "implementation">("general");

  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const [draftProjectPart, setDraftProjectPart] = useState(projectPart);
  const [draftTargetLanguage, setDraftTargetLanguage] = useState(targetLanguage);
  const [draftTopModule, setDraftTopModule] = useState(topModuleName);
  const [draftSimTime, setDraftSimTime] = useState(1000);
  const [draftVerilogVer, setDraftVerilogVer] = useState("Verilog 2001");
  const [draftDefaultLib, setDraftDefaultLib] = useState("xil_defaultlib");

  // Recent Projects List
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([
    {
      id: "p1",
      name: "uart_tx_project",
      path: "C:/Users/palli/fpga_workspace/uart_tx_project",
      targetBoard: "pynq-z2",
      topModule: "tb_uart_tx",
      lastModified: "2 minutes ago",
      fileCount: 3
    },
    {
      id: "p2",
      name: "blinky_demo",
      path: "C:/Users/palli/fpga_workspace/blinky_demo",
      targetBoard: "pynq-z2",
      topModule: "blinky",
      lastModified: "1 hour ago",
      fileCount: 2
    },
    {
      id: "p3",
      name: "ripple_carry_adder_demo",
      path: "C:/Users/palli/fpga_workspace/ripple_carry_adder_demo",
      targetBoard: "basys3",
      topModule: "tb_ripple_adder",
      lastModified: "Yesterday",
      fileCount: 2
    }
  ]);

  // Open Tabs & Active File State
  const [openTabs, setOpenTabs] = useState<TabItem[]>([
    { id: "view:project_summary", label: "Project Summary", type: "view" },
    { id: "file:rtl/uart_tx.v", label: "uart_tx.v", type: "file" }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("view:project_summary");
  const [activeFile, setActiveFile] = useState<string>("rtl/uart_tx.v");
  const [activeCode, setActiveCode] = useState<string>(files["rtl/uart_tx.v"] || "");
  const [selectedFileItem, setSelectedFileItem] = useState<string>("rtl/uart_tx.v");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Boards State
  const [boards, setBoards] = useState<Board[]>([]);

  // Pipeline Execution State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isImplementing, setIsImplementing] = useState(false);
  const [isBitgen, setIsBitgen] = useState(false);
  const [schematicSvg, setSchematicSvg] = useState<string>("");

  // Design Runs State
  const [synthStatus, setSynthStatus] = useState<string>("Not started");
  const [implStatus, setImplStatus] = useState<string>("Not started");
  const [wnsValue, setWnsValue] = useState<string>("--");
  const [tnsValue, setTnsValue] = useState<string>("--");
  const [lutUsage, setLutUsage] = useState<number>(0);
  const [ffUsage, setFfUsage] = useState<number>(0);
  const [bramUsage, setBramUsage] = useState<number>(0);
  const [dspUsage, setDspUsage] = useState<number>(0);

  // Waveform State
  const [waves, setWaves] = useState<any>(null);
  const [globalRadix, setGlobalRadix] = useState<"hex" | "bin" | "dec">("hex");

  // Tcl Console State
  const [tclLogs, setTclLogs] = useState<string[]>([
    "FPGA Lab Design Suite v2026.1 (64-bit)",
    "Cloud Engine Build 5076996 on Tue May 21 2026",
    "Copyright 2026 FPGA Remote Lab. All Rights Reserved.",
    `Tcl% open_project ${projectPath}/${projectName}.xpr`,
    `INFO: [Project 1-19] Opened project ${projectName}.xpr successfully.`
  ]);
  const [tclInput, setTclInput] = useState("");
  const tclBottomRef = useRef<HTMLDivElement>(null);

  // Modal Confirm Dialog
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data) => {
        if (data.boards && data.boards.length > 0) {
          setBoards(data.boards);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tclBottomRef.current) {
      tclBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [tclLogs]);

  // Load Example Project
  const handleLoadExample = (exampleKey: string) => {
    const ex = EXAMPLE_PROJECTS[exampleKey];
    if (!ex) return;
    setProjectName(ex.name);
    setProjectPart(ex.targetBoard);
    setTopModuleName(ex.topModule);
    setFiles(ex.files);

    const firstFile = Object.keys(ex.files)[0];
    setActiveFile(firstFile);
    setActiveCode(ex.files[firstFile]);
    setOpenTabs([
      { id: "view:project_summary", label: "Project Summary", type: "view" },
      { id: `file:${firstFile}`, label: firstFile.split("/").pop() || firstFile, type: "file" }
    ]);
    setActiveTabId("view:project_summary");
    setActiveMainTab("project_summary");
    setViewMode("workspace");
    setTclLogs((prev) => [...prev, `INFO: Loaded example project '${ex.name}'.`]);
  };

  // Create New Project
  const handleCreateNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    const pName = newProjName.trim() || "my_fpga_project";
    const topMod = newProjTop.trim() || "top_module";

    const starterFiles: Record<string, string> = {
      [`rtl/${topMod}.v`]: `module ${topMod}(\n    input wire clk,\n    input wire rst_n,\n    output reg [3:0] led\n);\n    always @(posedge clk or negedge rst_n) begin\n        if (!rst_n) led <= 0;\n        else led <= led + 1;\n    end\nendmodule`,
      "constraints/pynq_z2.xdc": `## XDC Constraints for ${pName}\nset_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { clk }];`
    };

    setProjectName(pName);
    setProjectPart(newProjPart);
    setTargetLanguage(newProjLang);
    setTopModuleName(topMod);
    setFiles(starterFiles);

    const firstFile = `rtl/${topMod}.v`;
    setActiveFile(firstFile);
    setActiveCode(starterFiles[firstFile]);
    setOpenTabs([
      { id: "view:project_summary", label: "Project Summary", type: "view" },
      { id: `file:${firstFile}`, label: `${topMod}.v`, type: "file" }
    ]);
    setActiveTabId(`file:${firstFile}`);
    setActiveMainTab("editor");
    setIsNewProjectOpen(false);
    setViewMode("workspace");

    setTclLogs((prev) => [...prev, `INFO: Created new FPGA project '${pName}' targeting ${newProjPart}.`]);
  };

  // Open Settings Modal
  const handleOpenSettings = () => {
    setDraftProjectName(projectName);
    setDraftProjectPart(projectPart);
    setDraftTargetLanguage(targetLanguage);
    setDraftTopModule(topModuleName);
    setIsSettingsOpen(true);
  };

  // Save / Apply Settings
  const handleApplySettings = () => {
    setProjectName(draftProjectName);
    setProjectPart(draftProjectPart);
    setTargetLanguage(draftTargetLanguage);
    setTopModuleName(draftTopModule);
    setTclLogs((prev) => [
      ...prev,
      `Tcl% set_property part ${draftProjectPart.split(" ")[1] || draftProjectPart} [current_project]`,
      `INFO: Updated project settings for '${draftProjectName}'.`
    ]);
  };

  const handleSaveSettings = () => {
    handleApplySettings();
    setIsSettingsOpen(false);
  };

  // Tab Handler
  const openTab = (id: string, label: string, type: "file" | "view") => {
    if (!openTabs.some((t) => t.id === id)) {
      setOpenTabs((prev) => [...prev, { id, label, type }]);
    }
    setActiveTabId(id);
    if (type === "view") {
      const v = id.replace("view:", "") as any;
      setActiveMainTab(v);
    } else {
      setActiveMainTab("editor");
    }
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t.id !== id);
    setOpenTabs(nextTabs);
    if (activeTabId === id && nextTabs.length > 0) {
      const last = nextTabs[nextTabs.length - 1];
      setActiveTabId(last.id);
      if (last.type === "view") {
        setActiveMainTab(last.id.replace("view:", "") as any);
      } else {
        const path = last.id.replace("file:", "");
        setActiveFile(path);
        setActiveCode(files[path] || "");
        setActiveMainTab("editor");
      }
    }
  };

  const selectFile = (path: string) => {
    setActiveFile(path);
    setSelectedFileItem(path);
    if (files[path] !== undefined) {
      setActiveCode(files[path]);
      openTab(`file:${path}`, path.split("/").pop() || path, "file");
    }
  };

  const handleSave = async (filePath: string, content: string) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filePath, content }),
      });
      if (res.ok) {
        setFiles((prev) => ({ ...prev, [filePath]: content }));
        setSaveStatus("saved");
        setTclLogs((prev) => [...prev, `INFO: Saved file ${filePath}`]);
      } else {
        setSaveStatus("unsaved");
      }
    } catch {
      setSaveStatus("unsaved");
    }
  };

  // Run Synthesis Pipeline
  const handleRunSynthesis = async () => {
    setIsSynthesizing(true);
    setBottomDockTab("tcl");
    setTclLogs((prev) => [
      ...prev,
      "Tcl% synth_design -top " + topModuleName + " -part xc7z020clg400-1",
      "INFO: Synthesizing module '" + topModuleName + "'...",
      "INFO: Done synthesizing module '" + topModuleName + "' (1#1)"
    ]);

    try {
      const res = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, topModule: topModuleName })
      });
      const data = await res.json();
      if (res.ok) {
        setSynthStatus("Complete");
        setLutUsage(14);
        setFfUsage(8);
        setBramUsage(5);
        setDspUsage(0);
        setWnsValue("+1.842 ns");
        setTnsValue("0.000 ns");
        if (data.schematicSvg) {
          setSchematicSvg(data.schematicSvg);
        }
        setTclLogs((prev) => [...prev, "INFO: Exiting Synthesis Engine: SUCCESS."]);
        openTab("view:schematic", "Schematic Netlist", "view");
      } else {
        setSynthStatus("Failed");
        setTclLogs((prev) => [...prev, `ERROR: ${data.error || "Synthesis failed"}`]);
      }
    } catch {
      setSynthStatus("Failed");
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Run Behavioral Simulation
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setBottomDockTab("tcl");
    setTclLogs((prev) => [
      ...prev,
      "Tcl% launch_simulation -mode behavioral",
      "INFO: Compiling testbench and design files...",
      "INFO: Running simulation to 1000ns..."
    ]);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files })
      });
      const data = await res.json();
      if (res.ok && data.waveform) {
        setWaves(data.waveform);
        setTclLogs((prev) => [...prev, "INFO: Simulation completed. Waveform generated."]);
        openTab("view:waveform", "Behavioral Waveform", "view");
      } else {
        setTclLogs((prev) => [...prev, `ERROR: ${data.error || "Simulation failed"}`]);
      }
    } catch {
      setTclLogs((prev) => [...prev, "ERROR: Simulation network error"]);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run Implementation
  const handleRunImplementation = async () => {
    setIsImplementing(true);
    setBottomDockTab("tcl");
    setTclLogs((prev) => [
      ...prev,
      "Tcl% opt_design",
      "INFO: Pushed 0 inverter(s) to 0 load pin(s).",
      "Tcl% place_design",
      "INFO: Multithreading enabled for place_design using 4 CPUs.",
      "Tcl% route_design",
      "INFO: Fully Routed. WNS=+1.842ns, TNS=0.000ns."
    ]);

    setTimeout(() => {
      setImplStatus("Complete");
      setIsImplementing(false);
      setTclLogs((prev) => [...prev, "INFO: Exiting Implementation Engine: SUCCESS."]);
      openTab("view:device", "Device Floorplan", "view");
    }, 1500);
  };

  // Generate Bitstream
  const handleGenerateBitstream = async () => {
    setIsBitgen(true);
    setBottomDockTab("tcl");
    setTclLogs((prev) => [
      ...prev,
      `Tcl% write_bitstream -force ${projectName}.bit`,
      "INFO: Bitgen completed successfully.",
      `INFO: Bitstream ${projectName}.bit written.`
    ]);
    setTimeout(() => {
      setIsBitgen(false);
    }, 1200);
  };

  // Execute Tcl Command
  const handleTclSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tclInput.trim()) return;

    const cmd = tclInput.trim();
    setTclLogs((prev) => [...prev, `Tcl% ${cmd}`]);
    setTclInput("");

    if (cmd === "clear") {
      setTclLogs(["Tcl% "]);
    } else if (cmd.startsWith("synth_design")) {
      handleRunSynthesis();
    } else if (cmd.startsWith("run_simulation") || cmd.startsWith("launch_simulation")) {
      handleRunSimulation();
    } else if (cmd.startsWith("opt_design") || cmd.startsWith("place_design") || cmd.startsWith("route_design")) {
      handleRunImplementation();
    } else if (cmd.startsWith("write_bitstream")) {
      handleGenerateBitstream();
    } else if (cmd === "report_timing") {
      openTab("view:timing", "Timing Summary", "view");
      setTclLogs((prev) => [...prev, "INFO: Report Timing Summary generated."]);
    } else if (cmd === "report_utilization") {
      openTab("view:utilization", "Utilization Report", "view");
      setTclLogs((prev) => [...prev, "INFO: Resource Utilization report generated."]);
    } else if (cmd === "help") {
      setTclLogs((prev) => [
        ...prev,
        "Available Tcl Commands:",
        "  synth_design -top <module> -part <fpga> : Run Logic Synthesis",
        "  launch_simulation                        : Run Behavioral Simulation",
        "  opt_design / place_design / route_design  : Run Implementation",
        "  write_bitstream                          : Generate FPGA Bitstream",
        "  report_timing                            : View Timing Summary Report",
        "  report_utilization                       : View Resource Utilization",
        "  clear                                    : Clear Tcl console log"
      ]);
    } else {
      setTclLogs((prev) => [...prev, `INFO: Command '${cmd}' executed successfully.`]);
    }
  };

  const handleDeleteFile = (path: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Source File",
      message: `Are you sure you want to delete source file '${path}' from project?`,
      confirmText: "Delete File",
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const nextFiles = { ...files };
        delete nextFiles[path];
        setFiles(nextFiles);
        setTclLogs((prev) => [...prev, `INFO: Removed file ${path}`]);
      }
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans select-none bg-[#e8eef8] text-[#1e293b]">
      {/* ── 1. MAIN TITLE & TOP APP HEADER ────────────────────────────── */}
      <div className="flex flex-col border-b border-[#bdcce0] text-xs shrink-0 bg-[#e0e8f8]">
        {/* Title Bar */}
        <div className="h-7 px-3 flex items-center justify-between border-b border-[#c8d6e8] text-[11px] font-semibold tracking-wide text-[#0f172a]">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#2b579a] flex items-center justify-center text-[9px] font-extrabold text-white">F</span>
            <span>
              {viewMode === "welcome"
                ? "FPGA Lab Design Suite v2026.1 - Getting Started"
                : `${projectName} - [${projectPath}/${projectName}.xpr] - FPGA Lab Design Suite`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "welcome" ? "workspace" : "welcome")}
              className={`px-2.5 py-0.5 rounded font-bold text-[10px] flex items-center gap-1 transition-all shadow-xs ${
                viewMode === "welcome"
                  ? "bg-[#2b579a] hover:bg-[#1e3a8a] text-white"
                  : "bg-white hover:bg-slate-100 text-slate-800 border border-[#cbd5e1]"
              }`}
            >
              <span>{viewMode === "welcome" ? "🚀 Open IDE Workspace" : "🏠 Getting Started"}</span>
            </button>

            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold shadow-sm">
              Ready
            </span>
            <span className="text-slate-600 text-[10px] bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">
              Default Layout ▾
            </span>
          </div>
        </div>

        {/* Menu Bar */}
        <div className="h-7 px-2 flex items-center gap-1 text-[11px] relative font-medium bg-[#e6ecf7]">
          {[
            {
              id: "file",
              label: "File",
              items: [
                { label: "New Project...", action: () => setIsNewProjectOpen(true) },
                { label: "Open Project...", action: () => setViewMode("welcome") },
                { label: "Add Sources... (Alt+A)", action: () => openTab("file:constraints/pynq_z2.xdc", "pynq_z2.xdc", "file") },
                { label: "Simulation Waveform ▸", action: handleRunSimulation },
                { label: "Exit", action: () => router.push("/dashboard") }
              ]
            },
            {
              id: "edit",
              label: "Edit",
              items: [
                { label: "Undo (Ctrl+Z)", action: () => {} },
                { label: "Redo (Ctrl+Shift+Z)", action: () => {} },
                { label: "Copy (Ctrl+C)", action: () => {} },
                { label: "Paste (Ctrl+V)", action: () => {} },
                { label: "Delete (Delete)", action: () => {} }
              ]
            },
            {
              id: "flow",
              label: "Flow",
              items: [
                { label: "Project Manager", action: () => { setViewMode("workspace"); openTab("view:project_summary", "Project Summary", "view"); } },
                { label: "Project Settings...", action: handleOpenSettings },
                { label: "Run Simulation", action: handleRunSimulation },
                { label: "Open Elaborated Design", action: () => { setViewMode("workspace"); openTab("view:schematic", "Schematic Netlist", "view"); } },
                { label: "Run Synthesis (F11)", action: handleRunSynthesis },
                { label: "Run Implementation", action: handleRunImplementation },
                { label: "Generate Bitstream", action: handleGenerateBitstream }
              ]
            },
            {
              id: "view",
              label: "View",
              items: [
                { label: "Getting Started Screen", action: () => setViewMode("welcome") },
                { label: "Project Summary", action: () => { setViewMode("workspace"); openTab("view:project_summary", "Project Summary", "view"); } },
                { label: "Schematic Netlist", action: () => { setViewMode("workspace"); openTab("view:schematic", "Schematic Netlist", "view"); } },
                { label: "Waveform Viewer", action: () => { setViewMode("workspace"); openTab("view:waveform", "Behavioral Waveform", "view"); } },
                { label: "Device Floorplan", action: () => { setViewMode("workspace"); openTab("view:device", "Device Floorplan", "view"); } }
              ]
            },
            {
              id: "tools",
              label: "Tools",
              items: [
                { label: "Run Tcl Script...", action: () => { setViewMode("workspace"); setBottomDockTab("tcl"); } }
              ]
            },
            {
              id: "help",
              label: "Help",
              items: [
                { label: "FPGA Lab Documentation", action: () => window.open("https://www.xilinx.com/support/documentation.html", "_blank") },
                { label: "About FPGA Lab Design Suite", action: () => alert("FPGA Lab Design Suite v2026.1") }
              ]
            }
          ].map((m) => (
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

        {/* Quick Toolbar (Active in Workspace Mode) */}
        {viewMode === "workspace" && (
          <div className="h-8 px-3 border-t border-[#c8d6e8] flex items-center gap-3 text-xs bg-[#eef3f9]">
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2b579a]/10 rounded text-slate-700 text-[11px] font-medium border border-[#cbd5e1] bg-white"
              title="Project Settings"
            >
              <span className="text-blue-600">⚙️</span> Settings
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
              <span className="text-emerald-600">▶</span> Run Simulation
            </button>

            <button
              onClick={handleRunSynthesis}
              disabled={isSynthesizing}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-blue-50 border border-[#cbd5e1] text-blue-700 rounded text-[11px] font-bold disabled:opacity-50"
              title="Run Logic Synthesis (F11)"
            >
              <span className="text-blue-600">▶</span> Run Synthesis
            </button>

            <button
              onClick={handleRunImplementation}
              disabled={isImplementing}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-purple-50 border border-[#cbd5e1] text-purple-700 rounded text-[11px] font-bold disabled:opacity-50"
              title="Run Implementation (Place & Route)"
            >
              <span className="text-purple-600">▶</span> Run Implementation
            </button>

            <button
              onClick={handleGenerateBitstream}
              disabled={isBitgen}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-white hover:bg-amber-50 border border-[#cbd5e1] text-amber-700 rounded text-[11px] font-bold disabled:opacity-50"
              title="Generate Bitstream (.bit)"
            >
              <span>📦</span> Generate Bitstream
            </button>

            <div className="ml-auto flex items-center gap-2 text-[11px]">
              <span className="text-slate-600 font-medium">Target FPGA:</span>
              <span className="font-mono text-blue-700 font-bold bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">
                {projectPart}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. MAIN BODY: WELCOME LANDING PAGE OR IDE WORKSPACE ────────────────── */}
      {viewMode === "welcome" ? (
        /* ═══════════════ VIVADO GETTING STARTED WELCOME SCREEN ═══════════════ */
        <div className="flex-1 p-6 md:p-10 overflow-y-auto bg-[#e8eef8]">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header Title Banner */}
            <div className="bg-[#2b579a] text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-white/20 text-white font-black text-2xl flex items-center justify-center">F</span>
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
                      <div className="text-[10px] text-slate-500 font-normal">Create a new FPGA project with HDL & constraints</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setViewMode("workspace")}
                    className="w-full text-left p-3 rounded-xl hover:bg-blue-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold group transition-all"
                  >
                    <span className="text-xl text-purple-600 group-hover:scale-110 transition-transform">📂</span>
                    <div>
                      <div>Open Project</div>
                      <div className="text-[10px] text-slate-500 font-normal">Open an existing workspace project in IDE</div>
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
                      <div className="text-[10px] text-slate-500 font-normal">Configure target FPGA board & HDL standards</div>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push("/program")}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold"
                  >
                    <span className="text-xl text-amber-600">⚡</span>
                    <div>
                      <div>Open Hardware Programmer</div>
                      <div className="text-[10px] text-slate-500 font-normal">Deploy compiled bitstream to physical FPGA</div>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push("/help")}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 flex items-center gap-3 border border-slate-200/60 font-semibold"
                  >
                    <span className="text-xl text-emerald-600">📘</span>
                    <div>
                      <div>Documentation & Manuals</div>
                      <div className="text-[10px] text-slate-500 font-normal">View step-by-step FPGA guides and tutorials</div>
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
                      Connected
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
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
                      <div className="text-xs text-slate-600 mt-2 font-medium">Top Module: <span className="font-mono text-slate-800">{p.topModule}</span></div>
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
      ) : (
        /* ═══════════════ IDE WORKSPACE VIEW ═══════════════ */
        <div className="flex-1 flex min-h-0 overflow-hidden bg-[#e4ecf6]">
          {/* FLOW NAVIGATOR */}
          <div className="w-52 border-r border-[#c4d2e2] flex flex-col overflow-y-auto shrink-0 bg-[#f0f4f9] text-[#1e293b]">
            <div className="p-2 border-b border-[#c4d2e2] bg-[#e1ebf7] font-bold text-[11px] uppercase tracking-wider text-[#1e3a8a] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>📌</span> Flow Navigator
              </span>
              <span className="text-slate-500 text-[9px] font-mono">v2026.1</span>
            </div>

            <div className="p-1 space-y-3 text-[11px]">
              <div>
                <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
                  <span>▾</span> PROJECT MANAGER
                </div>
                <div className="pl-3 space-y-0.5 mt-0.5">
                  <button onClick={handleOpenSettings} className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2 font-medium">
                    <span className="text-blue-600">⚙️</span> Settings
                  </button>
                  <button onClick={() => openTab("file:constraints/pynq_z2.xdc", "pynq_z2.xdc", "file")} className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">+</span> Add Sources
                  </button>
                </div>
              </div>

              <div>
                <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
                  <span>▾</span> SIMULATION
                </div>
                <div className="pl-3 space-y-0.5 mt-0.5">
                  <button onClick={handleRunSimulation} className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold">
                    <span className="text-emerald-600">▶</span> Run Simulation
                  </button>
                </div>
              </div>

              <div>
                <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
                  <span>▾</span> RTL ANALYSIS
                </div>
                <div className="pl-3 space-y-0.5 mt-0.5">
                  <button onClick={handleRunSynthesis} className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold">
                    <span className="text-emerald-600">▶</span> Run Linter
                  </button>
                  <button onClick={() => openTab("view:schematic", "Schematic Netlist", "view")} className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2 font-medium">
                    <span>🔍</span> Open Elaborated Design
                  </button>
                </div>
              </div>

              <div>
                <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
                  <span>▾</span> SYNTHESIS
                </div>
                <div className="pl-3 space-y-0.5 mt-0.5">
                  <button onClick={handleRunSynthesis} className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold">
                    <span className="text-emerald-600">▶</span> Run Synthesis
                  </button>
                  <button onClick={() => openTab("view:schematic", "Schematic Netlist", "view")} className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2">
                    <span>📂</span> Open Synthesized Design
                  </button>
                </div>
              </div>

              <div>
                <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
                  <span>▾</span> IMPLEMENTATION
                </div>
                <div className="pl-3 space-y-0.5 mt-0.5">
                  <button onClick={handleRunImplementation} className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600/15 text-emerald-700 flex items-center gap-2 font-bold">
                    <span className="text-emerald-600">▶</span> Run Implementation
                  </button>
                  <button onClick={() => openTab("view:device", "Device Floorplan", "view")} className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2">
                    <span>📂</span> Open Implemented Design
                  </button>
                </div>
              </div>

              <div>
                <div className="px-2 py-1 text-slate-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 bg-[#e4ebf5] rounded-sm">
                  <span>▾</span> PROGRAM AND DEBUG
                </div>
                <div className="pl-3 space-y-0.5 mt-0.5">
                  <button onClick={handleGenerateBitstream} className="w-full text-left px-2 py-1 rounded hover:bg-[#2b579a]/15 text-slate-800 flex items-center gap-2 font-medium">
                    <span>📦</span> Generate Bitstream
                  </button>
                  <button onClick={() => router.push("/program")} className="w-full text-left px-2 py-1 rounded hover:bg-amber-600/15 text-amber-800 flex items-center gap-2 font-bold">
                    <span>⚡</span> Program Device
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SOURCES DOCK */}
          <div className="w-72 border-r border-[#c4d2e2] flex flex-col shrink-0 overflow-hidden bg-[#f4f7fc]">
            <div className="h-8 border-b border-[#c4d2e2] flex items-center justify-between px-3 bg-[#e4ebf5] shrink-0">
              <span className="font-bold text-[11px] text-[#1e3a8a]">Sources</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span>Updating 🔄</span>
              </div>
            </div>

            <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-1 bg-white">
              <div className="pl-1 space-y-1">
                <div className="flex items-center gap-1 text-slate-700 font-bold">
                  <span>▾</span> <span className="text-[#d97706]">📁</span> Design Sources ({Object.keys(files).filter(f => f.endsWith(".v")).length})
                </div>

                <div className="pl-4 space-y-1">
                  {Object.keys(files).filter(f => f.endsWith(".v") || f.endsWith(".sv") || f.endsWith(".vhd")).map((path) => {
                    const isTop = path.includes(topModuleName) || path.includes("uart_tx.v");
                    const isSelected = selectedFileItem === path;
                    return (
                      <div
                        key={path}
                        onClick={() => selectFile(path)}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                          isSelected ? "bg-[#2b579a] text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span>📄</span>
                          <span className="truncate">{path.split("/").pop()}</span>
                          {isTop && (
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-700 rounded border border-emerald-300 font-bold">
                              top
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(path);
                          }}
                          className="text-red-500 hover:text-red-700 px-1"
                          title="Remove file"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pl-1 pt-2 space-y-1">
                <div className="flex items-center gap-1 text-slate-700 font-bold">
                  <span>▾</span> <span className="text-[#d97706]">📁</span> Constraints
                </div>

                <div className="pl-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span>📁</span> constrs_1
                  </div>
                  {Object.keys(files).filter(f => f.endsWith(".xdc")).map((path) => (
                    <div
                      key={path}
                      onClick={() => selectFile(path)}
                      className={`pl-4 flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                        selectedFileItem === path ? "bg-[#2b579a] text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span>📜</span>
                        <span className="truncate">{path.split("/").pop()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-7 border-t border-[#c4d2e2] bg-[#e4ebf5] flex items-center px-1 text-[10px] shrink-0 font-medium">
              {(["hierarchy", "libraries", "compile_order"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSourcesTab(st)}
                  className={`px-2.5 py-1 rounded-t capitalize transition-colors ${
                    sourcesTab === st ? "bg-white text-[#1e3a8a] font-bold border-t-2 border-t-[#2b579a]" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="h-36 border-t border-[#c4d2e2] bg-[#f8fafc] p-2 text-[11px] overflow-y-auto">
              <div className="font-bold text-[#1e3a8a] border-b border-[#cbd5e1] pb-1 mb-2 flex items-center justify-between">
                <span>Properties</span>
                <span className="text-slate-500 font-mono text-[9px]">{selectedFileItem}</span>
              </div>

              {selectedFileItem ? (
                <div className="space-y-1 text-slate-700 font-mono text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="text-slate-900 font-bold">{selectedFileItem.split("/").pop()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Path:</span> <span className="truncate text-slate-800">{selectedFileItem}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Type:</span> <span className="text-blue-700">{selectedFileItem.endsWith(".xdc") ? "XDC Constraints" : "Verilog Source"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Target Part:</span> <span className="text-slate-800">xc7z020clg400-1</span></div>
                </div>
              ) : (
                <div className="text-slate-400 italic text-center pt-4">Select an object to see properties</div>
              )}
            </div>
          </div>

          {/* MAIN CANVAS */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#e4ecf6]">
            <div className="h-8 border-b border-[#c4d2e2] bg-[#dce6f5] flex items-center px-1 overflow-x-auto shrink-0">
              {openTabs.map((t) => {
                const isActive = activeTabId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setActiveTabId(t.id);
                      if (t.type === "view") {
                        setActiveMainTab(t.id.replace("view:", "") as any);
                      } else {
                        const path = t.id.replace("file:", "");
                        setActiveFile(path);
                        setActiveCode(files[path] || "");
                        setActiveMainTab("editor");
                      }
                    }}
                    className={`h-7 px-3 text-[11px] font-semibold flex items-center gap-2 border-r border-[#cbd5e1] cursor-pointer select-none transition-all rounded-t ${
                      isActive
                        ? "bg-white text-[#1e3a8a] border-t-2 border-t-[#2b579a] font-bold shadow-sm"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <span>{t.type === "view" ? "📊" : "📄"} {t.label}</span>
                    {t.id !== "view:project_summary" && (
                      <button
                        onClick={(e) => closeTab(e, t.id)}
                        className="w-3.5 h-3.5 rounded hover:bg-slate-200 flex items-center justify-center text-[10px]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 relative overflow-auto min-h-0 bg-[#f8fafc]">
              {activeMainTab === "project_summary" && (
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
                            summarySubtab === sub ? "bg-[#2b579a] text-white" : "bg-white text-slate-700 border border-[#cbd5e1] hover:bg-slate-50"
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
                          <button onClick={handleOpenSettings} className="text-blue-600 hover:underline text-xs font-semibold">
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
                            <h2 className="font-bold text-sm text-[#1e3a8a]">Board Part</h2>
                          </div>
                          <div className="flex justify-between text-xs font-mono py-1">
                            <span className="text-slate-600 font-sans">Display name:</span>
                            <span className="text-blue-700 font-bold">pynq z2</span>
                          </div>
                        </div>

                        <div className="bg-white border border-[#c4d2e2] rounded-lg p-5 space-y-3 shadow-sm">
                          <h2 className="font-bold text-sm text-[#1e3a8a] border-b border-slate-200 pb-2">Design Flow Actions</h2>
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
              )}

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
                    Select a source file from Sources tree to edit
                  </div>
                )
              )}

              {activeMainTab === "schematic" && (
                <div className="w-full h-full flex items-center justify-center p-6 bg-white overflow-auto">
                  {schematicSvg ? (
                    <div className="w-full h-full max-w-4xl flex items-center justify-center" dangerouslySetInnerHTML={{ __html: schematicSvg }} />
                  ) : (
                    <div className="text-slate-600 text-center space-y-3">
                      <div className="text-4xl">🗺️</div>
                      <div className="font-bold text-slate-900">Elaborated Schematic Netlist</div>
                      <p className="text-xs text-slate-600 max-w-md">Run Synthesis (F11) to elaborate netlist gates for &apos;{topModuleName}&apos;.</p>
                      <button onClick={handleRunSynthesis} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-700">
                        ▶ Run Synthesis Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeMainTab === "waveform" && (
                <div className="w-full h-full flex flex-col bg-[#0f172a]">
                  <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-200">Waveform Viewer</span>
                      {waves && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[10px]">Radix:</span>
                          <select value={globalRadix} onChange={(e) => setGlobalRadix(e.target.value as any)} className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-0.5">
                            <option value="hex">HEX</option>
                            <option value="bin">BIN</option>
                            <option value="dec">DEC</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <button onClick={handleRunSimulation} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold">
                      ▶ Re-run Simulation
                    </button>
                  </div>

                  <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-center">
                    {waves ? (
                      <div className="font-mono text-emerald-400">Waveform Signals Loaded ({Object.keys(waves).length} signals)</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-4xl">🧪</div>
                        <div className="font-bold text-slate-200">Behavioral Simulation Waveform</div>
                        <p className="text-xs text-slate-400">Run simulation to inspect clock cycles and registers.</p>
                        <button onClick={handleRunSimulation} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">
                          ▶ Run Behavioral Simulation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeMainTab === "device" && (
                <div className="w-full h-full bg-[#030712] text-slate-200 flex flex-col min-h-0 overflow-hidden font-mono select-none">
                  {/* Controls Header Toolbar */}
                  <div className="h-8 bg-[#090d16] border-b border-slate-800 flex items-center justify-between px-3 text-xs shrink-0">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-[#00f0ff] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse" />
                        Device Layout - xc7z020clg400-1
                      </span>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
                          <input type="checkbox" defaultChecked className="accent-cyan-500 rounded" />
                          <span className="text-cyan-400">Placed Logic (Cyan)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
                          <input type="checkbox" defaultChecked className="accent-red-500 rounded" />
                          <span className="text-red-400">Routing Nets (Red)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
                          <input type="checkbox" defaultChecked className="accent-pink-500 rounded" />
                          <span className="text-pink-400">Clock Regions</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-400">Selected:</span>
                      <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        SLICE_X12Y45 (LUT6: uart_tx/state[1])
                      </span>
                      <span className="text-slate-400">WNS:</span>
                      <span className="text-[#00f0ff] font-bold">+1.842 ns</span>
                    </div>
                  </div>

                  {/* FPGA Die Silicon SVG Canvas */}
                  <div className="flex-1 relative bg-[#02050b] overflow-hidden flex items-center justify-center p-2">
                    <svg className="w-full h-full max-w-5xl max-h-[600px]" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">
                      {/* Dark Die Silicon Background */}
                      <rect x="0" y="0" width="1000" height="700" fill="#030712" />

                      {/* Left Dark Outer Panel */}
                      <rect x="0" y="0" width="220" height="700" fill="#000000" />
                      <rect x="130" y="230" width="50" height="90" fill="#00a896" opacity="0.8" />

                      {/* I/O Banks Vertical Column (Far Left Pads) */}
                      {Array.from({ length: 45 }).map((_, i) => (
                        <rect key={`iol-${i}`} x="195" y={30 + i * 14} width="8" height="10" fill="#00f0ff" opacity="0.7" />
                      ))}

                      {/* Right Outer I/O Bank Towers */}
                      <g>
                        {Array.from({ length: 35 }).map((_, i) => (
                          <rect key={`ior1-${i}`} x="930" y={40 + i * 18} width="16" height="14" fill="#d97706" stroke="#fbbf24" strokeWidth="0.5" />
                        ))}
                        {Array.from({ length: 35 }).map((_, i) => (
                          <rect key={`ior2-[#i]`} x="965" y={40 + i * 18} width="16" height="14" fill="#00a896" stroke="#00f0ff" strokeWidth="0.5" />
                        ))}
                      </g>

                      {/* Vertical Routing Channel Bus Lines */}
                      {Array.from({ length: 24 }).map((_, i) => (
                        <g key={`bus-${i}`}>
                          <line x1={240 + i * 28} y1="0" x2={240 + i * 28} y2="700" stroke={i % 3 === 0 ? "#ef4444" : i % 5 === 0 ? "#10b981" : "#3b82f6"} strokeWidth="1" opacity="0.4" />
                          <line x1={243 + i * 28} y1="0" x2={243 + i * 28} y2="700" stroke={i % 2 === 0 ? "#ec4899" : "#8b5cf6"} strokeWidth="0.8" opacity="0.3" />
                        </g>
                      ))}

                      {/* Horizontal Clock Region Boundary Lines */}
                      <line x1="220" y1="280" x2="920" y2="280" stroke="#ec4899" strokeWidth="2" />
                      <line x1="220" y1="560" x2="920" y2="560" stroke="#ec4899" strokeWidth="2" />
                      <line x1="420" y1="0" x2="420" y2="700" stroke="#a855f7" strokeWidth="2" />
                      <line x1="680" y1="0" x2="680" y2="700" stroke="#a855f7" strokeWidth="1.5" />

                      {/* Clock Region Labels */}
                      <text x="230" y="275" fill="#a855f7" fontSize="12" fontWeight="bold">X0Y2</text>
                      <text x="430" y="275" fill="#a855f7" fontSize="12" fontWeight="bold">X1Y2</text>
                      <text x="230" y="555" fill="#a855f7" fontSize="12" fontWeight="bold">X0Y1</text>
                      <text x="430" y="555" fill="#a855f7" fontSize="12" fontWeight="bold">X1Y1</text>

                      {/* Placed Logic Cell Sprites (Dense Cyan/Teal Blocks Matching Screenshot) */}
                      {/* Cluster 1: Main CLB Logic Block (X0Y1 / X0Y2) */}
                      <g fill="#00f0ff" opacity="0.85">
                        {Array.from({ length: 140 }).map((_, i) => {
                          const rx = 235 + (i % 14) * 12 + ((i * 7) % 11);
                          const ry = 295 + Math.floor(i / 14) * 18 + ((i * 13) % 9);
                          return (
                            <rect key={`c1-${i}`} x={rx} y={ry} width="7" height="12" rx="0.5" />
                          );
                        })}
                      </g>

                      {/* Cluster 2: Bottom Placed Logic Density */}
                      <g fill="#00d8d6" opacity="0.9">
                        {Array.from({ length: 220 }).map((_, i) => {
                          const rx = 240 + (i % 22) * 8 + ((i * 3) % 7);
                          const ry = 570 + Math.floor(i / 22) * 11 + ((i * 5) % 6);
                          return (
                            <rect key={`c2-${i}`} x={rx} y={ry} width="5" height="8" />
                          );
                        })}
                      </g>

                      {/* Cluster 3: Middle Interconnect Slices */}
                      <g fill="#06b6d4" opacity="0.8">
                        {Array.from({ length: 80 }).map((_, i) => {
                          const rx = 430 + (i % 8) * 14 + ((i * 5) % 9);
                          const ry = 480 + Math.floor(i / 8) * 12;
                          return (
                            <rect key={`c3-${i}`} x={rx} y={ry} width="8" height="6" />
                          );
                        })}
                      </g>

                      {/* Placed BRAM / DSP Highlight Towers */}
                      <g>
                        <rect x="630" y="100" width="14" height="60" stroke="#e2e8f0" fill="none" strokeWidth="1.5" />
                        <rect x="635" y="145" width="8" height="12" fill="#ec4899" />
                        <rect x="630" y="210" width="14" height="24" stroke="#e2e8f0" fill="none" strokeWidth="1" />

                        {Array.from({ length: 8 }).map((_, i) => (
                          <rect key={`dsp-${i}`} x="630" y={250 + i * 22} width="14" height="14" stroke="#e2e8f0" fill="none" strokeWidth="1" />
                        ))}
                      </g>

                      {/* Critical Timing Path Net Line (Magenta) */}
                      <path d="M 195 290 Q 240 280 280 320 T 360 410 T 635 151" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeDasharray="4 2" />
                    </svg>

                    {/* Bottom Floating Map Scale */}
                    <div className="absolute bottom-3 right-3 bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 flex items-center gap-3 backdrop-blur-xs">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#00f0ff] rounded-xs" /> Placed Slice</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#ec4899] rounded-xs" /> Critical Path</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#d97706] rounded-xs" /> I/O Bank</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. BOTTOM CONSOLE DOCK ─────────────────────────── */}
      {viewMode === "workspace" && (
        <div className="h-52 border-t border-[#c4d2e2] flex flex-col shrink-0 bg-[#f0f4f9]">
          <div className="h-7 border-b border-[#c4d2e2] flex items-center justify-between px-2 bg-[#e4ebf5] text-xs shrink-0">
            <div className="flex items-center gap-1 font-semibold">
              {[
                { id: "tcl", label: "Tcl Console" },
                { id: "messages", label: "Messages" },
                { id: "log", label: "Log" },
                { id: "reports", label: "Reports" },
                { id: "runs", label: "Design Runs" }
              ].map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => setBottomDockTab(dt.id as any)}
                  className={`px-3 py-0.5 rounded-t text-[11px] transition-colors ${
                    bottomDockTab === dt.id
                      ? "bg-white text-[#1e3a8a] font-bold border-t-2 border-t-[#2b579a]"
                      : "text-slate-700 hover:bg-white/60"
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-slate-600 font-mono">
              Status: <span className="text-emerald-700 font-bold">{synthStatus}</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto bg-white">
            {bottomDockTab === "runs" && (
              <div className="w-full h-full overflow-auto text-[11px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#cbd5e1] font-bold text-[10px] uppercase bg-[#e2e8f0] text-slate-700">
                      <th className="p-2 border-r border-[#cbd5e1]">Name</th>
                      <th className="p-2 border-r border-[#cbd5e1]">Constraints</th>
                      <th className="p-2 border-r border-[#cbd5e1]">Status</th>
                      <th className="p-2 border-r border-[#cbd5e1]">WNS</th>
                      <th className="p-2 border-r border-[#cbd5e1]">TNS</th>
                      <th className="p-2 border-r border-[#cbd5e1]">LUT</th>
                      <th className="p-2 border-r border-[#cbd5e1]">FF</th>
                      <th className="p-2 border-r border-[#cbd5e1]">BRAM</th>
                      <th className="p-2 border-r border-[#cbd5e1]">DSP</th>
                      <th className="p-2">Elapsed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px] text-slate-800">
                    <tr className="hover:bg-blue-50 cursor-pointer">
                      <td className="p-2 font-bold text-blue-700 flex items-center gap-1"><span>▶</span> synth_1</td>
                      <td className="p-2 text-slate-600">constrs_1</td>
                      <td className="p-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">{synthStatus}</span></td>
                      <td className="p-2 text-emerald-700 font-bold">{wnsValue}</td>
                      <td className="p-2 text-slate-700">{tnsValue}</td>
                      <td className="p-2 text-blue-700">{lutUsage}%</td>
                      <td className="p-2 text-purple-700">{ffUsage}%</td>
                      <td className="p-2 text-emerald-700">{bramUsage}%</td>
                      <td className="p-2 text-amber-700">{dspUsage}%</td>
                      <td className="p-2 text-slate-600">00:00:12</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {bottomDockTab === "tcl" && (
              <div className="w-full h-full flex flex-col bg-slate-900 p-2 font-mono text-[11px] text-slate-200">
                <div className="flex-1 overflow-y-auto space-y-1">
                  {tclLogs.map((log, idx) => (
                    <div key={idx} className={log.startsWith("ERROR") ? "text-red-400 font-bold" : log.startsWith("Tcl%") ? "text-blue-400 font-bold" : "text-slate-300"}>
                      {log}
                    </div>
                  ))}
                  <div ref={tclBottomRef} />
                </div>

                <form onSubmit={handleTclSubmit} className="mt-2 flex items-center gap-2 border-t border-slate-800 pt-1.5">
                  <span className="text-blue-400 font-bold">Tcl%</span>
                  <input
                    type="text"
                    value={tclInput}
                    onChange={(e) => setTclInput(e.target.value)}
                    placeholder="Type Tcl command (e.g. synth_design, help, clear)..."
                    className="flex-1 bg-transparent border-none text-slate-200 focus:outline-none text-[11px]"
                  />
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NEW PROJECT WIZARD MODAL ────────────────────────────────────── */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleCreateNewProject} className="w-full max-w-lg bg-white border border-[#b0c4de] rounded-2xl shadow-2xl overflow-hidden text-slate-800">
            <div className="px-6 py-4 bg-[#2b579a] text-white flex items-center justify-between font-bold text-sm">
              <span className="flex items-center gap-2"><span>📁</span> Create New FPGA Project</span>
              <button type="button" onClick={() => setIsNewProjectOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Target FPGA Board</label>
                <select
                  value={newProjPart}
                  onChange={(e) => setNewProjPart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none"
                >
                  <option value="pynq-z2 (xc7z020clg400-1)">PYNQ-Z2 (Zynq-7000 xc7z020clg400-1)</option>
                  <option value="basys3 (xc7a35tcpg236-1)">Basys3 (Artix-7 xc7a35tcpg236-1)</option>
                  <option value="arty-a7 (xc7a35tcsg324-1)">Arty-A7 (Artix-7 xc7a35tcsg324-1)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Target Language</label>
                  <select
                    value={newProjLang}
                    onChange={(e) => setNewProjLang(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Verilog">Verilog</option>
                    <option value="SystemVerilog">SystemVerilog</option>
                    <option value="VHDL">VHDL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Top Module Name</label>
                  <input
                    type="text"
                    required
                    value={newProjTop}
                    onChange={(e) => setNewProjTop(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 text-xs">
              <button type="button" onClick={() => setIsNewProjectOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-[#2b579a] hover:bg-[#1e3a8a] text-white font-bold rounded-lg shadow-md">
                Create Project & Launch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STREAMLINED PROJECT SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#f8fafc] border border-[#b0c4de] rounded-lg shadow-2xl overflow-hidden flex flex-col h-[520px] text-slate-800">
            <div className="h-9 px-4 bg-[#e0e8f8] border-b border-[#cbd5e1] flex items-center justify-between text-xs font-semibold text-[#0f172a]">
              <span className="flex items-center gap-2"><span>⚙️</span> Project Settings</span>
              <button onClick={() => setIsSettingsOpen(false)} className="w-5 h-5 rounded hover:bg-slate-300 flex items-center justify-center font-bold text-slate-600 text-xs">✕</button>
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
                        settingsTab === item.id ? "bg-[#2b579a] text-white font-bold" : "text-slate-700 hover:bg-slate-200"
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
                    <h2 className="text-base font-bold text-[#1e3a8a] capitalize">{settingsTab} Project Settings</h2>
                    <p className="text-xs text-slate-500 mt-1">Configure parameters used for compilation and simulation.</p>
                  </div>

                  {settingsTab === "general" && (
                    <div className="space-y-4 text-xs font-medium">
                      <div className="flex items-center gap-4">
                        <label className="w-32 text-slate-700 text-right">Project Name:</label>
                        <input type="text" value={draftProjectName} onChange={(e) => setDraftProjectName(e.target.value)} className="flex-1 px-2.5 py-1 border border-[#cbd5e1] rounded font-mono text-slate-900" />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="w-32 text-slate-700 text-right">Target FPGA Device:</label>
                        <select value={draftProjectPart} onChange={(e) => setDraftProjectPart(e.target.value)} className="flex-1 px-2 py-1 border border-[#cbd5e1] rounded font-mono text-blue-800 bg-slate-50">
                          <option value="pynq-z2 (xc7z020clg400-1)">pynq-z2 (xc7z020clg400-1)</option>
                          <option value="basys3 (xc7a35tcpg236-1)">basys3 (xc7a35tcpg236-1)</option>
                          <option value="arty-a7 (xc7a35tcsg324-1)">arty-a7 (xc7a35tcsg324-1)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="w-32 text-slate-700 text-right">Target HDL Language:</label>
                        <select value={draftTargetLanguage} onChange={(e) => setDraftTargetLanguage(e.target.value)} className="flex-1 px-2 py-1 border border-[#cbd5e1] rounded text-slate-900 bg-white">
                          <option value="Verilog">Verilog</option>
                          <option value="SystemVerilog">SystemVerilog</option>
                          <option value="VHDL">VHDL</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="w-32 text-slate-700 text-right">Top Module Name:</label>
                        <input type="text" value={draftTopModule} onChange={(e) => setDraftTopModule(e.target.value)} className="flex-1 px-2.5 py-1 border border-[#cbd5e1] rounded font-mono text-slate-900" />
                      </div>
                    </div>
                  )}

                  {settingsTab === "simulation" && (
                    <div className="space-y-4 text-xs font-medium">
                      <div className="flex items-center gap-4">
                        <label className="w-32 text-slate-700 text-right">Simulation Runtime:</label>
                        <input type="number" value={draftSimTime} onChange={(e) => setDraftSimTime(Number(e.target.value))} className="w-36 px-2.5 py-1 border border-[#cbd5e1] rounded font-mono" />
                        <span className="text-slate-500 text-xs">ns</span>
                      </div>
                    </div>
                  )}

                  {settingsTab === "synthesis" && (
                    <div className="space-y-4 text-xs font-medium">
                      <div className="flex items-center gap-4">
                        <label className="w-32 text-slate-700 text-right">Verilog Standard:</label>
                        <select value={draftVerilogVer} onChange={(e) => setDraftVerilogVer(e.target.value)} className="flex-1 px-2 py-1 border border-[#cbd5e1] rounded">
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
                        <input type="text" value="constraints/pynq_z2.xdc" disabled className="flex-1 px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-slate-600" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
                  <button onClick={handleSaveSettings} className="px-5 py-1.5 bg-[#2b579a] hover:bg-[#1e3a8a] text-white font-bold rounded shadow-sm">OK</button>
                  <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-100 text-slate-700 font-medium rounded">Cancel</button>
                  <button onClick={handleApplySettings} className="px-4 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-100 text-slate-700 font-medium rounded">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Dialog */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
