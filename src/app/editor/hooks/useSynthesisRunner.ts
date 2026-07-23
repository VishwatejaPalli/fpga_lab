"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface SynthResult {
  jobId: string;
  status: string;
  logs: string;
  bitstreamPath: string | null;
  bitstreamName: string | null;
  reports: {
    schematic: string;
    timing: string;
    power: string;
    area: string;
    waveform: string;
  };
  createdAt: string;
  completedAt: string | null;
}

export const DEVICE_RESOURCES: Record<
  string,
  { luts: number; ffs: number; brams: number; dsps: number }
> = {
  "xc7z020clg400-1": { luts: 53200, ffs: 106400, brams: 140, dsps: 220 },
  "xc7a35tcpg236-1": { luts: 20800, ffs: 41600, brams: 50, dsps: 90 },
  "xc7a35tcsg324-1": { luts: 20800, ffs: 41600, brams: 50, dsps: 90 },
  up5k: { luts: 5280, ffs: 5280, brams: 30, dsps: 8 },
};

function extractNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? parseInt(match[1], 10) : 0;
}

function extractString(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

export function useSynthesisRunner() {
  const [synthJobId, setSynthJobId] = useState<string | null>(null);
  const [lastSynthResult, setLastSynthResult] = useState<SynthResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isImplementing, setIsImplementing] = useState(false);
  const [isBitgen, setIsBitgen] = useState(false);

  const [synthStatus, setSynthStatus] = useState<string>("Not started");
  const [implStatus, setImplStatus] = useState<string>("Not started");
  const [wnsValue, setWnsValue] = useState<string>("--");
  const [tnsValue, setTnsValue] = useState<string>("--");
  const [lutUsage, setLutUsage] = useState<number>(0);
  const [ffUsage, setFfUsage] = useState<number>(0);
  const [bramUsage, setBramUsage] = useState<number>(0);
  const [dspUsage, setDspUsage] = useState<number>(0);
  const [schematicSvg, setSchematicSvg] = useState<string>("");
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);

  const synthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling interval
  useEffect(() => {
    return () => {
      if (synthPollRef.current) clearInterval(synthPollRef.current);
    };
  }, []);

  // Fetch job history from API
  const fetchHistoryJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          setHistoryJobs(data.jobs);
        }
      }
    } catch {
      // Ignore network errors on background fetch
    }
  }, []);

  useEffect(() => {
    fetchHistoryJobs();
  }, [fetchHistoryJobs]);

  const applySynthesisResults = useCallback(
    (result: SynthResult, projectPart: string, appendTclLogs: (lines: string[]) => void) => {
      setLastSynthResult(result);

      const partMatch = projectPart.match(/\(([^)]+)\)/);
      const partName = partMatch ? partMatch[1] : "xc7z020clg400-1";
      const deviceRes = DEVICE_RESOURCES[partName] || {
        luts: 53200,
        ffs: 106400,
        brams: 140,
        dsps: 220,
      };

      const areaText = result.reports?.area || "";
      const rawLuts =
        extractNumber(areaText, /LUTs?:\s*(\d+)/i) || extractNumber(areaText, /ICESTORM_LC:\s*(\d+)/i);
      const rawFFs =
        extractNumber(areaText, /Flip-flops?:\s*(\d+)/i) || extractNumber(areaText, /\$dff.*?(\d+)/i);

      setLutUsage(deviceRes.luts > 0 ? Math.round((rawLuts / deviceRes.luts) * 100) : 0);
      setFfUsage(deviceRes.ffs > 0 ? Math.round((rawFFs / deviceRes.ffs) * 100) : 0);
      setBramUsage(0);
      setDspUsage(0);

      const timingText = result.reports?.timing || "";
      const wnsStr = extractString(timingText, /(?:WNS|Worst Negative Slack)[^:]*:\s*(\+?[\d.]+\s*ns)/i);
      const tnsStr = extractString(timingText, /(?:TNS|Total Negative Slack)[^:]*:\s*([\d.]+\s*ns)/i);
      const freqStr = extractString(timingText, /Max Clock Frequency:\s*([\d.]+\s*MHz)/i);
      setWnsValue(wnsStr || (freqStr ? `Fmax: ${freqStr}` : "--"));
      setTnsValue(tnsStr || "0.000 ns");

      if (result.reports?.schematic) {
        setSchematicSvg(result.reports.schematic);
      }

      if (result.logs) {
        const logLines = result.logs.split("\n").filter((l: string) => l.trim()).slice(-30);
        appendTclLogs(logLines);
      }
    },
    []
  );

  const handleRunSynthesis = useCallback(
    async (
      selectedBoardId: string,
      topModuleName: string,
      projectPart: string,
      files: Record<string, string>,
      appendTclLogs: (lines: string[]) => void,
      openTab: (id: string, label: string, type: "file" | "view") => void,
      syncFiles: (files: Record<string, string>) => Promise<boolean>
    ) => {
      if (!selectedBoardId) {
        appendTclLogs([
          "ERROR: No target board selected. Select a board in Project Settings or Board Part section.",
        ]);
        return;
      }

      setIsSynthesizing(true);
      setSynthStatus("Running");
      setImplStatus("Not started");
      appendTclLogs([
        "Tcl% synth_design -top " + topModuleName + " -part " + projectPart,
        "INFO: Saving workspace files to server...",
      ]);

      try {
        await syncFiles(files);
        appendTclLogs([
          `INFO: ${Object.keys(files).length} file(s) synced to workspace.`,
          "INFO: Submitting synthesis job to compilation server...",
        ]);

        const res = await fetch("/api/synthesis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId: selectedBoardId }),
        });
        const data = await res.json();

        if (!res.ok) {
          setSynthStatus("Failed");
          appendTclLogs([`ERROR: ${data.error || "Synthesis submission failed"}`]);
          setIsSynthesizing(false);
          return;
        }

        const jobId = data.jobId;
        setSynthJobId(jobId);
        appendTclLogs([
          `INFO: Synthesis job enqueued (ID: ${jobId.slice(0, 8)}...).`,
          "INFO: Waiting for compilation server...",
        ]);

        if (synthPollRef.current) clearInterval(synthPollRef.current);

        synthPollRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/synthesis/status?jobId=${jobId}`);
            const statusData = await statusRes.json();

            if (!statusRes.ok) return;

            if (statusData.status === "success") {
              if (synthPollRef.current) clearInterval(synthPollRef.current);
              synthPollRef.current = null;

              setSynthStatus("Complete");
              setImplStatus("Complete");
              applySynthesisResults(statusData as SynthResult, projectPart, appendTclLogs);
              appendTclLogs(["INFO: Exiting Synthesis Engine: SUCCESS."]);
              openTab("view:schematic", "Schematic Netlist", "view");
              setIsSynthesizing(false);
              fetchHistoryJobs();
            } else if (statusData.status === "failed") {
              if (synthPollRef.current) clearInterval(synthPollRef.current);
              synthPollRef.current = null;

              setSynthStatus("Failed");
              setLastSynthResult(statusData as SynthResult);
              if (statusData.logs) {
                const errorLines = statusData.logs
                  .split("\n")
                  .filter((l: string) => l.trim())
                  .slice(-15);
                appendTclLogs(errorLines);
              }
              appendTclLogs(["ERROR: Synthesis failed. See logs above."]);
              setIsSynthesizing(false);
              fetchHistoryJobs();
            }
          } catch {
            // Keep polling on transient network error
          }
        }, 2000);
      } catch {
        setSynthStatus("Failed");
        appendTclLogs(["ERROR: Network error during synthesis submission."]);
        setIsSynthesizing(false);
      }
    },
    [applySynthesisResults, fetchHistoryJobs]
  );

  const handleRunImplementation = useCallback(
    async (
      appendTclLogs: (lines: string[]) => void,
      openTab: (id: string, label: string, type: "file" | "view") => void
    ) => {
      setIsImplementing(true);

      if (!lastSynthResult || lastSynthResult.status !== "success") {
        appendTclLogs([
          "Tcl% opt_design",
          "ERROR: No successful synthesis run found. Run Synthesis first to generate implementation results.",
        ]);
        setIsImplementing(false);
        return;
      }

      appendTclLogs(["Tcl% opt_design", "Tcl% place_design", "Tcl% route_design"]);

      const timingText = lastSynthResult.reports?.timing || "";
      const areaText = lastSynthResult.reports?.area || "";

      if (timingText) {
        const timingLines = timingText.split("\n").filter((l: string) => l.trim()).slice(0, 8);
        appendTclLogs(timingLines);
      }
      if (areaText) {
        const areaLines = areaText.split("\n").filter((l: string) => l.trim()).slice(0, 8);
        appendTclLogs(areaLines);
      }

      setImplStatus("Complete");
      appendTclLogs([
        `INFO: WNS: ${wnsValue}, TNS: ${tnsValue}`,
        "INFO: Exiting Implementation Engine: SUCCESS.",
      ]);
      openTab("view:device", "Device Floorplan", "view");
      setIsImplementing(false);
    },
    [lastSynthResult, wnsValue, tnsValue]
  );

  const handleGenerateBitstream = useCallback(
    async (projectName: string, appendTclLogs: (lines: string[]) => void) => {
      setIsBitgen(true);

      if (!lastSynthResult || lastSynthResult.status !== "success") {
        appendTclLogs([
          `Tcl% write_bitstream -force ${projectName}.bit`,
          "ERROR: Synthesis must complete successfully before generating a bitstream.",
        ]);
        setIsBitgen(false);
        return;
      }

      if (lastSynthResult.bitstreamPath && lastSynthResult.bitstreamName) {
        appendTclLogs([
          `Tcl% write_bitstream -force ${lastSynthResult.bitstreamName}`,
          `INFO: Bitstream generated: ${lastSynthResult.bitstreamName}`,
          `INFO: Bitstream file path: ${lastSynthResult.bitstreamPath}`,
          "INFO: Bitgen completed successfully.",
          "INFO: Use 'Program Board' to flash this bitstream onto the target FPGA.",
        ]);
      } else {
        appendTclLogs([
          `Tcl% write_bitstream -force ${projectName}.bit`,
          "WARNING: Synthesis completed but no bitstream file was generated.",
          "INFO: This may occur if NextPNR/icepack tools are not installed on the server.",
        ]);
      }

      setIsBitgen(false);
    },
    [lastSynthResult]
  );

  return {
    synthJobId,
    lastSynthResult,
    isSynthesizing,
    isImplementing,
    isBitgen,
    synthStatus,
    implStatus,
    wnsValue,
    tnsValue,
    lutUsage,
    ffUsage,
    bramUsage,
    dspUsage,
    schematicSvg,
    historyJobs,
    handleRunSynthesis,
    handleRunImplementation,
    handleGenerateBitstream,
  };
}
