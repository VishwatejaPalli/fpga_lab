"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";

interface BoardInfo {
  id: string;
  name: string;
  boardType: string;
  fpgaFamily: string;
  status: string;
  connectionType: string;
}

interface RecentJob {
  id: string;
  bitstreamName: string;
  status: string;
  boardId: string;
  createdAt: string;
}

interface StatusData {
  boards: {
    total: number;
    free: number;
    busy: number;
    offline: number;
    list: BoardInfo[];
  };
  activeSessions: number;
  recentJobs: RecentJob[];
  totalUsers: number;
}

export default function StatusPage() {
  const router = useRouter();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    fetch("/api/status")
      .then((res) => {
        if (!res.ok) {
          router.push("/auth/login");
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  function statusDot(status: string) {
    const color: Record<string, string> = {
      free: "bg-green-500",
      busy: "bg-yellow-500",
      offline: "bg-gray-400",
    };
    return (
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${color[status] || "bg-gray-400"}`}
      />
    );
  }

  function jobStatusBadge(status: string) {
    const colors: Record<string, string> = {
      success: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      programming: "bg-yellow-100 text-yellow-800",
      queued: "bg-blue-100 text-blue-800",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}
      >
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">System Status</h1>
            <p className="text-muted mt-1">
              Real-time overview of the FPGA lab infrastructure
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Auto-refreshing every 10s
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-24" />
            ))}
          </div>
        ) : !data ? (
          <p className="text-muted">Failed to load status.</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-primary">
                  {data.boards.total}
                </div>
                <div className="text-xs text-muted mt-1">Total Boards</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {data.boards.free}
                </div>
                <div className="text-xs text-muted mt-1">Available</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {data.activeSessions}
                </div>
                <div className="text-xs text-muted mt-1">Active Sessions</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-primary">
                  {data.recentJobs.length}
                </div>
                <div className="text-xs text-muted mt-1">Recent Jobs</div>
              </div>
            </div>

            {/* Board status table */}
            <div className="card overflow-hidden mb-8">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="font-semibold">Board Status</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-muted">
                      <th className="px-5 py-2">Board</th>
                      <th className="px-5 py-2">Type</th>
                      <th className="px-5 py-2">Family</th>
                      <th className="px-5 py-2">Connection</th>
                      <th className="px-5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.boards.list.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-5 py-3 font-medium">{b.name}</td>
                        <td className="px-5 py-3 text-muted">{b.boardType}</td>
                        <td className="px-5 py-3 text-muted">{b.fpgaFamily}</td>
                        <td className="px-5 py-3 text-muted capitalize">
                          {b.connectionType}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2">
                            {statusDot(b.status)}
                            <span className="capitalize">{b.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent jobs */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="font-semibold">Recent Jobs (Lab-wide)</h2>
              </div>
              {data.recentJobs.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted text-sm">
                  No jobs recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-muted">
                        <th className="px-5 py-2">Bitstream</th>
                        <th className="px-5 py-2">Board</th>
                        <th className="px-5 py-2">Status</th>
                        <th className="px-5 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentJobs.map((j) => (
                        <tr key={j.id} className="border-t border-border">
                          <td className="px-5 py-3 font-medium">
                            {j.bitstreamName}
                          </td>
                          <td className="px-5 py-3 text-muted font-mono text-xs">
                            {j.boardId.slice(0, 8)}
                          </td>
                          <td className="px-5 py-3">{jobStatusBadge(j.status)}</td>
                          <td className="px-5 py-3 text-muted text-xs">
                            {new Date(j.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
