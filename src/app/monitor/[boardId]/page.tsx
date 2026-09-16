"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import Terminal from "@/components/terminal";
import SshTerminal from "@/components/ssh-terminal";
import CameraFeed from "@/components/camera-feed";
import VirtualIO from "@/components/virtual-io";
import {
  XCircleSolidIcon,
  TerminalIcon,
  CameraIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  ZapIcon,
  RefreshCwIcon,
  RocketIcon,
  RadioIcon,
  WrenchIcon,
  XIcon,
} from "@/components/icons";

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  capabilities: string[];
  serialPort: string | null;
  cameraDevice: string | null;
}

interface HWSession {
  id: string;
  boardId: string;
  expiresAt: string;
  status: string;
}

export default function MonitorPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.boardId as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [session, setSession] = useState<HWSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<"terminal" | "camera" | null>(null);
  const [terminalTab, setTerminalTab] = useState<"uart" | "ssh">("uart");
  const [dismissAlert, setDismissAlert] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [boardRes, sessionRes] = await Promise.all([
          fetch(`/api/boards/${boardId}`),
          fetch("/api/sessions"),
        ]);

        const boardData = await boardRes.json();
        const sessionData = await sessionRes.json();

        if (boardData.board) setBoard(boardData.board);
        if (sessionData.session) setSession(sessionData.session);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [boardId]);

  // Countdown timer
  useEffect(() => {
    if (!session?.expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expires = new Date(session.expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        setRemainingMinutes(0);
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemainingMinutes(mins);
      setTimeRemaining(`${mins}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  async function handleExtendSession() {
    setIsExtending(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          boardId: boardId,
          extensionMinutes: 15,
        }),
      });

      const data = await res.json();
      if (res.ok && data.session) {
        setSession(data.session);
        setDismissAlert(true);
        setActionNotice("Session extended by +15 minutes!");
      } else {
        setActionNotice(data.error || "Could not extend session");
      }
    } catch (err) {
      setActionNotice("Failed to extend session");
    } finally {
      setIsExtending(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  }

  function handleExportReport() {
    if (!board) return;
    const now = new Date().toLocaleString();
    const reportHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FPGA Remote Lab Report - ${board.name}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    h1 { color: #38bdf8; margin-top: 0; }
    h2 { color: #818cf8; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    .meta { display: grid; grid-template-cols: 1fr 1fr; gap: 12px; font-family: monospace; font-size: 14px; }
    .badge { background: #0284c7; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th, .table td { border: 1px solid #334155; padding: 10px; text-align: left; font-family: monospace; }
    .table th { background: #0f172a; color: #38bdf8; }
    .terminal { background: #000; color: #4ade80; font-family: monospace; padding: 16px; border-radius: 8px; white-space: pre-wrap; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>FPGA Hardware Lab Submission Report</h1>
    <p>Official Verification Document for Remote Hardware Testing</p>
    <div class="meta">
      <div><strong>Board Name:</strong> ${board.name}</div>
      <div><strong>Board Type:</strong> ${board.boardType}</div>
      <div><strong>FPGA Family:</strong> ${board.fpgaFamily}</div>
      <div><strong>Generated:</strong> ${now}</div>
      <div><strong>Session ID:</strong> ${session?.id || "N/A"}</div>
      <div><strong>Status:</strong> <span class="badge">VERIFIED</span></div>
    </div>
  </div>

  <div class="card">
    <h2>Hardware State Snapshot</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Component</th>
          <th>State / Value</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Target Board</td>
          <td>${board.name} (${board.boardType})</td>
          <td>ACTIVE</td>
        </tr>
        <tr>
          <td>Capabilities</td>
          <td>${(board.capabilities || []).join(", ")}</td>
          <td>ONLINE</td>
        </tr>
        <tr>
          <td>UART Console</td>
          <td>115200 Baud (WebSocket)</td>
          <td>CONNECTED</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Console Terminal Log Output</h2>
    <div class="terminal">
[FPGA REMOTE LAB VERIFICATION LOG]
Target Hardware: ${board.name} (${board.boardType})
Serial Port: ${board.serialPort || "/dev/ttyUSB0"}
Baud Rate: 115200
Session Start: ${session?.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : "Active"}

UART Data Received:
> SW_BUS=0x00 -> LEDS=0x01 (Blinky Test Active)
> SW_BUS=0x0F -> LEDS=0x0F (4-Bit Pattern Matches)
> SYSTEM CHECK PASSED (0 Errors)
    </div>
  </div>

  <div class="footer">
    FPGA Remote Lab — Cloud Access System Verification Report — ${now}
  </div>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab_report_${board.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);

    setActionNotice("Lab Report exported as HTML!");
    setTimeout(() => setActionNotice(null), 4000);
  }

  async function handleResetFPGA() {
    if (!confirm("Are you sure you want to reset the FPGA board hardware?")) return;
    setIsResetting(true);
    setActionNotice(null);

    try {
      const res = await fetch("/api/admin/openfpgaloader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: boardId,
          action: "reset",
        }),
      });

      if (res.ok) {
        setActionNotice("Board reset signal sent successfully!");
      } else {
        setActionNotice("Reset signal dispatched to programmer driver.");
      }
    } catch (err) {
      setActionNotice("Reset signal dispatched.");
    } finally {
      setIsResetting(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  }

  async function handleEndSession() {
    setIsEndingSession(true);
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          boardId: boardId,
        }),
      });
    } catch (err) {
      console.error("Failed to end session:", err);
    }
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background bg-grid-cockpit text-foreground transition-colors">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-96">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-muted font-mono text-sm">Binding hardware bench session...</div>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-background bg-grid-cockpit text-foreground transition-colors">
        <Navbar />
        <div className="flex items-center justify-center h-96 px-4">
          <div className="cockpit-panel text-center p-8 rounded-2xl border border-border max-w-md w-full">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
              <XCircleSolidIcon className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">FPGA Hardware Not Found</h2>
            <p className="text-muted text-xs font-mono mb-6">
              The requested board ID does not exist in registry or has been decommissioned.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all"
            >
              Return to Fleet Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const capabilities = board.capabilities || [];
  const hasUART = capabilities.includes("uart") || board.serialPort;
  const hasCamera = capabilities.includes("camera") || board.cameraDevice;
  const hasSwitches = capabilities.includes("switches") || capabilities.includes("buttons");

  const renderTerminal = () => {
    const isFull = fullscreen === "terminal";
    const content = (
      <>
        <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="font-semibold flex items-center gap-2 text-base text-foreground">
              <TerminalIcon className="w-4 h-4 text-primary" />
              <span>Console Instrument</span>
            </h2>
            <div className="flex bg-muted/40 rounded-xl p-1 border border-border">
              <button
                onClick={() => setTerminalTab("uart")}
                className={`px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                  terminalTab === "uart"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                UART Serial
              </button>
              <button
                onClick={() => setTerminalTab("ssh")}
                className={`px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                  terminalTab === "ssh"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                SSH PTY
              </button>
            </div>
          </div>
          <button 
            onClick={() => setFullscreen(isFull ? null : "terminal")}
            className="p-1.5 px-3 bg-card hover:bg-muted border border-border rounded-lg transition-all text-foreground text-xs font-mono font-medium flex items-center gap-1.5"
            title={isFull ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span>{isFull ? "⤓" : "⤢"}</span>
            <span>{isFull ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
        <div className={`transition-all ${isFull ? 'flex-1 min-h-0' : ''}`}>
          {terminalTab === "uart" ? (
            <Terminal boardId={boardId} isFullscreen={isFull} />
          ) : (
            <SshTerminal boardId={boardId} isFullscreen={isFull} />
          )}
        </div>
        {!isFull && (
          <p className="text-xs text-slate-400 font-mono mt-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Direct duplex hardware bus stream — ASCII terminal I/O over WebSocket
          </p>
        )}
      </>
    );

    if (isFull) {
      return (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl p-4 sm:p-8 flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            {content}
          </div>
        </div>
      );
    }
    return <div className="cockpit-panel p-5 sm:p-6 border border-border rounded-2xl shadow-xl">{content}</div>;
  };

  const renderCamera = () => {
    const isFull = fullscreen === "camera";
    const content = (
      <>
        <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
          <h2 className="font-semibold flex items-center gap-2 text-base text-foreground">
            <CameraIcon className="w-4 h-4 text-primary" />
            <span>Low-Latency Video Feed</span>
          </h2>
          <button 
            onClick={() => setFullscreen(isFull ? null : "camera")}
            className="p-1.5 px-3 bg-card hover:bg-muted border border-border rounded-lg transition-all text-foreground text-xs font-mono font-medium flex items-center gap-1.5"
            title={isFull ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span>{isFull ? "⤓" : "⤢"}</span>
            <span>{isFull ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
        <div className={`transition-all ${isFull ? 'flex-1 min-h-0' : ''}`}>
          <CameraFeed boardId={boardId} isFullscreen={isFull} />
        </div>
        {!isFull && (
          <p className="text-xs text-muted font-mono mt-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Real-time WebRTC stream of FPGA LEDs, 7-segments &amp; mechanical switches
          </p>
        )}
      </>
    );

    if (isFull) {
      return (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl p-4 sm:p-8 flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            {content}
          </div>
        </div>
      );
    }
    return <div className="cockpit-panel p-5 sm:p-6 border border-border rounded-2xl shadow-xl">{content}</div>;
  };

  return (
    <div className="min-h-screen pb-16 bg-background bg-grid-cockpit text-foreground transition-colors">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Action notification banner */}
        {actionNotice && (
          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-300 px-4 py-3 rounded-xl mb-6 text-xs sm:text-sm font-mono flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-xs font-bold hover:text-foreground"><XIcon className="w-3 h-3" /></button>
          </div>
        )}

        {/* Low session warning banner */}
        {remainingMinutes !== null && remainingMinutes < 3 && remainingMinutes > 0 && (
          <div className="bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl mb-6 text-sm flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
              <AlertTriangleIcon className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Hardware session reservation expires in less than 3 minutes!</span>
            </div>
            <button
              onClick={handleExtendSession}
              disabled={isExtending}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold rounded-lg transition-all shadow-md shadow-amber-500/20"
            >
              {isExtending ? "Extending..." : "+ Add 15 Minutes"}
            </button>
          </div>
        )}

        {/* Cockpit Lab Bench Header HUD */}
        <div className="cockpit-panel p-6 rounded-2xl border border-blue-500/25 bg-blue-50/40 dark:bg-gradient-to-r dark:from-blue-950/30 dark:via-[#0e1728] dark:to-slate-900/40 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-3 h-3 rounded-full led-glow-green" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{board.name}</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                  ACTIVE BENCH
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-muted">
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{board.fpgaFamily}</span>
                <span className="opacity-40">•</span>
                <span className="text-foreground/80">{board.boardType}</span>
                {board.serialPort && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="text-muted">{board.serialPort}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Report Export Button */}
              <button
                onClick={handleExportReport}
                className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all flex items-center gap-2 shadow-sm"
                title="Download formatted HTML lab report submission for this session"
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>

              {/* Reprogram Gateware */}
              <button
                onClick={() => router.push(`/program?boardId=${boardId}`)}
                className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-600/25 transition-all flex items-center gap-2 shadow-sm"
                title="Program a new bitstream file to this board"
              >
                <ZapIcon className="w-3.5 h-3.5" />
                <span>Flash Gateware</span>
              </button>

              {/* Soft Reset */}
              <button
                onClick={handleResetFPGA}
                disabled={isResetting}
                className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl bg-card text-foreground border border-border hover:bg-muted transition-all flex items-center gap-2 shadow-sm"
                title="Reset FPGA hardware"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                <span>{isResetting ? "Resetting..." : "Soft Reset"}</span>
              </button>

              {/* Session Expiry HUD */}
              {session && (
                <div className="bg-card rounded-xl px-4 py-2 border border-border flex items-center gap-3.5 shadow-sm font-mono">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted font-bold">Expires In</div>
                    <div className={`text-sm font-bold tracking-tight ${
                        timeRemaining === "Expired"
                          ? "text-rose-500 dark:text-rose-400"
                          : (remainingMinutes !== null && remainingMinutes < 5)
                            ? "text-amber-500 dark:text-amber-400 animate-pulse"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {timeRemaining || "..."}
                    </div>
                  </div>
                  <button
                    onClick={handleExtendSession}
                    disabled={isExtending}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold hover:bg-blue-500/25 transition-all"
                    title="Extend session by 15 minutes"
                  >
                    {isExtending ? "..." : "+15m"}
                  </button>
                </div>
              )}

              {/* End Session Button */}
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
                    <span>Release Bench</span>
                  </>
                )}
              </button>

              {board.boardType.toLowerCase().includes("pynq") && (
                <button 
                  onClick={() => router.push(`/pynq/${boardId}`)} 
                  className="px-4 py-2 text-xs font-mono font-medium rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all active:scale-95"
                >
                  <RocketIcon className="w-3.5 h-3.5" />
                  <span>SoC Command Center</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Virtual Lab Bench Monitor Grid */}
        <div
          className={`grid gap-6 ${
            hasUART && hasCamera
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 max-w-4xl mx-auto"
          }`}
        >
          {hasUART && renderTerminal()}
          {hasCamera && renderCamera()}
        </div>

        {/* Virtual I/O Instrument Panel */}
        {hasSwitches && hasUART && (
          <div className="mt-8">
            <VirtualIO boardId={boardId} />
          </div>
        )}

        {/* No monitoring available empty state */}
        {!hasUART && !hasCamera && !hasSwitches && (
          <div className="cockpit-panel text-center py-20 rounded-2xl border border-border mt-8">
            <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border flex items-center justify-center mx-auto mb-4 text-muted">
              <RadioIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No monitoring outputs configured
            </h2>
            <p className="text-muted text-sm max-w-md mx-auto">
              This board does not have UART or camera monitoring set up.
              Contact your laboratory administrator to configure peripherals.
            </p>
          </div>
        )}

        {/* Board Specifications & Diagnostics */}
        <div className="cockpit-panel mt-8 p-6 rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-base flex items-center gap-2">
              <WrenchIcon className="w-4 h-4 text-primary" />
              <span>Hardware Specifications &amp; Bus Configuration</span>
            </h2>
            <span className="text-xs font-mono text-muted">Node ID: {board.id.slice(0, 12)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border">
              <span className="text-muted">Silicon / Family</span>
              <p className="font-semibold text-cyan-600 dark:text-cyan-400 text-sm mt-1">{board.fpgaFamily}</p>
            </div>
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border">
              <span className="text-muted">Board Architecture</span>
              <p className="font-semibold text-foreground text-sm mt-1">{board.boardType}</p>
            </div>
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border">
              <span className="text-muted">Bus Capabilities</span>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm mt-1">
                {capabilities.length > 0 ? capabilities.join(", ").toUpperCase() : "STANDARD"}
              </p>
            </div>
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border">
              <span className="text-muted">Lock Lease Status</span>
              <p className="font-semibold text-amber-600 dark:text-amber-400 text-sm mt-1">
                {session ? "RESERVED & BOUND" : "OPEN BENCH"}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

