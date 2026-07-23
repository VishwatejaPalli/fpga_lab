"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export function useTclConsole(projectName: string, projectPath: string) {
  const [tclLogs, setTclLogs] = useState<string[]>([
    "FPGA Lab Design Suite v2026.1 (64-bit)",
    "Cloud Engine Build 5076996 on Tue May 21 2026",
    "Copyright 2026 FPGA Remote Lab. All Rights Reserved.",
    `Tcl% open_project ${projectPath}/${projectName}.xpr`,
    `INFO: [Project 1-19] Opened project ${projectName}.xpr successfully.`,
  ]);
  const [tclInput, setTclInput] = useState("");
  const tclBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tclBottomRef.current) {
      tclBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [tclLogs]);

  const appendTclLogs = useCallback((lines: string[]) => {
    setTclLogs((prev) => [...prev, ...lines]);
  }, []);

  const handleTclSubmit = useCallback(
    (
      e: React.FormEvent,
      actions: {
        runSynthesis: () => void;
        runSimulation: () => void;
        runImplementation: () => void;
        generateBitstream: () => void;
        openTab: (id: string, label: string, type: "file" | "view") => void;
      }
    ) => {
      e.preventDefault();
      if (!tclInput.trim()) return;

      const cmd = tclInput.trim();
      setTclLogs((prev) => [...prev, `Tcl% ${cmd}`]);
      setTclInput("");

      if (cmd === "clear") {
        setTclLogs(["Tcl% "]);
      } else if (cmd.startsWith("synth_design")) {
        actions.runSynthesis();
      } else if (cmd.startsWith("run_simulation") || cmd.startsWith("launch_simulation")) {
        actions.runSimulation();
      } else if (
        cmd.startsWith("opt_design") ||
        cmd.startsWith("place_design") ||
        cmd.startsWith("route_design")
      ) {
        actions.runImplementation();
      } else if (cmd.startsWith("write_bitstream")) {
        actions.generateBitstream();
      } else if (cmd === "report_timing") {
        actions.openTab("view:timing", "Timing Summary", "view");
        setTclLogs((prev) => [...prev, "INFO: Report Timing Summary generated."]);
      } else if (cmd === "report_utilization") {
        actions.openTab("view:utilization", "Utilization Report", "view");
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
          "  clear                                    : Clear Tcl console log",
        ]);
      } else {
        setTclLogs((prev) => [...prev, `INFO: Command '${cmd}' executed successfully.`]);
      }
    },
    [tclInput]
  );

  return {
    tclLogs,
    tclInput,
    setTclInput,
    tclBottomRef,
    appendTclLogs,
    handleTclSubmit,
  };
}
