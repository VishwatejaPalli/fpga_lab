"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import BoardCard from "@/components/board-card";
import { SparklesIcon, TerminalIcon, PlugIcon, XIcon } from "@/components/icons";

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
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "busy" | "offline">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Board Availability Waitlist State
  const [notifiedBoardIds, setNotifiedBoardIds] = useState<string[]>([]);
  const [freedNotice, setFreedNotice] = useState<{ id: string; name: string } | null>(null);

  // Load notified boards from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fpga-notified-boards");
      if (saved) setNotifiedBoardIds(JSON.parse(saved));
    } catch {}
  }, []);

  const handleToggleNotify = (boardId: string) => {
    setNotifiedBoardIds((prev) => {
      const updated = prev.includes(boardId)
        ? prev.filter((id) => id !== boardId)
        : [...prev, boardId];
      localStorage.setItem("fpga-notified-boards", JSON.stringify(updated));
      return updated;
    });
  };

  const fetchData = useCallback(async () => {
    try {
      const [boardsRes, sessionRes] = await Promise.all([
        fetch("/api/boards"),
        fetch("/api/sessions"),
      ]);

      const boardsData = await boardsRes.json();
      const sessionData = await sessionRes.json();

      if (boardsData.boards) {
        const newBoards: Board[] = boardsData.boards;
        setBoards(newBoards);

        // Check if any board on waitlist became free
        notifiedBoardIds.forEach((id) => {
          const target = newBoards.find((b) => b.id === id);
          if (target && target.status === "free") {
            setFreedNotice({ id: target.id, name: target.name });
            setNotifiedBoardIds((prev) => {
              const updated = prev.filter((item) => item !== id);
              localStorage.setItem("fpga-notified-boards", JSON.stringify(updated));
              return updated;
            });
          }
        });
      }

      if (sessionData.session) setActiveSession(sessionData.session);
      else setActiveSession(null);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [notifiedBoardIds]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function handleSelectBoard(boardId: string) {
    const board = boards.find((b) => b.id === boardId);
    if (board?.boardType.toLowerCase().includes("pynq")) {
      router.push(`/pynq/${boardId}`);
    } else {
      router.push(`/program?boardId=${boardId}`);
    }
  }

  async function handleEndSession() {
    if (!activeSession) return;
    setIsEndingSession(true);
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
    setIsEndingSession(false);
  }

  const counts = useMemo(() => {
    const free = boards.filter((b) => b.status === "free").length;
    const busy = boards.filter((b) => b.status === "busy" || b.status === "allocated").length;
    const offline = boards.filter((b) => b.status === "offline").length;
    return { all: boards.length, free, busy, offline };
  }, [boards]);

  // Filtered boards
  const filteredBoards = useMemo(() => {
    return boards.filter((b) => {
      // Status filter
      if (statusFilter === "free" && b.status !== "free") return false;
      if (statusFilter === "busy" && b.status !== "busy" && b.status !== "allocated") return false;
      if (statusFilter === "offline" && b.status !== "offline") return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          b.fpgaFamily.toLowerCase().includes(q) ||
          b.boardType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [boards, statusFilter, searchQuery]);

  const activeBoard = useMemo(() => {
    if (!activeSession) return null;
    return boards.find((b) => b.id === activeSession.boardId);
  }, [activeSession, boards]);

  const isSoC = activeBoard?.boardType?.toLowerCase().includes("pynq");
  const monitorHref = activeBoard
    ? isSoC
      ? `/pynq/${activeBoard.id}`
      : `/monitor/${activeBoard.id}`
    : "/dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid-cockpit">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Freed board notification toast */}
        {freedNotice && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl mb-6 flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <SparklesIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Board Free Alert!</h3>
                <p className="text-xs text-emerald-400">
                  Target board <strong>{freedNotice.name}</strong> is now free for programming and remote access.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectBoard(freedNotice.id)}
                className="btn-primary text-xs py-1.5 px-3"
              >
                Select Board Now
              </button>
              <button
                onClick={() => setFreedNotice(null)}
                className="text-xs text-muted hover:text-foreground px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Hero Active Session Cockpit HUD */}
        {activeSession && (
          <div className="cockpit-panel p-5 sm:p-6 mb-8 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.12)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner shrink-0 text-amber-500">
                  <TerminalIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Active Hardware Session
                    </span>
                    <span className="text-[10px] font-mono text-muted/80 bg-muted/15 px-1.5 py-0.2 rounded border border-border/50">
                      hw:{activeSession.boardId.slice(0, 8)}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {activeBoard?.name || "Target FPGA Board"}
                  </h2>
                  <p className="text-xs text-muted font-mono mt-0.5">
                    {activeBoard?.fpgaFamily || "FPGA"} • Expires at {new Date(activeSession.expiresAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => router.push(monitorHref)}
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <span>Launch Laboratory</span>
                  <span>→</span>
                </button>
                <button
                  onClick={handleEndSession}
                  disabled={isEndingSession}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-red-500/30 text-red-600 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isEndingSession ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      <span>Ending...</span>
                    </>
                  ) : (
                    <>
                      <span>⏹</span>
                      <span>Release Board</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Title & Interactive Filter Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-accent mb-1">
              Hardware Laboratory
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Connected Development Boards
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Select an available FPGA device node to begin remote synthesis, JTAG programming, and interactive testing.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search board, silicon, or tool..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-muted hover:text-foreground"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-card/80 border border-border rounded-xl mb-6 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-primary text-white shadow-md shadow-primary/30"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              All Boards ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter("free")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "free"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Available ({counts.free})</span>
            </button>
            <button
              onClick={() => setStatusFilter("busy")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "busy"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>In Use ({counts.busy})</span>
            </button>
            <button
              onClick={() => setStatusFilter("offline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "offline"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Offline ({counts.offline})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-muted font-mono pr-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Free
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Busy
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400" /> Offline
            </span>
          </div>
        </div>

        {/* Board Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="instrument-card animate-pulse h-80 bg-muted/20" />
            ))}
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="text-center py-20 card border-dashed border-2 border-border bg-card/40">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 text-primary">
              <PlugIcon className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold mb-1 text-foreground">
              {searchQuery ? "No matching FPGA boards found" : "No boards currently registered"}
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {searchQuery
                ? `No boards match "${searchQuery}". Try clearing search filters.`
                : "Ask your lab administrator to register hardware nodes via the Admin panel."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onSelect={handleSelectBoard}
                isNotified={notifiedBoardIds.includes(board.id)}
                onToggleNotify={handleToggleNotify}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
