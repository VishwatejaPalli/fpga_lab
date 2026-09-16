"use client";

import Link from "next/link";
import { JobItem } from "../hooks/useProgrammer";
import { HistoryIcon, ArrowRightIcon } from "@/components/icons";

interface RecentJobsListProps {
  jobs: JobItem[];
}

export default function RecentJobsList({ jobs }: RecentJobsListProps) {
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="cockpit-panel p-5 sm:p-6 rounded-2xl border border-border mt-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-primary" />
          <span>Recent Programming Executions</span>
        </h3>
        <span className="text-xs text-muted font-mono">{jobs.length} jobs logged</span>
      </div>

      <div className="divide-y divide-border">
        {jobs.map((job) => {
          const dateStr = new Date(job.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div
              key={job.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-foreground/5 px-2 rounded-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    job.status === "success"
                      ? "led-glow-green"
                      : job.status === "failed"
                      ? "led-glow-red"
                      : job.status === "programming"
                      ? "led-glow-cyan animate-pulse"
                      : "led-glow-amber"
                  }`}
                />
                <div>
                  <div className="font-medium flex items-center gap-2 text-foreground">
                    <span className="font-mono text-sm">{job.bitstreamName}</span>
                    <span className="text-xs text-muted font-mono">
                      (ID: {job.id.slice(0, 8)})
                    </span>
                  </div>
                  <div className="text-xs text-muted font-mono mt-0.5">{dateStr}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                    job.status === "success"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : job.status === "failed"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      : job.status === "programming"
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {job.status}
                </span>

                {job.status === "success" && (
                  <Link
                    href={`/monitor/${job.boardId}`}
                    className="text-xs font-mono font-medium text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>Lab Bench</span>
                    <ArrowRightIcon className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

