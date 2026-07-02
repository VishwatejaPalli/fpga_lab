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
          setOutputs((prev) => [...prev, "Jupyter endpoint resolved."]);
        } else {
          setError(jupyterData.error || "Jupyter session could not be started");
          setOutputs((prev) => [...prev, "Jupyter endpoint unavailable."]);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary text-sm"
            >
              Reset Connection
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-primary text-sm"
            >
              Leave Lab
            </button>
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
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Outputs</h2>
                  <span className="text-xs text-muted">System feed</span>
                </div>
                <div className="flex-1 bg-background border border-border rounded-lg p-3 font-mono text-xs overflow-y-auto">
                  {outputs.length === 0 ? (
                    <div className="text-muted">No output yet.</div>
                  ) : (
                    outputs.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
