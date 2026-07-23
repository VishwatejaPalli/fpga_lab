"use client";

import { RefObject } from "react";

interface BottomConsoleDockProps {
  bottomDockTab: "tcl" | "messages" | "log" | "reports" | "runs";
  setBottomDockTab: (tab: "tcl" | "messages" | "log" | "reports" | "runs") => void;
  synthStatus: string;
  wnsValue: string;
  tnsValue: string;
  lutUsage: number;
  ffUsage: number;
  bramUsage: number;
  dspUsage: number;
  tclLogs: string[];
  tclInput: string;
  setTclInput: (input: string) => void;
  tclBottomRef: RefObject<HTMLDivElement | null>;
  handleTclSubmit: (e: React.FormEvent) => void;
  historyJobs: any[];
}

export default function BottomConsoleDock({
  bottomDockTab,
  setBottomDockTab,
  synthStatus,
  wnsValue,
  tnsValue,
  lutUsage,
  ffUsage,
  bramUsage,
  dspUsage,
  tclLogs,
  tclInput,
  setTclInput,
  tclBottomRef,
  handleTclSubmit,
  historyJobs,
}: BottomConsoleDockProps) {
  return (
    <div className="h-52 border-t border-[#c4d2e2] flex flex-col shrink-0 bg-[#f0f4f9]">
      <div className="h-7 border-b border-[#c4d2e2] flex items-center justify-between px-2 bg-[#e4ebf5] text-xs shrink-0">
        <div className="flex items-center gap-1 font-semibold">
          {[
            { id: "tcl", label: "Tcl Console" },
            { id: "messages", label: "Messages" },
            { id: "log", label: "Log" },
            { id: "reports", label: "Reports" },
            { id: "runs", label: "Design Runs" },
          ].map((dt) => (
            <button
              key={dt.id}
              onClick={() => setBottomDockTab(dt.id as any)}
              className={`px-3 py-0.5 rounded-t text-[11px] transition-colors ${
                bottomDockTab === dt.id
                  ? "bg-white text-[#1e3a8a] font-bold border-t-2 border-t-[#2b579a]"
                  : "text-slate-700 hover:bg-white/60"
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-slate-600 font-mono">
          Status: <span className="text-emerald-700 font-bold">{synthStatus}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-white">
        {bottomDockTab === "runs" && (
          <div className="w-full h-full overflow-auto text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#cbd5e1] font-bold text-[10px] uppercase bg-[#e2e8f0] text-slate-700">
                  <th className="p-2 border-r border-[#cbd5e1]">Name</th>
                  <th className="p-2 border-r border-[#cbd5e1]">Constraints</th>
                  <th className="p-2 border-r border-[#cbd5e1]">Status</th>
                  <th className="p-2 border-r border-[#cbd5e1]">WNS</th>
                  <th className="p-2 border-r border-[#cbd5e1]">TNS</th>
                  <th className="p-2 border-r border-[#cbd5e1]">LUT</th>
                  <th className="p-2 border-r border-[#cbd5e1]">FF</th>
                  <th className="p-2 border-r border-[#cbd5e1]">BRAM</th>
                  <th className="p-2 border-r border-[#cbd5e1]">DSP</th>
                  <th className="p-2">Elapsed / Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px] text-slate-800">
                <tr className="hover:bg-blue-50 cursor-pointer">
                  <td className="p-2 font-bold text-blue-700 flex items-center gap-1">
                    <span>▶</span> synth_1
                  </td>
                  <td className="p-2 text-slate-600">constrs_1</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                      {synthStatus}
                    </span>
                  </td>
                  <td className="p-2 text-emerald-700 font-bold">{wnsValue}</td>
                  <td className="p-2 text-slate-700">{tnsValue}</td>
                  <td className="p-2 text-blue-700">{lutUsage}%</td>
                  <td className="p-2 text-purple-700">{ffUsage}%</td>
                  <td className="p-2 text-emerald-700">{bramUsage}%</td>
                  <td className="p-2 text-amber-700">{dspUsage}%</td>
                  <td className="p-2 text-slate-600">00:00:12</td>
                </tr>

                {historyJobs.map((job: any, index: number) => (
                  <tr key={job.id || index} className="hover:bg-slate-50">
                    <td className="p-2 text-blue-800 font-medium">synth_{index + 2}</td>
                    <td className="p-2 text-slate-500">constrs_1</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          job.status === "completed" || job.status === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : job.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600">--</td>
                    <td className="p-2 text-slate-600">--</td>
                    <td className="p-2 text-slate-600">--</td>
                    <td className="p-2 text-slate-600">--</td>
                    <td className="p-2 text-slate-600">--</td>
                    <td className="p-2 text-slate-600">--</td>
                    <td className="p-2 text-slate-500">
                      {job.created_at ? new Date(job.created_at).toLocaleTimeString() : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {bottomDockTab === "tcl" && (
          <div className="w-full h-full flex flex-col bg-slate-900 p-2 font-mono text-[11px] text-slate-200">
            <div className="flex-1 overflow-y-auto space-y-1">
              {tclLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.startsWith("ERROR")
                      ? "text-red-400 font-bold"
                      : log.startsWith("Tcl%")
                      ? "text-blue-400 font-bold"
                      : "text-slate-300"
                  }
                >
                  {log}
                </div>
              ))}
              <div ref={tclBottomRef} />
            </div>

            <form
              onSubmit={handleTclSubmit}
              className="mt-2 flex items-center gap-2 border-t border-slate-800 pt-1.5"
            >
              <span className="text-blue-400 font-bold">Tcl%</span>
              <input
                type="text"
                value={tclInput}
                onChange={(e) => setTclInput(e.target.value)}
                placeholder="Type Tcl command (e.g. synth_design, help, clear)..."
                className="flex-1 bg-transparent border-none text-slate-200 focus:outline-none text-[11px]"
              />
            </form>
          </div>
        )}

        {bottomDockTab === "messages" && (
          <div className="p-4 font-mono text-xs text-slate-600 space-y-2">
            <div className="text-blue-700 font-bold">INFO: [Lab 1-01] FPGA Lab Engine Initialized.</div>
            <div className="text-slate-500">INFO: Design hierarchy synced with target FPGA part.</div>
          </div>
        )}

        {bottomDockTab === "log" && (
          <div className="p-4 font-mono text-xs text-slate-700 space-y-1">
            {tclLogs.slice(-10).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}

        {bottomDockTab === "reports" && (
          <div className="p-4 text-xs text-slate-600">
            <div className="font-bold text-slate-800 mb-2">Generated Compilation Reports</div>
            <ul className="list-disc list-inside space-y-1 font-mono">
              <li>synthesis_utilization.rpt</li>
              <li>timing_summary.rpt</li>
              <li>power_analysis.rpt</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
