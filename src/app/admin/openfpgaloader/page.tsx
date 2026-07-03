"use client";

import { useState } from "react";
import Navbar from "@/components/navbar";

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
    } catch (err) {
      setOutput(`Failed to execute request: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">OpenFPGALoader Tools</h1>
        <p className="text-muted mb-8">Execute openFPGALoader diagnostics directly from the browser.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-lg border-b border-border pb-2">Discovery Actions</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => runAction("detect")}
                  disabled={loading}
                  className="btn-primary w-full justify-center"
                >
                  🔍 Detect Hardware
                </button>
                <button
                  onClick={() => runAction("scan-usb")}
                  disabled={loading}
                  className="btn-primary w-full justify-center"
                >
                  🔌 Scan USB
                </button>
                <button
                  onClick={() => runAction("list-boards")}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
                >
                  List Supported Boards
                </button>
                <button
                  onClick={() => runAction("list-cables")}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
                >
                  List Supported Cables
                </button>
                <button
                  onClick={() => runAction("list-fpga")}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
                >
                  List Supported FPGAs
                </button>
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-lg border-b border-border pb-2">Advanced Actions</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted">Board Type</label>
                  <input
                    type="text"
                    value={boardType}
                    onChange={(e) => setBoardType(e.target.value)}
                    placeholder="e.g. basys3"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted">Device Path</label>
                  <input
                    type="text"
                    value={devicePath}
                    onChange={(e) => setDevicePath(e.target.value)}
                    placeholder="e.g. /dev/ttyUSB0"
                    className="input-field w-full"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => runAction("reset")}
                    disabled={loading || (!boardType && !devicePath)}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    Reset FPGA
                  </button>
                  <button
                    onClick={() => runAction("read-dna")}
                    disabled={loading || (!boardType && !devicePath)}
                    className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    Read DNA
                  </button>
                  <button
                    onClick={() => runAction("read-xadc")}
                    disabled={loading || (!boardType && !devicePath)}
                    className="col-span-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    Read XADC
                  </button>
                </div>
                {(!boardType && !devicePath) && (
                  <p className="text-xs text-warning mt-2">Board Type or Device Path is required for advanced actions.</p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  📟 Terminal Output
                </h2>
                {runningCmd && (
                  <span className="text-xs font-mono bg-background px-3 py-1 rounded-full border border-border">
                    $ {runningCmd}
                  </span>
                )}
              </div>
              <div className="flex-1 bg-slate-900 rounded-xl p-4 overflow-hidden flex flex-col min-h-[500px]">
                <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap overflow-y-auto flex-1">
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
