"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/navbar";
import UploadZone from "@/components/upload-zone";

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  status: string;
  capabilities: string[];
}

function ProgramContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedBoardId = searchParams.get("boardId");

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState(preSelectedBoardId || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data) => {
        if (data.boards) setBoards(data.boards);
      })
      .catch(() => {});
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (data.job) {
          setJobStatus(data.job.status);
          if (data.job.status === "success" || data.job.status === "failed") {
            clearInterval(interval);
            if (data.job.logs) {
              setLogs((prev) => [...prev, data.job.logs]);
            }
          }
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  // WebSocket for real-time logs
  useEffect(() => {
    if (!jobId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/logs/${jobId}`
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "job-log") {
          setLogs((prev) => [...prev, msg.data]);
        } else if (msg.type === "job-complete") {
          setJobStatus(msg.success ? "success" : "failed");
          if (msg.success && msg.sessionId) {
            // Redirect to monitor after short delay
            setTimeout(() => {
              router.push(`/monitor/${selectedBoardId}`);
            }, 2000);
          }
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, [jobId, selectedBoardId, router]);

  const handleFileSelected = useCallback((f: File) => {
    setFile(f);
    setError("");
    setDemoLoaded(false);
  }, []);

  async function loadDemoBitstream() {
    try {
      const res = await fetch("/demo/blinky.bit");
      const blob = await res.blob();
      const demoFile = new File([blob], "blinky.bit", {
        type: "application/octet-stream",
      });
      setFile(demoFile);
      setDemoLoaded(true);
      setError("");
    } catch {
      setError("Failed to load demo bitstream");
    }
  }

  async function handleSubmit() {
    if (!selectedBoardId || !file) {
      setError("Please select a board and upload a bitstream file");
      return;
    }

    setError("");
    setUploading(true);
    setLogs([]);
    setJobStatus(null);
    setJobId(null);

    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append("bitstream", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setError(uploadData.error || "Upload failed");
        setUploading(false);
        return;
      }

      // Step 2: Create job
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: selectedBoardId,
          bitstreamPath: uploadData.filePath,
          bitstreamName: uploadData.fileName,
        }),
      });

      const jobData = await jobRes.json();

      if (!jobRes.ok) {
        setError(jobData.error || "Failed to create job");
        setUploading(false);
        return;
      }

      setJobId(jobData.id);
      setJobStatus(jobData.status);
      setLogs([`Job ${jobData.id} created — status: ${jobData.status}\n`]);
    } catch {
      setError("Failed to submit job. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const freeBoards = boards.filter(
    (b) => b.status === "free" || b.id === selectedBoardId
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Program FPGA</h1>
        <p className="text-muted mb-6 sm:mb-8 text-sm sm:text-base">
          Select a board, upload your bitstream, and start programming.
        </p>

        <div className="space-y-6">
          {/* Demo Bitstream Banner */}
          {!jobId && (
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🎯</div>
                  <div>
                    <h3 className="font-semibold text-primary">Demo Bitstream Available</h3>
                    <p className="text-sm text-muted mt-0.5">
                      Try with <span className="font-mono font-medium">blinky.bit</span> — a
                      pre-built LED blinker design for Xilinx 7-series FPGAs
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href="/demo/blinky.bit"
                    download="blinky.bit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                  <button
                    onClick={loadDemoBitstream}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Use for Demo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Board selector */}
          <div className="card">
            <h2 className="font-semibold mb-3">1. Select Board</h2>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="input-field"
              disabled={!!jobId}
            >
              <option value="">Choose an FPGA board...</option>
              {freeBoards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name} — {board.fpgaFamily} ({board.status})
                </option>
              ))}
            </select>
          </div>

          {/* File upload */}
          <div className="card">
            <h2 className="font-semibold mb-3">2. Upload Bitstream</h2>
            {demoLoaded ? (
              <div className="border-2 border-primary/30 bg-primary/5 rounded-xl p-6 text-center">
                <div className="text-3xl mb-2">📄</div>
                <p className="font-medium text-primary">blinky.bit</p>
                <p className="text-sm text-muted mt-1">
                  Demo bitstream loaded (4.1 KB) •{" "}
                  <button
                    onClick={() => { setDemoLoaded(false); setFile(null); }}
                    className="text-primary underline hover:no-underline"
                  >
                    Remove
                  </button>
                </p>
              </div>
            ) : (
              <UploadZone
                onFileSelected={handleFileSelected}
                disabled={!!jobId}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          {!jobId && (
            <button
              onClick={handleSubmit}
              disabled={!selectedBoardId || !file || uploading}
              className="btn-primary w-full text-lg py-3"
            >
              {uploading ? "Uploading..." : "⚡ Start Programming"}
            </button>
          )}

          {/* Job status */}
          {jobStatus && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Programming Status</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  jobStatus === "success" ? "bg-green-100 text-green-700" :
                  jobStatus === "failed" ? "bg-red-100 text-red-700" :
                  jobStatus === "programming" ? "bg-blue-100 text-blue-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {jobStatus === "programming" && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                  {jobStatus.toUpperCase()}
                </span>
              </div>

              {/* Progress bar */}
              {(jobStatus === "programming" || jobStatus === "queued") && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: jobStatus === "queued" ? "5%" :
                             `${Math.min(95, Math.max(10, logs.length * 2))}%`,
                      animation: jobStatus === "programming" ? "none" : undefined,
                    }}
                  />
                </div>
              )}

              {jobStatus === "success" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-green-700 font-medium">
                    ✅ FPGA programmed successfully!
                  </p>
                  <p className="text-sm text-muted mt-1">
                    Redirecting to monitoring page...
                  </p>
                </div>
              )}

              {jobStatus === "failed" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-700 font-medium">
                    ❌ Programming failed
                  </p>
                </div>
              )}

              {/* Live Terminal Logs */}
              {logs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted uppercase tracking-wider">Terminal Output</span>
                    {jobStatus === "programming" && (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <div
                    className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 max-h-80 overflow-y-auto scroll-smooth"
                    ref={(el) => {
                      if (el) el.scrollTop = el.scrollHeight;
                    }}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {logs.join("")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ProgramPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    }>
      <ProgramContent />
    </Suspense>
  );
}
