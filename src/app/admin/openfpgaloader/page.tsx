"use client";

import { useState } from "react";
import Navbar from "@/components/navbar";
import {
  SearchIcon,
  PlugIcon,
  SettingsIcon,
  AlertTriangleIcon,
  TerminalIcon,
} from "@/components/icons";

export default function OpenFPGALoaderPage() {
  const [output, setOutput] = useState<string>("Ready. Select an action to run openFPGALoader.");
  const [runningCmd, setRunningCmd] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [boardType, setBoardType] = useState<string>("");
  const [devicePath, setDevicePath] = useState<string>("");

  async function runAction(action: string) {
    setLoading(true);
    setRunningCmd(`openFPGALoader --${action}...`);
    setOutput("Running command...");

    try {
      const res = await fetch("/api/admin/openfpgaloader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, boardType, devicePath }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOutput(`Error: ${data.error}`);
      } else {
        setRunningCmd(data.command);
        setOutput(data.output || "(No output)");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run command";
      setOutput(`Network Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Direct Hardware Control
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            openFPGALoader Utility
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">Execute openFPGALoader boundary scan diagnostics directly on the hardware bus.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="cockpit-panel p-5 rounded-2xl border border-border space-y-4">
              <h2 className="font-semibold text-sm text-foreground border-b border-border pb-3 flex items-center gap-2">
                <SearchIcon className="w-4 h-4 text-primary" /> Bus Discovery Actions
              </h2>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => runAction("detect")}
                  disabled={loading}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all w-full flex items-center justify-center gap-2"
                >
                  <SearchIcon className="w-4 h-4" /> Detect Hardware
                </button>
                <button
                  onClick={() => runAction("scan-usb")}
                  disabled={loading}
                  className="py-2.5 px-4 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white font-mono text-xs font-semibold transition-all w-full flex items-center justify-center gap-2"
                >
                  <PlugIcon className="w-4 h-4" /> Scan USB Bus
                </button>
                <button
                  onClick={() => runAction("list-boards")}
                  disabled={loading}
                  className="px-4 py-2 bg-card hover:bg-muted text-foreground rounded-xl transition-all font-mono text-xs border border-border shadow-sm"
                >
                  List Supported Boards
                </button>
                <button
                  onClick={() => runAction("list-cables")}
                  disabled={loading}
                  className="px-4 py-2 bg-card hover:bg-muted text-foreground rounded-xl transition-all font-mono text-xs border border-border shadow-sm"
                >
                  List Supported Cables
                </button>
                <button
                  onClick={() => runAction("list-fpga")}
                  disabled={loading}
                  className="px-4 py-2 bg-card hover:bg-muted text-foreground rounded-xl transition-all font-mono text-xs border border-border shadow-sm"
                >
                  List Supported FPGAs
                </button>
              </div>
            </div>

            <div className="cockpit-panel p-5 rounded-2xl border border-border space-y-4">
              <h2 className="font-semibold text-sm text-foreground border-b border-border pb-3 flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-primary" /> Target Hardware Registers
              </h2>
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-medium mb-1 text-muted">Board Type</label>
                  <input
                    type="text"
                    value={boardType}
                    onChange={(e) => setBoardType(e.target.value)}
                    placeholder="e.g. basys3"
                    className="w-full bg-card border border-border text-foreground rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500/50 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1 text-muted">Device Path</label>
                  <input
                    type="text"
                    value={devicePath}
                    onChange={(e) => setDevicePath(e.target.value)}
                    placeholder="e.g. /dev/ttyUSB0"
                    className="w-full bg-card border border-border text-foreground rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500/50 shadow-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-border">
                  <button
                    onClick={() => runAction("reset")}
                    disabled={loading || (!boardType && !devicePath)}
                    className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 rounded-xl transition-all font-mono text-xs font-semibold disabled:opacity-40"
                  >
                    Reset FPGA
                  </button>
                  <button
                    onClick={() => runAction("read-dna")}
                    disabled={loading || (!boardType && !devicePath)}
                    className="px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-300 border border-blue-500/30 rounded-xl transition-all font-mono text-xs font-semibold disabled:opacity-40"
                  >
                    Read DNA
                  </button>
                  <button
                    onClick={() => runAction("read-xadc")}
                    disabled={loading || (!boardType && !devicePath)}
                    className="col-span-2 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-xl transition-all font-mono text-xs font-semibold disabled:opacity-40"
                  >
                    Read XADC Sensors
                  </button>
                </div>
                {(!boardType && !devicePath) && (
                  <p className="text-[11px] text-amber-500 dark:text-amber-400 mt-2 font-mono flex items-center gap-1.5">
                    <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Board Type or Device Path required for register actions.</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="cockpit-panel p-5 rounded-2xl border border-border h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-primary" /> Driver Process Output
                </h2>
                {runningCmd && (
                  <span className="text-xs font-mono bg-muted/40 text-cyan-600 dark:text-cyan-400 px-3 py-1 rounded-full border border-border">
                    $ {runningCmd}
                  </span>
                )}
              </div>
              <div className="flex-1 bg-slate-950 border border-border rounded-xl p-4 overflow-hidden flex flex-col min-h-[500px] shadow-inner">
                <pre className="text-emerald-400 font-mono text-xs whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed">
                  {output}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

