"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import Terminal from "@/components/terminal";
import SshTerminal from "@/components/ssh-terminal";
import CameraFeed from "@/components/camera-feed";
import VirtualIO from "@/components/virtual-io";

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
  const [loading, setLoading] = useState(true);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [fullscreen, setFullscreen] = useState<"terminal" | "camera" | null>(null);
  const [terminalTab, setTerminalTab] = useState<"uart" | "ssh">("uart");

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
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${mins}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.expiresAt]);

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
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-muted">Loading...</div>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-semibold mb-2">Board not found</h2>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-primary"
            >
              Back to Dashboard
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
        <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold flex items-center gap-2 text-lg">
              📟 Console
            </h2>
            <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200">
              <button
                onClick={() => setTerminalTab("uart")}
                className={`px-3 py-1 text-xs font-semibold rounded ${terminalTab === "uart" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                UART
              </button>
              <button
                onClick={() => setTerminalTab("ssh")}
                className={`px-3 py-1 text-xs font-semibold rounded ${terminalTab === "ssh" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                SSH
              </button>
            </div>
          </div>
          <button 
            onClick={() => setFullscreen(isFull ? null : "terminal")}
            className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors text-muted hover:text-foreground"
            title={isFull ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFull ? "⤓ Exit Fullscreen" : "⤢ Fullscreen"}
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
          <p className="text-xs text-muted mt-2">
            Click the terminal and type to send data to the FPGA
          </p>
        )}
      </>
    );

    if (isFull) {
      return (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl p-4 sm:p-8 flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            {content}
          </div>
        </div>
      );
    }
    return <div className="card p-5 border-border hover:border-primary/30 transition-colors shadow-lg shadow-black/5">{content}</div>;
  };

  const renderCamera = () => {
    const isFull = fullscreen === "camera";
    const content = (
      <>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2 text-lg">
            📷 Camera Feed
          </h2>
          <button 
            onClick={() => setFullscreen(isFull ? null : "camera")}
            className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors text-muted hover:text-foreground"
            title={isFull ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFull ? "⤓ Exit Fullscreen" : "⤢ Fullscreen"}
          </button>
        </div>
        <div className={`transition-all ${isFull ? 'flex-1 min-h-0' : ''}`}>
          <CameraFeed boardId={boardId} isFullscreen={isFull} />
        </div>
        {!isFull && (
          <p className="text-xs text-muted mt-2">
            Live view of the FPGA board (LEDs, display, switches)
          </p>
        )}
      </>
    );

    if (isFull) {
      return (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl p-4 sm:p-8 flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            {content}
          </div>
        </div>
      );
    }
    return <div className="card p-5 border-border hover:border-primary/30 transition-colors shadow-lg shadow-black/5">{content}</div>;
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="card mb-6 sm:mb-8 border-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{board.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                  {board.fpgaFamily}
                </span>
                <span className="text-muted text-sm">—</span>
                <span className="text-muted text-sm font-medium">{board.boardType}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {session && (
                <div className="bg-background/50 rounded-xl px-4 py-2 border border-border/50 backdrop-blur-sm shadow-inner">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Session Expires In</div>
                  <div className={`text-xl font-mono font-bold tracking-tight ${
                      timeRemaining === "Expired"
                        ? "text-danger"
                        : (!timeRemaining.includes("m") || parseInt(timeRemaining) < 5)
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
                {board.boardType.toLowerCase().includes("pynq") && (
                  <button 
                    onClick={() => router.push(`/pynq/${boardId}`)} 
                    className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/30 ml-2 animate-pulse hover:animate-none transition-transform active:scale-95"
                  >
                    <span>🚀</span> SoC Lab
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Monitor grid */}
        <div
          className={`grid gap-4 sm:gap-6 ${
            hasUART && hasCamera
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 max-w-4xl mx-auto"
          }`}
        >
          {hasUART && renderTerminal()}
          {hasCamera && renderCamera()}
        </div>

        {/* Virtual I/O Panel */}
        {hasSwitches && hasUART && (
          <div className="mt-6 sm:mt-8 max-w-4xl mx-auto">
            <VirtualIO boardId={boardId} />
          </div>
        )}

        {/* No monitoring available */}
        {!hasUART && !hasCamera && !hasSwitches && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📡</div>
            <h2 className="text-xl font-semibold mb-2">
              No monitoring outputs configured
            </h2>
            <p className="text-muted">
              This board does not have UART or camera monitoring set up.
              Contact your administrator.
            </p>
          </div>
        )}

        {/* Board info */}
        <div className="card mt-6 sm:mt-8">
          <h2 className="font-semibold mb-3">Board Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
            <div>
              <span className="text-muted">Board Type</span>
              <p className="font-medium">{board.boardType}</p>
            </div>
            <div>
              <span className="text-muted">FPGA Family</span>
              <p className="font-medium">{board.fpgaFamily}</p>
            </div>
            <div>
              <span className="text-muted">Capabilities</span>
              <p className="font-medium">
                {capabilities.length > 0
                  ? capabilities.join(", ")
                  : "None listed"}
              </p>
            </div>
            <div>
              <span className="text-muted">Session</span>
              <p className="font-medium">
                {session ? "Active" : "None"}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
