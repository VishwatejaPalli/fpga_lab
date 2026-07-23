"use client";

interface WaveformViewProps {
  waves: any;
  globalRadix: "hex" | "bin" | "dec";
  setGlobalRadix: (radix: "hex" | "bin" | "dec") => void;
  handleRunSimulation: () => void;
}

export default function WaveformView({
  waves,
  globalRadix,
  setGlobalRadix,
  handleRunSimulation,
}: WaveformViewProps) {
  return (
    <div className="w-full h-full flex flex-col bg-[#0f172a]">
      <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-200">Waveform Viewer</span>
          {waves && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[10px]">Radix:</span>
              <select
                value={globalRadix}
                onChange={(e) => setGlobalRadix(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-0.5"
              >
                <option value="hex">HEX</option>
                <option value="bin">BIN</option>
                <option value="dec">DEC</option>
              </select>
            </div>
          )}
        </div>

        <button
          onClick={handleRunSimulation}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
        >
          ▶ Re-run Simulation
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-center">
        {waves ? (
          <div className="font-mono text-emerald-400">
            Waveform Signals Loaded ({Object.keys(waves).length} signals)
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">🧪</div>
            <div className="font-bold text-slate-200">Behavioral Simulation Waveform</div>
            <p className="text-xs text-slate-400">Run simulation to inspect clock cycles and registers.</p>
            <button
              onClick={handleRunSimulation}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
            >
              ▶ Run Behavioral Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
