"use client";

import { useState, useCallback } from "react";

export function useSimulationRunner() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [waves, setWaves] = useState<any>(null);
  const [globalRadix, setGlobalRadix] = useState<"hex" | "bin" | "dec">("hex");

  const handleRunSimulation = useCallback(
    async (
      files: Record<string, string>,
      appendTclLogs: (lines: string[]) => void,
      openTab: (id: string, label: string, type: "file" | "view") => void
    ) => {
      setIsSimulating(true);
      appendTclLogs([
        "Tcl% launch_simulation -mode behavioral",
        "INFO: Compiling testbench and design files...",
        "INFO: Running simulation to 1000ns...",
      ]);

      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        });
        const data = await res.json();
        if (res.ok && data.waveform) {
          setWaves(data.waveform);
          appendTclLogs(["INFO: Simulation completed. Waveform generated."]);
          openTab("view:waveform", "Behavioral Waveform", "view");
        } else {
          appendTclLogs([`ERROR: ${data.error || "Simulation failed"}`]);
        }
      } catch {
        appendTclLogs(["ERROR: Simulation network error"]);
      } finally {
        setIsSimulating(false);
      }
    },
    []
  );

  return {
    isSimulating,
    waves,
    globalRadix,
    setGlobalRadix,
    handleRunSimulation,
  };
}
