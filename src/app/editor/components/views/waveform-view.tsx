"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { BarChartIcon, PlayIcon } from "@/components/icons";

export interface VcdSignal {
  name: string;
  code: string;
  type: string;
  size: number;
  changes: [number, string][];
}

interface WaveformViewProps {
  waves: any;
  globalRadix: "hex" | "bin" | "dec";
  setGlobalRadix: (radix: "hex" | "bin" | "dec") => void;
  handleRunSimulation: () => void;
}

// Client-side VCD string parser if raw string is provided
function parseVcdString(vcdText: string): { timescale: string; signals: VcdSignal[] } {
  const lines = vcdText.split("\n");
  const signals: VcdSignal[] = [];
  const codeToSignal: Record<string, VcdSignal> = {};

  let inHeader = true;
  let currentTime = 0;
  let timescale = "1ns";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (inHeader) {
      if (line.startsWith("$timescale")) {
        if (line === "$timescale" && lines[i + 1]) {
          timescale = lines[i + 1].trim().replace("$end", "");
          i++;
        } else {
          timescale = line.replace("$timescale", "").replace("$end", "").trim();
        }
      }

      if (line.startsWith("$var")) {
        const parts = line.split(/\s+/);
        const type = parts[1] || "wire";
        const size = parseInt(parts[2] || "1", 10);
        const code = parts[3] || "";
        const name = parts.slice(4, parts.length - 1).join(" ") || code;

        const sig: VcdSignal = {
          name,
          code,
          type,
          size,
          changes: [],
        };
        signals.push(sig);
        codeToSignal[code] = sig;
      }

      if (line.startsWith("$enddefinitions")) {
        inHeader = false;
      }
      continue;
    }

    if (line.startsWith("#")) {
      currentTime = parseInt(line.substring(1), 10);
    } else if (line.startsWith("b") || line.startsWith("B") || line.startsWith("r") || line.startsWith("R")) {
      const parts = line.substring(1).split(/\s+/);
      const val = parts[0];
      const code = parts[1];
      if (code && codeToSignal[code]) {
        codeToSignal[code].changes.push([currentTime, val]);
      }
    } else {
      const val = line.substring(0, 1);
      const code = line.substring(1);
      if (code && codeToSignal[code]) {
        codeToSignal[code].changes.push([currentTime, val]);
      }
    }
  }

  return { timescale, signals };
}

function formatRadix(val: string, radix: "hex" | "bin" | "dec", size: number): string {
  if (!val || val === "x" || val === "z") return val.toUpperCase();
  const clean = val.replace(/^b/i, "");
  const num = parseInt(clean, 2);
  if (isNaN(num)) return val;

  switch (radix) {
    case "hex": {
      const hexChars = Math.ceil(size / 4) || 1;
      return "0x" + num.toString(16).toUpperCase().padStart(hexChars, "0");
    }
    case "dec":
      return num.toString(10);
    case "bin":
    default:
      return clean.padStart(size, "0");
  }
}

function getValueAtTime(changes: [number, string][], time: number): string {
  if (!changes || changes.length === 0) return "x";
  let lastVal = "x";
  for (const [t, val] of changes) {
    if (t <= time) {
      lastVal = val;
    } else {
      break;
    }
  }
  return lastVal;
}

