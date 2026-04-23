"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";

interface JobRecord {
  id: string;
  boardId: string;
  boardName: string | null;
  boardType: string | null;
  bitstreamName: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  logs: string | null;
}

interface SessionRecord {
  id: string;
  boardId: string;
  boardName: string | null;
  startedAt: string;
  expiresAt: string;
  status: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"jobs" | "sessions">("jobs");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => {
        if (!res.ok) {
          router.push("/auth/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setJobs(data.jobs || []);
          setSessions(data.sessions || []);
        }
      })
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      success: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      programming: "bg-yellow-100 text-yellow-800",
      queued: "bg-blue-100 text-blue-800",
      cancelled: "bg-gray-100 text-gray-600",
      active: "bg-green-100 text-green-800",
      expired: "bg-gray-100 text-gray-600",
      ended: "bg-blue-100 text-blue-800",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}
      >
        {status}
      </span>
    );
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">History</h1>
        <p className="text-muted mb-6">
          Your past programming jobs and hardware sessions
        </p>

        {/* Tab selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("jobs")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "jobs"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Programming Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setTab("sessions")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "sessions"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Hardware Sessions ({sessions.length})
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-16" />
            ))}
          </div>
        ) : tab === "jobs" ? (
          /* Jobs list */
          jobs.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-lg font-semibold mb-1">No jobs yet</h2>
              <p className="text-muted text-sm">
                Program a bitstream to see your job history here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-sm">
                          {job.bitstreamName}
                        </span>
                        {statusBadge(job.status)}
                      </div>
                      <div className="text-xs text-muted">
                        {job.boardName || job.boardType || job.boardId.slice(0, 8)} ·{" "}
                        {formatDate(job.createdAt)}
                        {job.completedAt &&
                          ` · Duration: ${Math.round(
                            (new Date(job.completedAt).getTime() -
                              new Date(job.startedAt || job.createdAt).getTime()) /
                              1000
                          )}s`}
                      </div>
                    </div>
                    {job.logs && (
                      <button
                        onClick={() =>
                          setExpandedJob(
                            expandedJob === job.id ? null : job.id
                          )
                        }
                        className="text-xs text-primary hover:underline ml-4"
                      >
                        {expandedJob === job.id ? "Hide Logs" : "View Logs"}
                      </button>
                    )}
                  </div>
                  {expandedJob === job.id && job.logs && (
                    <pre className="mt-3 p-3 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
                      {job.logs}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )
        ) : /* Sessions list */
        sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🖥️</div>
            <h2 className="text-lg font-semibold mb-1">No sessions yet</h2>
            <p className="text-muted text-sm">
              Start a hardware session to see your session history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-sm">
                        {s.boardName || s.boardId.slice(0, 8)}
                      </span>
                      {statusBadge(s.status)}
                    </div>
                    <div className="text-xs text-muted">
                      Started: {formatDate(s.startedAt)} · Expires:{" "}
                      {formatDate(s.expiresAt)}
                    </div>
                  </div>
                  {s.status === "active" && (
                    <button
                      onClick={() => router.push(`/monitor/${s.boardId}`)}
                      className="btn-primary text-xs"
                    >
                      Monitor
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
