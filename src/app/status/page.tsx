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
      free: "bg-emerald-500 shadow-emerald-500/50",
      busy: "bg-amber-500 shadow-amber-500/50",
      offline: "bg-rose-500 shadow-rose-500/50",
    };
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full animate-pulse shadow-md ${color[status] || "bg-slate-400"}`}
      />
    );
  }

  function jobStatusBadge(status: string) {
    const colors: Record<string, string> = {
      success: "bg-success/10 text-success border border-success/20",
      failed: "bg-danger/10 text-danger border border-danger/20",
      programming: "bg-warning/10 text-warning border border-warning/20 animate-pulse",
      queued: "bg-primary/10 text-primary border border-primary/20",
    };
    return (
      <span
        className={`text-[10px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${colors[status] || "bg-muted/10 text-muted border border-muted/20"}`}
      >
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-md">
              System Status
            </h1>
            <p className="text-muted mt-1 text-sm sm:text-base">
              Real-time overview and telemetry of the FPGA lab infrastructure
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-card border border-border px-3 py-1.5 rounded-full w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-muted font-medium">Auto-refreshing (10s)</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-28" />
            ))}
          </div>
        ) : !data ? (
          <div className="card p-8 text-center text-muted">
            Failed to load server telemetry status.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {/* Card 1 */}
              <div className="card border-primary/20 p-6 relative overflow-hidden group shadow-lg shadow-primary/5">
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full filter blur-xl group-hover:bg-primary/10 transition-all" />
                <div className="text-3xl font-black text-primary">
                  {data.boards.total}
                </div>
                <div className="text-xs font-bold text-muted uppercase tracking-wider mt-2">Total Boards</div>
              </div>

              {/* Card 2 */}
              <div className="card border-success/20 p-6 relative overflow-hidden group shadow-lg shadow-success/5">
                <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-full filter blur-xl group-hover:bg-success/10 transition-all" />
                <div className="text-3xl font-black text-success">
                  {data.boards.free}
                </div>
                <div className="text-xs font-bold text-muted uppercase tracking-wider mt-2">Available</div>
              </div>

              {/* Card 3 */}
              <div className="card border-warning/20 p-6 relative overflow-hidden group shadow-lg shadow-warning/5">
                <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-full filter blur-xl group-hover:bg-warning/10 transition-all" />
                <div className="text-3xl font-black text-warning">
                  {data.activeSessions}
                </div>
                <div className="text-xs font-bold text-muted uppercase tracking-wider mt-2">Active Sessions</div>
              </div>

              {/* Card 4 */}
              <div className="card border-accent/20 p-6 relative overflow-hidden group shadow-lg shadow-accent/5">
                <div className="absolute top-0 right-0 w-20 h-20 bg-accent/5 rounded-full filter blur-xl group-hover:bg-accent/10 transition-all" />
                <div className="text-3xl font-black text-accent">
                  {data.recentJobs.length}
                </div>
                <div className="text-xs font-bold text-muted uppercase tracking-wider mt-2">Recent Jobs</div>
              </div>
            </div>

            {/* Board status table */}
            <div className="card p-0 overflow-hidden mb-10">
              <div className="px-6 py-4 border-b border-border bg-foreground/5 flex items-center justify-between">
                <h2 className="font-extrabold text-sm uppercase tracking-wider text-foreground">Active Board Repositories</h2>
                <span className="text-[10px] bg-foreground/10 text-muted px-2 py-0.5 rounded font-semibold font-mono">
                  {data.boards.list.length} mapped
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-foreground/5 text-left text-xs font-bold uppercase tracking-wider text-muted border-b border-border">
                      <th className="px-6 py-3.5">Board Reference</th>
                      <th className="px-6 py-3.5">Target Type</th>
                      <th className="px-6 py-3.5">FPGA Silicon</th>
                      <th className="px-6 py-3.5">Link Mode</th>
                      <th className="px-6 py-3.5 text-right">Operational Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.boards.list.map((b) => (
                      <tr key={b.id} className="hover:bg-foreground/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">{b.name}</td>
                        <td className="px-6 py-4 text-muted font-mono text-xs">{b.boardType}</td>
                        <td className="px-6 py-4 text-muted font-mono text-xs">{b.fpgaFamily}</td>
                        <td className="px-6 py-4 text-muted capitalize font-medium">{b.connectionType}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-2 bg-foreground/5 border border-border rounded-full px-3 py-1 text-xs">
                            {statusDot(b.status)}
                            <span className="capitalize font-semibold text-foreground">{b.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent jobs */}
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-foreground/5 flex items-center justify-between">
                <h2 className="font-extrabold text-sm uppercase tracking-wider text-foreground">Recent Compiler Tasks (Lab-wide)</h2>
              </div>
              
              {data.recentJobs.length === 0 ? (
                <div className="px-6 py-12 text-center text-muted text-sm">
                  No compilation jobs recorded yet in workspace.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-foreground/5 text-left text-xs font-bold uppercase tracking-wider text-muted border-b border-border">
                        <th className="px-6 py-3.5">Bitstream Artifact</th>
                        <th className="px-6 py-3.5">Target Board ID</th>
                        <th className="px-6 py-3.5">Execution Status</th>
                        <th className="px-6 py-3.5 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.recentJobs.map((j) => (
                        <tr key={j.id} className="hover:bg-foreground/5 transition-colors">
                          <td className="px-6 py-4 font-bold text-foreground">
                            {j.bitstreamName}
                          </td>
                          <td className="px-6 py-4 text-muted font-mono text-xs">
                            {j.boardId.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4">{jobStatusBadge(j.status)}</td>
                          <td className="px-6 py-4 text-right text-muted text-xs">
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