export default function WaveformView({
  waves,
  globalRadix,
  setGlobalRadix,
  handleRunSimulation,
}: WaveformViewProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [cursorTime, setCursorTime] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0); // pixels per time unit
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize incoming waves data
  const { signals, timescale, maxTime } = useMemo(() => {
    if (!waves) {
      return { signals: [], timescale: "1ns", maxTime: 100 };
    }

    let parsedSignals: VcdSignal[] = [];
    let ts = "1ns";

    if (typeof waves === "string") {
      const parsed = parseVcdString(waves);
      parsedSignals = parsed.signals;
      ts = parsed.timescale;
    } else if (waves.signals && Array.isArray(waves.signals)) {
      parsedSignals = waves.signals;
      ts = waves.timescale || "1ns";
    } else if (typeof waves === "object") {
      parsedSignals = Object.entries(waves).map(([name, changes]) => ({
        name,
        code: name,
        type: "wire",
        size: Array.isArray(changes) && changes[0] && String(changes[0][1]).length > 1 ? String(changes[0][1]).length : 1,
        changes: (changes as [number, string][]) || [],
      }));
    }

    let maxT = 0;
    for (const sig of parsedSignals) {
      for (const [t] of sig.changes) {
        if (t > maxT) maxT = t;
      }
    }
    if (maxT === 0) maxT = 100;

    return { signals: parsedSignals, timescale: ts, maxTime: maxT };
  }, [waves]);

  // Filter signals based on search
  const filteredSignals = useMemo(() => {
    if (!filterQuery) return signals;
    const q = filterQuery.toLowerCase();
    return signals.filter((s) => s.name.toLowerCase().includes(q));
  }, [signals, filterQuery]);

  const ROW_HEIGHT = 34;
  const HEADER_HEIGHT = 32;
  const SIDEBAR_WIDTH = 260;
  const pxPerTime = Math.max(0.1, (1000 / Math.max(100, maxTime)) * zoomScale);
  const totalSvgWidth = Math.max(800, Math.ceil(maxTime * pxPerTime) + 120);

  // Dynamic ruler ticks
  const ticks = useMemo(() => {
    const rawStep = Math.max(1, Math.round(80 / pxPerTime));
    const powerOfTen = Math.pow(10, Math.floor(Math.log10(rawStep)));
    let step = powerOfTen;
    if (rawStep / powerOfTen > 5) step = powerOfTen * 5;
    else if (rawStep / powerOfTen > 2) step = powerOfTen * 2;

    const result: { time: number; x: number }[] = [];
    for (let t = 0; t <= maxTime + step; t += step) {
      result.push({ time: t, x: t * pxPerTime });
    }
    return result;
  }, [maxTime, pxPerTime]);

  // Handle timeline click for cursor placement
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasScrollRef.current) return;
      const rect = canvasScrollRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + canvasScrollRef.current.scrollLeft;
      const t = Math.max(0, Math.min(maxTime, Math.round(clickX / pxPerTime)));
      setCursorTime(t);
    },
    [maxTime, pxPerTime]
  );

  const handleZoomIn = () => setZoomScale((z) => Math.min(10, z * 1.3));
  const handleZoomOut = () => setZoomScale((z) => Math.max(0.2, z * 0.75));
  const handleZoomFit = () => {
    if (canvasScrollRef.current) {
      const visibleWidth = canvasScrollRef.current.clientWidth - 140;
      if (visibleWidth > 0 && maxTime > 0) {
        setZoomScale((visibleWidth / maxTime) / (1000 / Math.max(100, maxTime)));
      }
    }
  };

  // Keep cursor within bounds on data change
  useEffect(() => {
    if (cursorTime > maxTime) setCursorTime(0);
  }, [maxTime, cursorTime]);

  if (!waves || signals.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-[#0b0f19] text-slate-300">
        <div className="h-9 bg-[#0d1322] border-b border-slate-800 flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">Behavioral Simulation Waveforms</span>
            <span className="text-[11px] text-slate-500 font-mono">vcd-viewer</span>
          </div>
          <button
            onClick={handleRunSimulation}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <PlayIcon className="w-3 h-3" /> Run Simulation
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
            <BarChartIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-100 mb-1">No Simulation Waveforms Loaded</h3>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            Run a behavioral simulation on your Verilog or VHDL testbench. Signals will be plotted with interactive time cursors and radix inspection.
          </p>
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 text-left max-w-sm mb-6 font-mono text-[11px] text-slate-400">
            <div className="text-slate-500">// Testbench snippet:</div>
            <div>initial begin</div>
            <div className="pl-4 text-emerald-400">$dumpfile(&quot;waves.vcd&quot;);</div>
            <div className="pl-4 text-emerald-400">$dumpvars(0, tb_module);</div>
            <div>end</div>
          </div>
          <button
            onClick={handleRunSimulation}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
          >
            <PlayIcon className="w-3.5 h-3.5" /> Run Behavioral Simulation
          </button>
        </div>
      </div>
    );
  }

  const cursorX = cursorTime * pxPerTime;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-[#0b0f19] select-none text-slate-300 font-sans">
      {/* Waveform Controls Toolbar */}
      <div className="h-9 bg-[#0d1322] border-b border-slate-800 flex items-center justify-between px-3 text-xs z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-100">Waves</span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
              {signals.length} signals
            </span>
            <span className="text-[10px] text-slate-500 font-mono">({timescale})</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Radix Toggle */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">Radix:</span>
            <div className="flex bg-slate-800/80 rounded p-0.5 border border-slate-700">
              {(["hex", "bin", "dec"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setGlobalRadix(r)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    globalRadix === r ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Cursor info */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-slate-500">Cursor:</span>
            <span className="text-amber-400 font-bold">{cursorTime} {timescale}</span>
          </div>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded overflow-hidden">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="px-2 py-1 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              +
            </button>
            <button
              onClick={handleZoomFit}
              title="Fit to window"
              className="px-2 py-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono border-x border-slate-700"
            >
              Fit
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="px-2 py-1 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              -
            </button>
          </div>

          <button
            onClick={handleRunSimulation}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <PlayIcon className="w-3 h-3" /> Re-simulate
          </button>
        </div>
      </div>

      {/* Main Waveform Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Signal Tree & Instantaneous Cursor Values */}
        <div
          style={{ width: `${SIDEBAR_WIDTH}px` }}
          className="border-r border-slate-800 bg-[#0c121e] flex flex-col shrink-0 z-10"
        >
          {/* Signal Search Header */}
          <div className="h-8 border-b border-slate-800 px-2 flex items-center justify-between gap-2 bg-[#0d1322]">
            <input
              type="text"
              placeholder="Filter signals..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-0.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Column Titles */}
          <div className="h-6 border-b border-slate-800/80 px-2.5 flex items-center justify-between text-[10px] font-semibold text-slate-400 bg-slate-900/40 font-mono">
            <span>SIGNAL</span>
            <span>VALUE @ {cursorTime}</span>
          </div>

          {/* Signals List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredSignals.map((sig) => {
              const isSelected = selectedSignal === sig.name;
              const rawVal = getValueAtTime(sig.changes, cursorTime);
              const formattedVal = formatRadix(rawVal, globalRadix, sig.size);
              const isVector = sig.size > 1;

              return (
                <div
                  key={sig.code || sig.name}
                  onClick={() => setSelectedSignal(sig.name)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={`px-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                    isSelected ? "bg-slate-800/90 text-white" : "hover:bg-slate-800/40 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden pr-2">
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                        isVector
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      }`}
                    >
                      {isVector ? `[${sig.size - 1}:0]` : "1b"}
                    </span>
                    <span className="font-mono text-[11px] truncate" title={sig.name}>
                      {sig.name}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-[11px] shrink-0 font-bold ${
                      formattedVal === "x" || formattedVal === "X"
                        ? "text-red-400"
                        : formattedVal === "z" || formattedVal === "Z"
                        ? "text-yellow-400"
                        : isVector
                        ? "text-emerald-400"
                        : rawVal === "1"
                        ? "text-cyan-300"
                        : "text-slate-500"
                    }`}
                  >
                    {formattedVal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Area: Timeline Header & Waveform Canvas */}
        <div
          ref={canvasScrollRef}
          onClick={handleTimelineClick}
          className="flex-1 overflow-auto relative bg-[#090d16] cursor-crosshair"
        >
          <div style={{ width: `${totalSvgWidth}px`, minHeight: "100%" }} className="relative">
            {/* Timeline Header Ruler */}
            <div
              style={{ height: `${HEADER_HEIGHT}px` }}
              className="sticky top-0 bg-[#0d1322] border-b border-slate-800 z-20 flex items-end"
            >
              <svg width={totalSvgWidth} height={HEADER_HEIGHT} className="absolute inset-0 pointer-events-none">
                {ticks.map((tick) => (
                  <g key={tick.time} transform={`translate(${tick.x}, 0)`}>
                    <line x1={0} y1={HEADER_HEIGHT - 6} x2={0} y2={HEADER_HEIGHT} stroke="#475569" strokeWidth={1} />
                    <text
                      x={3}
                      y={HEADER_HEIGHT - 8}
                      fill="#94a3b8"
                      fontSize={9}
                      fontFamily="monospace"
                      textAnchor="start"
                    >
                      {tick.time}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Grid Lines Overlay */}
            <svg
              width={totalSvgWidth}
              height={filteredSignals.length * ROW_HEIGHT}
              className="absolute top-[32px] left-0 pointer-events-none opacity-20"
            >
              {ticks.map((tick) => (
                <line
                  key={`grid-${tick.time}`}
                  x1={tick.x}
                  y1={0}
                  x2={tick.x}
                  y2={filteredSignals.length * ROW_HEIGHT}
                  stroke="#334155"
                  strokeDasharray="2,4"
                  strokeWidth={1}
                />
              ))}
            </svg>

            {/* Signal Waveform Traces */}
            <div className="flex flex-col">
              {filteredSignals.map((sig, idx) => {
                const isSelected = selectedSignal === sig.name;
                const isVector = sig.size > 1;

                return (
                  <div
                    key={sig.code || sig.name}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`relative border-b border-slate-800/40 transition-colors ${
                      isSelected ? "bg-slate-800/20" : idx % 2 === 1 ? "bg-slate-900/10" : ""
                    }`}
                  >
                    <svg
                      width={totalSvgWidth}
                      height={ROW_HEIGHT}
                      className="absolute inset-0 pointer-events-none"
                    >
                      {isVector ? (
                        // Multi-bit bus rendering
                        <g>
                          {(() => {
                            const segments: { startT: number; endT: number; val: string }[] = [];
                            const ch = sig.changes;
                            for (let i = 0; i < ch.length; i++) {
                              const startT = ch[i][0];
                              const endT = i + 1 < ch.length ? ch[i + 1][0] : maxTime;
                              segments.push({ startT, endT, val: ch[i][1] });
                            }
                            if (segments.length === 0) {
                              segments.push({ startT: 0, endT: maxTime, val: "x" });
                            }

                            return segments.map((seg, sIdx) => {
                              const x1 = seg.startT * pxPerTime;
                              const x2 = seg.endT * pxPerTime;
                              const w = x2 - x1;
                              const yTop = 6;
                              const yBottom = ROW_HEIGHT - 6;
                              const cut = Math.min(4, w / 4);

                              const pts = `${x1 + cut},${yTop} ${x2 - cut},${yTop} ${x2},${(yTop + yBottom) / 2} ${x2 - cut},${yBottom} ${x1 + cut},${yBottom} ${x1},${(yTop + yBottom) / 2}`;
                              const displayVal = formatRadix(seg.val, globalRadix, sig.size);

                              return (
                                <g key={sIdx}>
                                  <polygon
                                    points={pts}
                                    fill="#1e293b"
                                    stroke="#38bdf8"
                                    strokeWidth={1.2}
                                  />
                                  {w > 28 && (
                                    <text
                                      x={x1 + w / 2}
                                      y={ROW_HEIGHT / 2 + 3}
                                      fill="#e2e8f0"
                                      fontSize={10}
                                      fontFamily="monospace"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                    >
                                      {displayVal}
                                    </text>
                                  )}
                                </g>
                              );
                            });
                          })()}
                        </g>
                      ) : (
                        // 1-bit digital square wave
                        <path
                          d={(() => {
                            const yHigh = 6;
                            const yLow = ROW_HEIGHT - 6;
                            let pathStr = "";
                            let currentY = yLow;

                            const ch = sig.changes;
                            if (ch.length === 0) {
                              return `M 0,${yLow} L ${totalSvgWidth},${yLow}`;
                            }

                            for (let i = 0; i < ch.length; i++) {
                              const t = ch[i][0];
                              const val = ch[i][1];
                              const nextT = i + 1 < ch.length ? ch[i + 1][0] : maxTime;
                              const targetY = val === "1" ? yHigh : yLow;

                              const xStart = t * pxPerTime;
                              const xEnd = nextT * pxPerTime;

                              if (i === 0) {
                                pathStr += `M 0,${targetY} L ${xStart},${targetY} `;
                              } else {
                                pathStr += `L ${xStart},${currentY} L ${xStart},${targetY} `;
                              }
                              pathStr += `L ${xEnd},${targetY} `;
                              currentY = targetY;
                            }

                            return pathStr;
                          })()}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth={1.8}
                        />
                      )}
                    </svg>
                  </div>
                );
              })}
            </div>

            {/* Draggable / Clicked Cursor Indicator Line */}
            <div
              style={{
                transform: `translateX(${cursorX}px)`,
                height: `${HEADER_HEIGHT + filteredSignals.length * ROW_HEIGHT}px`,
              }}
              className="absolute top-0 left-0 w-px bg-amber-400 pointer-events-none z-30"
            >
              {/* Cursor Top Pin */}
              <div className="absolute -top-1 -translate-x-1/2 bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shadow-md shadow-amber-500/50 whitespace-nowrap">
                {cursorTime} {timescale}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
