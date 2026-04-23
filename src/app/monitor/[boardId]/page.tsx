"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import Terminal from "@/components/terminal";
import CameraFeed from "@/components/camera-feed";

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
    if (!session) return;
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to end session:", err);
    }
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

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{board.name}</h1>
            <p className="text-muted mt-1 text-sm sm:text-base">
              {board.fpgaFamily} — {board.boardType}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {session && (
              <div className="text-left sm:text-right">
                <div className="text-xs sm:text-sm text-muted">Expires in</div>
                <div
                  className={`text-base sm:text-lg font-mono font-bold ${
                    timeRemaining === "Expired"
                      ? "text-danger"
                      : parseInt(timeRemaining) < 5
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  {timeRemaining}
                </div>
              </div>
            )}
            <button onClick={handleEndSession} className="btn-danger text-sm sm:text-base">
              End Session
            </button>
          </div>
        </div>

        {/* Monitor grid */}
        <div
          className={`grid gap-4 sm:gap-6 ${
            hasUART && hasCamera
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 max-w-3xl mx-auto"
          }`}
        >
          {/* UART Terminal */}
          {hasUART && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                📟 Serial Console (UART)
              </h2>
              <Terminal boardId={boardId} />
              <p className="text-xs text-muted mt-2">
                Click the terminal and type to send data to the FPGA
              </p>
            </div>
          )}

          {/* Camera Feed */}
          {hasCamera && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                📷 Camera Feed
              </h2>
              <CameraFeed boardId={boardId} />
              <p className="text-xs text-muted mt-2">
                Live view of the FPGA board (LEDs, display, switches)
              </p>
            </div>
          )}
        </div>

        {/* No monitoring available */}
        {!hasUART && !hasCamera && (
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
