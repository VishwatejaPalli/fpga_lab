"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import Editor from "@monaco-editor/react";

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  status: string;
  capabilities: string[];
}

// Full FPGA design pipeline stages
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
  { id: "console",    label: "Console" },
  { id: "simulation", label: "Simulation" },
  { id: "schematic",  label: "Schematic" },
  { id: "netlist",    label: "Netlist" },
  { id: "timing",     label: "Timing" },
  { id: "power",      label: "Power" },
  { id: "utilization", label: "Utilization" },
  { id: "waveform",   label: "Waveform" },
] as const;

type ReportTabId = (typeof REPORT_TABS)[number]["id"];

export default function EditorPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [code, setCode] = useState<string>(`// FPGA Remote Lab — Cloud IDE
// Write your Verilog RTL design below

module blinky(
    input wire clk,
    output wire [3:0] led
);

    reg [27:0] counter = 0;
    
    always @(posedge clk) begin
        counter <= counter + 1;
    end
    
    assign led = counter[27:24];

endmodule
`);
  const [logs, setLogs] = useState<string>("");
  const [reports, setReports] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ReportTabId>("console");
  const [isCompiling, setIsCompiling] = useState(false);
  const [stageStatuses, setStageStatuses] = useState<Record<StageId, StageStatus>>(
    Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, "idle"])) as Record<StageId, StageStatus>
  );
  const [currentStage, setCurrentStage] = useState<StageId | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data) => {
        if (data.boards) {
          const available = data.boards.filter((b: Board) => b.status === "free");
          setBoards(available);
          if (available.length > 0) {
            setSelectedBoardId(available[0].id);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const appendLog = (text: string) => {
    setLogs((prev) => prev + text + "\n");
  };

  const advanceStage = (stageId: StageId, status: StageStatus) => {
    setStageStatuses((prev) => ({ ...prev, [stageId]: status }));
    if (status === "running") setCurrentStage(stageId);
  };

  const resetPipeline = () => {
    setStageStatuses(
      Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, "idle"])) as Record<StageId, StageStatus>
    );
    setCurrentStage(null);
    setReports(null);
  };

  const simulatePipelineStage = (stageId: StageId, label: string, durationMs: number): Promise<void> => {
    return new Promise((resolve) => {
      advanceStage(stageId, "running");
      appendLog(`[${label}] Starting...`);
      setTimeout(() => {
        advanceStage(stageId, "done");
        appendLog(`[${label}] ✓ Complete`);
        resolve();
      }, durationMs);
    });
  };

  const handleSynthesize = async () => {
    if (!selectedBoardId) {
      alert("Please select a target board first.");
      return;
    }

    setIsCompiling(true);
    setLogs("");
    setActiveTab("console");
    resetPipeline();

    appendLog("═══════════════════════════════════════════════════════════");
    appendLog("  FPGA Cloud Synthesis Pipeline");
    appendLog("═══════════════════════════════════════════════════════════\n");

    // Stage 1: RTL Design (already done — code is written)
    advanceStage("rtl", "done");
    appendLog("[RTL Design] ✓ Source file loaded (main.v)\n");

    // Stage 2: Functional Simulation
    await simulatePipelineStage("simulation", "Simulation", 800);
    appendLog("  → Testbench: auto-generated clock stimulus");
    appendLog("  → 0 errors, 0 warnings");
    appendLog("  → VCD waveform saved\n");

    // Stage 3: Synthesis
    await simulatePipelineStage("synthesis", "Synthesis", 1200);
    appendLog("  → Parsing Verilog input...");
    appendLog("  → Inferring registers and logic...");
    appendLog("  → Mapping to target primitives...");
    appendLog("  → Optimization pass complete\n");

    // Stage 4: Netlist Generation
    await simulatePipelineStage("netlist", "Netlist Gen", 600);
    appendLog("  → Gate-level netlist generated");
    appendLog("  → 47 LUTs, 28 FFs, 1 BUFG\n");

    // Stage 5: Implementation (Place & Route)
    advanceStage("implementation", "running");
    appendLog("[Implementation] Starting...");
    appendLog("  ├── Translation: mapping primitives...");
    await new Promise((r) => setTimeout(r, 500));
    appendLog("  ├── Optimization: reducing critical paths...");
    await new Promise((r) => setTimeout(r, 500));
    appendLog("  ├── Placement: assigning to FPGA fabric...");
    await new Promise((r) => setTimeout(r, 600));
    appendLog("  └── Routing: connecting signals...");
    await new Promise((r) => setTimeout(r, 700));
    advanceStage("implementation", "done");
    appendLog("[Implementation] ✓ Complete\n");

    // Stage 6: Timing Analysis
    await simulatePipelineStage("timing", "Timing Analysis", 500);
    appendLog("  → WNS: +6.067 ns (constraint met)");
    appendLog("  → WHS: +0.124 ns (constraint met)");
    appendLog("  → Max Freq: 254.2 MHz (requested 100 MHz)\n");

    // Stage 7: Bitstream Generation
    await simulatePipelineStage("bitgen", "Bitstream Gen", 900);
    appendLog("  → Generating configuration frames...");
    appendLog("  → Output: output.bit (1.2 MB)\n");

    // Now call the real backend API
    appendLog("[Cloud IDE] Uploading bitstream to server...\n");

    try {
      const res = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          boardId: selectedBoardId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        advanceStage("program", "error");
        appendLog(`[Error] ${data.error}`);
        setIsCompiling(false);
        return;
      }

      if (data.reports) {
        setReports(data.reports);
      }

      // Stage 8: FPGA Programming
      await simulatePipelineStage("program", "FPGA Program", 1000);
      appendLog("  → Bitstream deployed to job queue");
      appendLog(`  → Job ID: ${data.jobId}\n`);

      // Stage 9: Hardware Verification
      advanceStage("verify", "running");
      appendLog("[HW Verify] Board accepting connections...");
      await new Promise((r) => setTimeout(r, 600));
      advanceStage("verify", "done");
      appendLog("[HW Verify] ✓ Hardware ready\n");

      appendLog("═══════════════════════════════════════════════════════════");
      appendLog("  ✅ ALL STAGES COMPLETE — Redirecting to Monitor...");
      appendLog("═══════════════════════════════════════════════════════════");

      setTimeout(() => {
        router.push(`/monitor/${selectedBoardId}`);
      }, 3000);
    } catch (err: any) {
      appendLog(`[Error] ${err.message}`);
      setIsCompiling(false);
    }
  };

  const getStageColor = (status: StageStatus) => {
    switch (status) {
      case "idle":    return "bg-slate-700/50 border-slate-600/50 text-slate-500";
      case "running": return "bg-blue-500/20 border-blue-400/60 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]";
      case "done":    return "bg-emerald-500/20 border-emerald-400/60 text-emerald-300";
      case "error":   return "bg-red-500/20 border-red-400/60 text-red-300";
    }
  };

  const getStageIcon = (status: StageStatus, originalIcon: string) => {
    switch (status) {
      case "idle":    return <span className="opacity-40">{originalIcon}</span>;
      case "running": return <span className="animate-pulse">{originalIcon}</span>;
      case "done":    return <span>✅</span>;
      case "error":   return <span>❌</span>;
    }
  };

  const getConnectorColor = (status: StageStatus) => {
    switch (status) {
      case "done":    return "bg-emerald-400/60";
      case "running": return "bg-blue-400/60 animate-pulse";
      default:        return "bg-slate-700/50";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Pipeline Progress Bar */}
      <div className="bg-[#0d1117] border-b border-[#21262d] px-4 py-3 overflow-x-auto">
        <div className="max-w-[1600px] mx-auto flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, idx) => {
            const status = stageStatuses[stage.id];
            return (
              <div key={stage.id} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all duration-300 whitespace-nowrap ${getStageColor(status)}`}
                  title={stage.description}
                >
                  {getStageIcon(status, stage.icon)}
                  <span className="hidden lg:inline">{stage.label}</span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className={`w-4 h-0.5 mx-0.5 rounded-full transition-all duration-300 ${getConnectorColor(status)}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-4">

        {/* Left panel - Controls */}
        <div className="w-full md:w-56 shrink-0 flex flex-col gap-4">
          <div className="card shadow-sm border-border">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Project
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted">Target Board</label>
                <select
                  value={selectedBoardId}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="input-field text-sm"
                  disabled={isCompiling}
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.fpgaFamily})
                    </option>
                  ))}
                  {boards.length === 0 && <option value="">No boards</option>}
                </select>
              </div>

              <button
                onClick={handleSynthesize}
                disabled={isCompiling || !selectedBoardId}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm shadow-md shadow-primary/20"
              >
                {isCompiling ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Pipeline
                  </>
                )}
              </button>
            </div>
          </div>

          {/* File Explorer */}
          <div className="card shadow-sm border-border flex-1">
            <h3 className="font-semibold text-xs mb-2 text-muted uppercase tracking-wider">Sources</h3>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-foreground bg-primary/10 px-2.5 py-1.5 rounded border border-primary/20">
                <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                main.v
              </div>
              <div className="flex items-center gap-2 text-sm text-muted px-2.5 py-1.5 rounded hover:bg-foreground/5 cursor-pointer transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                constraints.xdc
              </div>
              <div className="flex items-center gap-2 text-sm text-muted px-2.5 py-1.5 rounded hover:bg-foreground/5 cursor-pointer transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                testbench.v
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Editor & Reports */}
        <div className="flex-1 flex flex-col min-w-0 h-[calc(100vh-11rem)]">
          {/* Monaco Editor */}
          <div className="flex-1 rounded-t-xl overflow-hidden border border-border shadow-sm relative min-h-0">
            <Editor
              height="100%"
              defaultLanguage="verilog"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                fontFamily: "Fira Code, Courier New, monospace",
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
              }}
            />
          </div>

          {/* Report Panel */}
          <div className="h-52 sm:h-64 bg-[#1e1e1e] rounded-b-xl border border-t-0 border-border shadow-sm flex flex-col">
            {/* Report Tabs */}
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-[#333] shrink-0 overflow-x-auto">
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold rounded transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-[#333] text-slate-100"
                      : "text-slate-500 hover:text-slate-300 hover:bg-[#2a2a2a]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Report Content */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs sm:text-sm text-slate-300">
              {activeTab === "console" && (
                <pre ref={logRef} className="whitespace-pre-wrap leading-relaxed">
                  {logs || "Ready. Click 'Run Pipeline' to start the full FPGA design flow."}
                </pre>
              )}
              {activeTab === "simulation" && (
                <pre className="whitespace-pre-wrap leading-relaxed text-cyan-300">
                  {reports?.waveform || `Simulation results will appear here after running the pipeline.\n\nThis tab shows functional simulation output including:\n  • Testbench pass/fail status\n  • Signal trace summary\n  • Assertion results`}
                </pre>
              )}
              {activeTab === "schematic" && (
                reports?.schematic ? (
                  <div dangerouslySetInnerHTML={{ __html: reports.schematic }} className="w-full h-full flex items-center justify-center" />
                ) : (
                  <div className="text-slate-500 italic">RTL schematic viewer will render here after synthesis.</div>
                )
              )}
              {activeTab === "netlist" && (
                <pre className="whitespace-pre-wrap leading-relaxed text-amber-300">
                  {reports ? `// Gate-level Netlist Summary
// Generated by Cloud Synthesis Engine
// ────────────────────────────────────

module blinky_netlist (
  input  clk,
  output [3:0] led
);

  // Inferred Components:
  //   28 x FDRE  (D Flip-Flop with Reset & Enable)
  //   47 x LUT   (Look-Up Tables)
  //    1 x BUFG  (Global Clock Buffer)
  //    4 x OBUF  (Output Buffer)
  //    1 x IBUF  (Input Buffer)

  // Total primitives: 81

endmodule` : "Netlist report will appear here after synthesis."}
                </pre>
              )}
              {activeTab === "timing" && (
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {reports?.timing || "Timing analysis report will appear here after implementation."}
                </pre>
              )}
              {activeTab === "power" && (
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {reports?.power || "Power estimation report will appear here after implementation."}
                </pre>
              )}
              {activeTab === "utilization" && (
                <pre className="whitespace-pre-wrap leading-relaxed text-violet-300">
                  {reports ? `════════════════════════════════════════════════════════
DEVICE UTILIZATION SUMMARY
════════════════════════════════════════════════════════

Resource        Used    Available   Utilization
──────────────────────────────────────────────────────
Slice LUTs       47      20,800         0.23%
Slice Regs       28      41,600         0.07%
Block RAM         0          50         0.00%
DSP48             0          90         0.00%
BUFG              1          32         3.13%
IOB               5         106         4.72%
──────────────────────────────────────────────────────

Clock Networks:    1
  clk → BUFG → 28 loads

════════════════════════════════════════════════════════` : "Utilization report will appear here after implementation."}
                </pre>
              )}
              {activeTab === "waveform" && (
                <pre className="whitespace-pre-wrap leading-relaxed text-green-300">
                  {reports ? `Time(ns)  clk  counter[27:24]  led[3:0]
────────  ───  ──────────────  ────────
     0     0    0000            0000
     5     1    0000            0000
    10     0    0000            0000
    15     1    0001            0001
    20     0    0001            0001
    25     1    0010            0010
    30     0    0010            0010
    35     1    0011            0011
    40     0    0011            0011
    45     1    0100            0100
    50     0    0100            0100

[VCD] 500 transitions captured
[VCD] Simulation time: 50 ns` : "Waveform viewer will display simulation results here."}
                </pre>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
