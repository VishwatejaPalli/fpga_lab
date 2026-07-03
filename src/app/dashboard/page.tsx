"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import BoardCard from "@/components/board-card";

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  boardImageUrl?: string | null;
  connectionType: string;
  status: string;
  capabilities: string[];
  sessionTimeoutMinutes: number;
}

interface ActiveSession {
  id: string;
  boardId: string;
  expiresAt: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [boardsRes, sessionRes] = await Promise.all([
        fetch("/api/boards"),
        fetch("/api/sessions"),
      ]);

      const boardsData = await boardsRes.json();
      const sessionData = await sessionRes.json();

      if (boardsData.boards) setBoards(boardsData.boards);
      if (sessionData.session) setActiveSession(sessionData.session);
      else setActiveSession(null);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectBoard(boardId: string) {
    const board = boards.find(b => b.id === boardId);
    if (board?.boardType.toLowerCase().includes("pynq")) {
      router.push(`/pynq/${boardId}`);
    } else {
      router.push(`/program?boardId=${boardId}`);
    }
  }

  async function handleEndSession() {
    if (!activeSession) return;
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });
      setActiveSession(null);
      fetchData();
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  }

  const freeCount = boards.filter((b) => b.status === "free").length;
  const busyCount = boards.filter((b) => b.status === "busy").length;
  const offlineCount = boards.filter((b) => b.status === "offline").length;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-md">Dashboard</h1>
            <p className="text-muted mt-1 text-sm sm:text-base">
              Available FPGA boards for remote access
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="badge badge-free">{freeCount} Free</span>
            <span className="badge badge-busy">{busyCount} Busy</span>
            <span className="badge badge-offline">{offlineCount} Offline</span>
          </div>
        </div>

        <div className="card mb-6 sm:mb-8 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted uppercase tracking-wider text-xs font-semibold mr-2">Status legend</span>
            <span className="badge badge-free">Free</span>
            <span className="text-muted text-xs">Available</span>
            <span className="badge badge-busy">Busy</span>
            <span className="text-muted text-xs">In use</span>
            <span className="badge badge-offline">Offline</span>
            <span className="text-muted text-xs">Unreachable</span>
          </div>
        </div>

        {/* Active session banner */}
        {activeSession && (
          <div className="relative overflow-hidden border border-accent/30 rounded-xl p-4 mb-6 sm:mb-8 shadow-[0_0_20px_rgba(139,92,246,0.15)] bg-background/80 dark:bg-[#0b0f19]/80 backdrop-blur-md">
            <div className="absolute top-[-50%] left-[-10%] w-[40%] h-[200%] bg-accent/10 blur-[40px] pointer-events-none animate-pulse"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-pulse"></span>
                  Active Session
                </h3>
                <p className="text-sm text-muted mt-2">
                  Board: {activeSession.boardId.slice(0, 8)}... — Expires:{" "}
                  {new Date(activeSession.expiresAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() =>
                    router.push(`/monitor/${activeSession.boardId}`)
                  }
                  className="btn-primary text-sm flex-1 sm:flex-none"
                >
                  Monitor
                </button>
                <button
                  onClick={handleEndSession}
                  className="btn-danger text-sm flex-1 sm:flex-none"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Board grid */}
        {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 relative z-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-64 border-border bg-card" />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 opacity-50">🔌</div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">No boards available</h2>
            <p className="text-muted">
              No FPGA boards have been registered yet. Ask your administrator
              to add boards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 relative z-10">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onSelect={handleSelectBoard}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
