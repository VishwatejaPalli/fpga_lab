"use client";

import { useEffect, useState, use } from "react";
import Navbar from "@/components/navbar";
import { useRouter } from "next/navigation";
import {
  RefreshCwIcon,
  TerminalIcon,
  ZapIcon,
  RocketIcon,
  CpuIcon,
  SlidersIcon,
  GlobeIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "@/components/icons";

interface Board {
  id: string;
  name: string;
  boardType: string;
  status: "free" | "busy" | "offline" | "allocated" | "programming";
  ipAddress?: string;
  currentSessionId?: string;
}

interface HWSession {
  id: string;
  boardId: string;
  expiresAt: string;
  status: string;
}

interface Telemetry {
  cpu: {
    temp: string;
    load: string[];
    freq: string;
  };
  memory: {
    total: string;
    used: string;
    available: string;
    percent: string;
  };
  fpga: {
    overlay: string;
    vccint: string;
    vccaux: string;
    vccbram: string;
    clock: string;
  };
  power: {
    vccpint: string;
    vccpaux: string;
  };
  network: {
    ip: string;
    uptime: string;
    rxBytes: string;
    txBytes: string;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    percent: string;
  };
  timestamp: string;
}

export default function JupyterPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = use(params);
  const safeBoardId = typeof boardId === "string" ? boardId : "";
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [jupyterUrl, setJupyterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<HWSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [autoOpened, setAutoOpened] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [pynqStatus, setPynqStatus] = useState<"online" | "degraded" | "offline" | "unknown">("unknown");

  // Poll PYNQ telemetry + live hardware connectivity status
  useEffect(() => {
    if (!safeBoardId) return;

    async function fetchTelemetry() {
      try {
        const res = await fetch(`/api/pynq/${safeBoardId}`);
        const data = await res.json();
        if (res.ok) {
          setTelemetry(data.telemetry);
          setPynqStatus(data.status || "online");
        } else {
          setPynqStatus(data.status || "offline");
          setTelemetry(null);
        }
      } catch (err) {
        console.error("Failed to fetch PYNQ telemetry:", err);
        setPynqStatus("offline");
      }
    }

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [safeBoardId]);

  // Poll board DB status for real-time updates
  useEffect(() => {
    if (!safeBoardId) return;

    async function fetchBoard() {
      try {
        const res = await fetch(`/api/boards/${safeBoardId}`);
        if (res.ok) {
          const data = await res.json();
          setBoard(data.board);
        }
      } catch (err) {
        console.error("Failed to poll board:", err);
      }
    }

    const interval = setInterval(fetchBoard, 5000);
    return () => clearInterval(interval);
  }, [safeBoardId]);

  useEffect(() => {
    if (!safeBoardId) return;
    async function init() {
      try {
        setOutputs((prev) => [...prev, "Connecting to board..."]);
        const boardRes = await fetch(`/api/boards/${safeBoardId}`);
        const boardData = await boardRes.json();
        
        if (!boardRes.ok) throw new Error(boardData.error || "Failed to load board");
        setBoard(boardData.board);

        const jupyterRes = await fetch(`/api/boards/${safeBoardId}/jupyter`);
        const jupyterData = await jupyterRes.json();

        if (jupyterRes.ok) {
          setJupyterUrl(jupyterData.url);
          setOutputs((prev) => [...prev, `Jupyter isolated workspace resolved (${jupyterData.sanitizedUserId || "session"}).`]);
        } else {
          const stageTag = jupyterData.stage ? `[${jupyterData.stage}] ` : "";
          const errorMsg = `${stageTag}${jupyterData.error || "Jupyter session could not be started"}`;
          setError(errorMsg);
          setOutputs((prev) => [...prev, `Diagnostic Failure ${stageTag}: ${jupyterData.error}`]);
        }
      } catch (err: any) {
        setError(err.message);
        setOutputs((prev) => [...prev, `Error: ${err.message}`]);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [safeBoardId]);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
        setSession(data.session || null);
      } catch {
        // Ignore session fetch errors
      }
    }

    fetchSession();
    const interval = setInterval(fetchSession, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const tick = () => {
      const now = new Date();
      const expires = new Date(session.expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${mins}m ${secs}s`);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!jupyterUrl || autoOpened) return;
    const opened = window.open(jupyterUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      setAutoOpened(true);
      setOutputs((prev) => [...prev, "Opened Jupyter in a new tab."]);
    }
  }, [jupyterUrl, autoOpened]);

  async function handleEndSession() {
    setIsEndingSession(true);
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          boardId: safeBoardId,
        }),
      });
    } catch (err) {
      console.error("Failed to end session:", err);
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen pb-16 bg-background bg-grid-cockpit text-foreground transition-colors">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Cockpit HUD Header */}
        <div className="cockpit-panel p-6 rounded-2xl border border-purple-500/25 bg-purple-50/40 dark:bg-gradient-to-r dark:from-purple-950/30 dark:via-[#0e1422] dark:to-slate-900/40 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    pynqStatus === "online"
                      ? "led-glow-green"
                      : pynqStatus === "degraded"
                      ? "led-glow-amber"
                      : "led-glow-red"
                  }`}
                />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {board?.name || "PYNQ-Z2 SoC Lab"}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-bold">
                  ZYNQ-7000 ARM+PL
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-muted">
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Dual Cortex-A9 (667MHz)</span>
                <span className="opacity-40">•</span>
                <span className="text-foreground/80">Artix-7 FPGA Logic</span>
                {board?.ipAddress && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="text-muted">{board.ipAddress}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {session && (
                <div className="bg-card rounded-xl px-4 py-2 border border-border flex items-center gap-3 shadow-sm font-mono">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted font-bold">Session Remaining</div>
                    <div
                      className={`text-sm font-bold tracking-tight ${
                        timeRemaining === "Expired"
                          ? "text-rose-500 dark:text-rose-400"
                          : timeRemaining && parseInt(timeRemaining) < 5
                          ? "text-amber-500 dark:text-amber-400 animate-pulse"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {timeRemaining || "..."}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => window.location.reload()}
                className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl bg-card text-foreground border border-border hover:bg-muted transition-all flex items-center gap-2 shadow-sm"
                title="Reset Connection"
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                <span>Reconnect</span>
              </button>

              <button
                onClick={() => router.push(`/monitor/${safeBoardId}`)}
                className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-600/25 transition-all flex items-center gap-2 shadow-sm"
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Lab Bench</span>
              </button>

              <button
                onClick={handleEndSession}
                disabled={isEndingSession}
                className="px-4 py-2 text-xs font-mono font-medium text-white transition-all duration-200 bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25 flex items-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isEndingSession ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Ending...</span>
                  </>
                ) : (
                  <>
                    <span>⏹</span>
                    <span>Release SoC</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Rack: Status & Launchers */}
          <div className="space-y-6">
            {/* Session Health Panel */}
            <div className="cockpit-panel p-5 rounded-2xl border border-border">
              <h2 className="font-semibold text-foreground text-sm mb-4 pb-2 border-b border-border flex items-center gap-2">
                <ZapIcon className="w-4 h-4 text-amber-500" />
                <span>SoC Hardware Status</span>
              </h2>

              <div className="text-xs font-mono space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted">PYNQ Gateway</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        pynqStatus === "online"
                          ? "led-glow-green"
                          : pynqStatus === "degraded"
                          ? "led-glow-amber"
                          : "led-glow-red"
                      }`}
                    />
                    <span className={pynqStatus === "online" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {pynqStatus.toUpperCase()}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted">Jupyter Lab</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        error ? "led-glow-red" : loading ? "led-glow-amber" : "led-glow-green"
                      }`}
                    />
                    <span className={error ? "text-rose-500 dark:text-rose-400" : loading ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {error ? "FAILED" : loading ? "PROVISIONING" : "RUNNING"}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted">IP Binding</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{board?.ipAddress || "192.168.2.99"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted">Board Lease</span>
                  <span className="text-foreground uppercase">{board?.status || "BUSY"}</span>
                </div>
              </div>
            </div>

            {/* Jupyter Gateway Access Card */}
            <div className="cockpit-panel p-5 rounded-2xl border border-border">
              <h2 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-purple-400" /> JupyterLab Environment
              </h2>
              <p className="text-xs text-muted mb-3">
                Interactive Python kernel running directly on the ARM Cortex-A9 processor.
              </p>

              <div className="text-[11px] font-mono bg-muted/40 border border-border rounded-xl p-3 text-foreground break-all mb-4">
                {jupyterUrl || "Resolving isolated session URL..."}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => jupyterUrl && window.open(jupyterUrl, "_blank", "noopener,noreferrer")}
                  className="w-full py-2.5 px-4 rounded-xl font-mono text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={!jupyterUrl}
                >
                  <RocketIcon className="w-4 h-4" />
                  <span>Launch JupyterLab Workspace</span>
                </button>
                <button
                  onClick={() => setAutoOpened(false)}
                  className="w-full py-2 px-3 rounded-xl font-mono text-xs text-muted hover:text-foreground bg-card hover:bg-muted border border-border transition-all"
                >
                  Trigger Pop-up Launch Again
                </button>
              </div>
            </div>
          </div>

          {/* Right Area: Telemetry Dashboard & Diagnostic Feed */}
          <div className="space-y-6">
            {/* Live SoC Telemetry Gauges HUD */}
            {telemetry && (
              <div className="cockpit-panel p-6 rounded-2xl border border-border">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                  <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full led-glow-green" />
                    <span>Real-Time ZYNQ SoC Hardware Telemetry</span>
                  </h2>
                  <span className="text-[10px] font-mono text-muted">POLL: 3000ms</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* CPU Frequency & Temp */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-muted uppercase">ARM Cortex-A9</span>
                      <CpuIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-foreground">{telemetry.cpu.freq}</div>
                      <div className="text-[10px] font-mono text-muted mt-0.5">Load: {telemetry.cpu.load.join(", ")}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-mono">
                      <span className="text-muted">Temp:</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        parseFloat(telemetry.cpu.temp) > 55
                          ? "bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {telemetry.cpu.temp}
                      </span>
                    </div>
                  </div>

                  {/* DDR3 Memory */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-muted uppercase">DDR3 Memory</span>
                      <SlidersIcon className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-foreground">{telemetry.memory.percent}</div>
                      <div className="text-[10px] font-mono text-muted mt-0.5">{telemetry.memory.used} / {telemetry.memory.total}</div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden border border-border">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                          style={{ width: telemetry.memory.percent }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* FPGA PL Overlay */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-muted uppercase">PL Bitstream Overlay</span>
                      <ZapIcon className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 truncate bg-card border border-border px-2 py-1 rounded">
                        {telemetry.fpga.overlay || "base.bit"}
                      </div>
                      <div className="text-[10px] font-mono text-muted mt-1">Clock: {telemetry.fpga.clock}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-mono">
                      <span className="text-muted">VCCINT:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{telemetry.fpga.vccint}</span>
                    </div>
                  </div>

                  {/* System Network */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-muted uppercase">Ethernet Link</span>
                      <GlobeIcon className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-foreground">{telemetry.network.ip}</div>
                      <div className="text-[10px] font-mono text-muted mt-1">Uptime: {telemetry.network.uptime}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-mono">
                      <span className="text-muted">Link:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 led-glow-green" />
                        1Gbps
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Diagnostic Logs / Output Stream */}
            <div className="cockpit-panel p-5 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <ScrollTextIcon className="w-4 h-4 text-primary" />
                  <span>Provisioning &amp; Gateway Output Stream</span>
                </h2>
                <span className="text-[10px] font-mono text-muted">STDOUT LOGS</span>
              </div>

              <div className="bg-slate-950 border border-border rounded-xl p-4 font-mono text-xs text-emerald-400 max-h-[320px] overflow-y-auto shadow-inner">
                {outputs.length === 0 ? (
                  <div className="text-muted">Awaiting kernel provisioning stream...</div>
                ) : (
                  outputs.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

