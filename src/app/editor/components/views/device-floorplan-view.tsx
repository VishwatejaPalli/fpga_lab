"use client";

interface DeviceFloorplanViewProps {
  projectPart: string;
  synthStatus: string;
  topModuleName: string;
  lutUsage: number;
  ffUsage: number;
  bramUsage: number;
  dspUsage: number;
  wnsValue: string;
  handleRunSynthesis: () => void;
}

export default function DeviceFloorplanView({
  projectPart,
  synthStatus,
  topModuleName,
  lutUsage,
  ffUsage,
  bramUsage,
  dspUsage,
  wnsValue,
  handleRunSynthesis,
}: DeviceFloorplanViewProps) {
  return (
    <div className="w-full h-full bg-[#030712] text-slate-200 flex flex-col min-h-0 overflow-hidden font-mono select-none">
      {/* Controls Header Toolbar */}
      <div className="h-8 bg-[#090d16] border-b border-slate-800 flex items-center justify-between px-3 text-xs shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-[#00f0ff] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse" />
            Device Layout - {projectPart}
          </span>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
              <input type="checkbox" defaultChecked className="accent-cyan-500 rounded" />
              <span className="text-cyan-400">Placed Logic (Cyan)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
              <input type="checkbox" defaultChecked className="accent-red-500 rounded" />
              <span className="text-red-400">Routing Nets (Red)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
              <input type="checkbox" defaultChecked className="accent-pink-500 rounded" />
              <span className="text-pink-400">Clock Regions</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-400">LUT:</span>
          <span className="text-cyan-400 font-bold">{lutUsage}%</span>
          <span className="text-slate-400">FF:</span>
          <span className="text-purple-400 font-bold">{ffUsage}%</span>
          <span className="text-slate-400">WNS:</span>
          <span className="text-[#00f0ff] font-bold">{wnsValue}</span>
        </div>
      </div>

      {synthStatus !== "Complete" ? (
        /* Placeholder when no synthesis results exist */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="text-4xl">🔲</div>
            <div className="font-bold text-slate-200">Device Floorplan</div>
            <p className="text-xs text-slate-400 max-w-md">
              Run Synthesis to generate placement data for &apos;{topModuleName}&apos;.
            </p>
            <button
              onClick={handleRunSynthesis}
              className="px-4 py-2 bg-blue-600 text-[#ffffff] rounded-lg text-xs font-bold shadow-md hover:bg-blue-700"
            >
              ▶ Run Synthesis Now
            </button>
          </div>
        </div>
      ) : (
        /* Data-driven FPGA Die Silicon SVG Canvas */
        <div className="flex-1 relative bg-[#02050b] overflow-hidden flex items-center justify-center p-2">
          <svg
            className="w-full h-full max-w-5xl max-h-[600px]"
            viewBox="0 0 1000 700"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Dark Die Silicon Background */}
            <rect x="0" y="0" width="1000" height="700" fill="#030712" />

            {/* Left Dark Outer Panel */}
            <rect x="0" y="0" width="220" height="700" fill="#000000" />
            <rect x="130" y="230" width="50" height="90" fill="#00a896" opacity="0.8" />

            {/* I/O Banks Vertical Column (Far Left Pads) */}
            {Array.from({ length: 45 }).map((_, i) => (
              <rect
                key={`iol-${i}`}
                x="195"
                y={30 + i * 14}
                width="8"
                height="10"
                fill="#00f0ff"
                opacity="0.7"
              />
            ))}

            {/* Right Outer I/O Bank Towers */}
            <g>
              {Array.from({ length: 35 }).map((_, i) => (
                <rect
                  key={`ior1-${i}`}
                  x="930"
                  y={40 + i * 18}
                  width="16"
                  height="14"
                  fill="#d97706"
                  stroke="#fbbf24"
                  strokeWidth="0.5"
                />
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <rect
                  key={`ior2-${i}`}
                  x="965"
                  y={40 + i * 18}
                  width="16"
                  height="14"
                  fill="#00a896"
                  stroke="#00f0ff"
                  strokeWidth="0.5"
                />
              ))}
            </g>

            {/* Vertical Routing Channel Bus Lines */}
            {Array.from({ length: 24 }).map((_, i) => (
              <g key={`bus-${i}`}>
                <line
                  x1={240 + i * 28}
                  y1="0"
                  x2={240 + i * 28}
                  y2="700"
                  stroke={i % 3 === 0 ? "#ef4444" : i % 5 === 0 ? "#10b981" : "#3b82f6"}
                  strokeWidth="1"
                  opacity="0.4"
                />
                <line
                  x1={243 + i * 28}
                  y1="0"
                  x2={243 + i * 28}
                  y2="700"
                  stroke={i % 2 === 0 ? "#ec4899" : "#8b5cf6"}
                  strokeWidth="0.8"
                  opacity="0.3"
                />
              </g>
            ))}

            {/* Horizontal Clock Region Boundary Lines */}
            <line x1="220" y1="280" x2="920" y2="280" stroke="#ec4899" strokeWidth="2" />
            <line x1="220" y1="560" x2="920" y2="560" stroke="#ec4899" strokeWidth="2" />
            <line x1="420" y1="0" x2="420" y2="700" stroke="#a855f7" strokeWidth="2" />
            <line x1="680" y1="0" x2="680" y2="700" stroke="#a855f7" strokeWidth="1.5" />

            {/* Clock Region Labels */}
            <text x="230" y="275" fill="#a855f7" fontSize="12" fontWeight="bold">
              X0Y2
            </text>
            <text x="430" y="275" fill="#a855f7" fontSize="12" fontWeight="bold">
              X1Y2
            </text>
            <text x="230" y="555" fill="#a855f7" fontSize="12" fontWeight="bold">
              X0Y1
            </text>
            <text x="430" y="555" fill="#a855f7" fontSize="12" fontWeight="bold">
              X1Y1
            </text>

            {/* Placed Logic Cell Sprites — density scales with real LUT utilization */}
            <g fill="#00f0ff" opacity="0.85">
              {Array.from({ length: Math.max(2, Math.round(lutUsage * 3.5)) }).map((_, i) => {
                const rx = 235 + (i % 14) * 12 + ((i * 7) % 11);
                const ry = 295 + Math.floor(i / 14) * 18 + ((i * 13) % 9);
                return <rect key={`c1-${i}`} x={rx} y={ry} width="7" height="12" rx="0.5" />;
              })}
            </g>

            {/* Cluster 2: Bottom Placed Logic */}
            <g fill="#00d8d6" opacity="0.9">
              {Array.from({ length: Math.max(2, Math.round(ffUsage * 4)) }).map((_, i) => {
                const rx = 240 + (i % 22) * 8 + ((i * 3) % 7);
                const ry = 570 + Math.floor(i / 22) * 11 + ((i * 5) % 6);
                return <rect key={`c2-${i}`} x={rx} y={ry} width="5" height="8" />;
              })}
            </g>

            {/* Cluster 3: Middle Interconnect */}
            <g fill="#06b6d4" opacity="0.8">
              {Array.from({ length: Math.max(1, Math.round((lutUsage + ffUsage) * 0.8)) }).map((_, i) => {
                const rx = 430 + (i % 8) * 14 + ((i * 5) % 9);
                const ry = 480 + Math.floor(i / 8) * 12;
                return <rect key={`c3-${i}`} x={rx} y={ry} width="8" height="6" />;
              })}
            </g>

            {/* Placed BRAM / DSP Highlight Towers */}
            <g>
              <rect x="630" y="100" width="14" height="60" stroke="#e2e8f0" fill="none" strokeWidth="1.5" />
              {bramUsage > 0 && <rect x="635" y="145" width="8" height="12" fill="#ec4899" />}
              <rect x="630" y="210" width="14" height="24" stroke="#e2e8f0" fill="none" strokeWidth="1" />

              {Array.from({ length: 8 }).map((_, i) => (
                <rect
                  key={`dsp-${i}`}
                  x="630"
                  y={250 + i * 22}
                  width="14"
                  height="14"
                  stroke="#e2e8f0"
                  fill={dspUsage > 0 && i < Math.ceil(dspUsage / 12.5) ? "#f59e0b" : "none"}
                  strokeWidth="1"
                />
              ))}
            </g>

            {/* Critical Timing Path Net Line */}
            {wnsValue !== "--" && (
              <path
                d="M 195 290 Q 240 280 280 320 T 360 410 T 635 151"
                stroke="#ec4899"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 2"
              />
            )}

            {/* Utilization Overlay Text */}
            <text x="700" y="50" fill="#00f0ff" fontSize="11" fontWeight="bold">
              LUT: {lutUsage}% FF: {ffUsage}%
            </text>
            <text x="700" y="68" fill="#a855f7" fontSize="10">
              BRAM: {bramUsage}% DSP: {dspUsage}%
            </text>
          </svg>

          {/* Bottom Floating Map Scale */}
          <div className="absolute bottom-3 right-3 bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 flex items-center gap-3 backdrop-blur-xs">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#00f0ff] rounded-xs" /> Placed Slice
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#ec4899] rounded-xs" /> Critical Path
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#d97706] rounded-xs" /> I/O Bank
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
