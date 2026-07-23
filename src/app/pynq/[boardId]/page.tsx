"use client";

import { useEffect, useState, use } from "react";
import Navbar from "@/components/navbar";
import { useRouter } from "next/navigation";

interface Board {
  id: string;
  name: string;
  boardType: string;
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

  useEffect(() => {
    if (!safeBoardId || error) return;

    async function fetchTelemetry() {
      try {
        const res = await fetch(`/api/pynq/${safeBoardId}`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data.telemetry);
        }
      } catch (err) {
        console.error("Failed to fetch PYNQ telemetry:", err);
      }
    }

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [safeBoardId, error]);

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
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <div className="text-xs text-muted uppercase tracking-wider">Advanced SoC Lab</div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {board?.name || "PYNQ Board"}
            </h1>
            <p className="text-sm text-muted font-mono mt-1">
              Jupyter session for {board?.boardType || "pynq"} • Board ID {safeBoardId ? safeBoardId.slice(0, 8) : "--"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {session && (
              <div className="bg-background/50 rounded-xl px-4 py-2 border border-border/50 backdrop-blur-sm shadow-inner">
                <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Session Expires In</div>
                <div className={`text-xl font-mono font-bold tracking-tight ${
                    timeRemaining === "Expired"
                      ? "text-danger"
                      : timeRemaining && parseInt(timeRemaining) < 5
                        ? "text-warning animate-pulse"
                        : "text-success"
                  }`}
                >
                  {timeRemaining || "..."}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary text-sm"
              >
                Reset Connection
              </button>
              <button
                onClick={() => router.push(`/monitor/${safeBoardId}`)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <span>📟</span> Monitor
              </button>
              <button
                onClick={handleEndSession}
                disabled={isEndingSession}
                className="relative inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all duration-300 bg-red-600 rounded-lg shadow-lg hover:bg-red-500 hover:shadow-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isEndingSession ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Ending...</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center justify-center w-5 h-5 bg-white/20 rounded group-hover:bg-white/30 transition-colors">⏹</span>
                    <span>End Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold mb-3">Session Status</h2>
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Hardware</span>
                  <span className="text-success font-medium">Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Jupyter</span>
                  <span className={`font-medium ${error ? "text-danger" : loading ? "text-warning" : "text-success"}`}>
                    {error ? "Offline" : loading ? "Connecting" : "Active"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Session Ends</span>
                  <span className={`font-medium ${timeRemaining === "Expired" ? "text-danger" : "text-foreground"}`}>
                    {timeRemaining || "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Endpoint</span>
                  <span className="text-xs font-mono">{jupyterUrl || "--"}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold mb-3">Quick Tips</h2>
              <ul className="text-xs text-muted space-y-2">
                <li>Use Jupyter to run Python notebooks on the Z2 SoC.</li>
                <li>Overlays control the programmable logic side.</li>
                <li>Reset Connection if the notebook feels stale.</li>
              </ul>
            </div>

            <div className="card">
              <h2 className="font-semibold mb-3">Jupyter URL</h2>
              <div className="text-xs font-mono bg-background border border-border rounded-lg px-3 py-2 break-all">
                {jupyterUrl || "Waiting for URL..."}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => jupyterUrl && window.open(jupyterUrl, "_blank", "noopener,noreferrer")}
                  className="btn-primary text-xs"
                  disabled={!jupyterUrl}
                >
                  Open Jupyter
                </button>
                <button
                  onClick={() => setAutoOpened(false)}
                  className="btn-secondary text-xs"
                >
                  Re-open automatically
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4 min-h-[520px]">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-muted">Connecting to board hardware...</p>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-6">
                <div className="max-w-md w-full bg-card border border-danger/20 rounded-xl p-8 text-center">
                  <div className="w-14 h-14 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Connection Failed</h2>
                  <p className="text-sm text-muted mb-6">{error}</p>
                  <div className="space-y-3">
                    <button onClick={() => window.location.reload()} className="btn-primary w-full">Try Again</button>
                    <button onClick={() => router.push("/dashboard")} className="btn-secondary w-full">Return to Dashboard</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-6">
                {/* Real-time Telemetry Dashboard */}
                {telemetry && (
                  <div>
                    <h2 className="font-semibold mb-3 flex items-center gap-1.5 text-sm">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Live PYNQ Board Telemetry
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* CPU Stats */}
                      <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">CPU Stats</span>
                          <span className="text-sm">💻</span>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-foreground">{telemetry.cpu.freq}</div>
                          <div className="text-[10px] text-muted mt-0.5">Load: {telemetry.cpu.load.join(", ")}</div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] text-muted">Temp:</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            parseFloat(telemetry.cpu.temp) > 48 
                              ? "bg-red-100 text-red-700" 
                              : "bg-green-100 text-green-700"
                          }`}>
                            {telemetry.cpu.temp}
                          </span>
                        </div>
                      </div>

                      {/* Memory Stats */}
                      <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Memory</span>
                          <span className="text-sm">🧠</span>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-foreground">{telemetry.memory.percent}</div>
                          <div className="text-[10px] text-muted mt-0.5">{telemetry.memory.used} / {telemetry.memory.total}</div>
                        </div>
                        <div className="mt-3">
                          <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className="bg-purple-500 h-1 rounded-full transition-all duration-500" 
                              style={{ width: telemetry.memory.percent }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* FPGA Overlay */}
                      <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">FPGA Overlay</span>
                          <span className="text-sm">⚡</span>
                        </div>
                        <div>
                          <div className="text-xs font-mono font-bold text-foreground truncate bg-gray-50 border px-1 rounded mt-0.5">{telemetry.fpga.overlay}</div>
                          <div className="text-[10px] text-muted mt-0.5">Clock: {telemetry.fpga.clock}</div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] text-muted">Power:</span>
                          <span className="text-[10px] font-bold text-amber-600">{telemetry.fpga.vccint}</span>
                        </div>
                      </div>

                      {/* Network */}
                      <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">System Net</span>
                          <span className="text-sm">🌐</span>
                        </div>
                        <div>
                          <div className="text-xs font-mono font-bold text-foreground">{telemetry.network.ip}</div>
                          <div className="text-[10px] text-muted mt-0.5">Uptime: {telemetry.network.uptime}</div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] text-muted">Status:</span>
                          <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            online
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Outputs section */}
                <div className="flex-1 flex flex-col min-h-[240px]">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-sm">Outputs</h2>
                    <span className="text-[10px] text-muted">System feed</span>
                  </div>
                  <div className="flex-1 bg-background border border-border rounded-lg p-3 font-mono text-xs overflow-y-auto max-h-[300px]">
                    {outputs.length === 0 ? (
                      <div className="text-muted">No output yet.</div>
                    ) : (
                      outputs.map((line, idx) => (
                        <div key={idx} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
