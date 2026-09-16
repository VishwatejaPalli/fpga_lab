"use client";

import { useState } from "react";

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
  placementData?: any;
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
  placementData,
}: DeviceFloorplanViewProps) {
  const [showLogic, setShowLogic] = useState(true);
  const [showNets, setShowNets] = useState(true);
  const [showClockRegions, setShowClockRegions] = useState(true);
  const [selectedCell, setSelectedCell] = useState<any | null>(null);
  const [hoveredCell, setHoveredCell] = useState<any | null>(null);

  // Region boundaries in SVG space (1000x700 viewBox)
  const clockRegionBounds: Record<string, { x: number; y: number; w: number; h: number }> = {
    X0Y2: { x: 240, y: 40, w: 320, h: 270 },
    X1Y2: { x: 580, y: 40, w: 320, h: 270 },
    X0Y1: { x: 240, y: 340, w: 320, h: 270 },
    X1Y1: { x: 580, y: 340, w: 320, h: 270 },
  };

  // Derive cells array from placementData or construct deterministic cell list from synthesis metrics
  const rawCells = placementData?.cells || [];
  const cellsToRender = rawCells.length > 0
    ? rawCells
    : Array.from({ length: Math.max(0, Math.round(lutUsage * 1.5) + Math.round(ffUsage * 1.5)) }).map((_, i) => {
        const isFF = i % 3 === 0;
        const type = isFF ? "FF" : "LUT";
        const regionKeys = ["X0Y1", "X1Y1", "X0Y2", "X1Y2"];
        const clockRegion = regionKeys[i % regionKeys.length];
        return {
          id: `cell_${i}`,
          name: isFF ? `reg_stage_${i}` : `lut_gate_${i}`,
          type,
          rawType: isFF ? "$dff" : "$lut",
          clockRegion,
          sliceX: (i * 7) % 15,
          sliceY: Math.floor(i / 15),
          connections: { CLK: 1, D: i, Q: i + 1 },
        };
      });

  // Calculate coordinates for cell rendering
  const renderedCells = cellsToRender.map((cell: any, index: number) => {
    const regionKey = cell.clockRegion && clockRegionBounds[cell.clockRegion] ? cell.clockRegion : "X0Y1";
    const bounds = clockRegionBounds[regionKey];

    // Compute pixel position inside clock region
    const sx = (cell.sliceX !== undefined ? cell.sliceX : index % 12) % 15;
    const sy = cell.sliceY !== undefined ? cell.sliceY : Math.floor(index / 12);
    
    const posX = bounds.x + 15 + sx * 19;
    const posY = bounds.y + 20 + (sy % 10) * 22;

    let color = "#00f0ff"; // LUT - Cyan
    if (cell.type === "FF") color = "#a855f7"; // FF - Purple
    else if (cell.type === "BRAM") color = "#ec4899"; // BRAM - Pink
    else if (cell.type === "DSP") color = "#f59e0b"; // DSP - Amber
    else if (cell.type === "IO") color = "#10b981"; // IO - Emerald

    return {
      ...cell,
      posX,
      posY,
      color,
    };
  });

  const activeInspectCell = hoveredCell || selectedCell;

  return (
    <div className="w-full h-full bg-[#030712] text-slate-200 flex flex-col min-h-0 overflow-hidden font-mono select-none">
      {/* Controls Header Toolbar */}
      <div className="h-8 bg-[#090d16] border-b border-slate-800 flex items-center justify-between px-3 text-xs shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-[#00f0ff] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse" />
            Device Layout - {projectPart}
          </span>

          <div className="flex items-center gap-4 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={showLogic}
                onChange={(e) => setShowLogic(e.target.checked)}
                className="accent-cyan-500 rounded cursor-pointer"
              />
              <span className="text-cyan-400">Placed Logic ({renderedCells.length} cells)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={showNets}
                onChange={(e) => setShowNets(e.target.checked)}
                className="accent-red-500 rounded cursor-pointer"
              />
              <span className="text-red-400">Routing Nets</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={showClockRegions}
                onChange={(e) => setShowClockRegions(e.target.checked)}
                className="accent-purple-500 rounded cursor-pointer"
              />
              <span className="text-purple-400">Clock Regions</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-slate-400">LUT:</span>
          <span className="text-cyan-400 font-bold">{lutUsage}%</span>
          <span className="text-slate-400">FF:</span>
          <span className="text-purple-400 font-bold">{ffUsage}%</span>
          <span className="text-slate-400 font-semibold">WNS:</span>
          <span className="text-[#00f0ff] font-bold">{wnsValue}</span>
        </div>
      </div>

      {synthStatus !== "Complete" && renderedCells.length === 0 ? (
        /* Placeholder when no synthesis results exist */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="text-4xl">🔲</div>
            <div className="font-bold text-slate-200">Device Floorplan</div>
            <p className="text-xs text-slate-400 max-w-md">
              Run Synthesis to generate physical logic placement data for &apos;{topModuleName}&apos;.
            </p>
            <button
              onClick={handleRunSynthesis}
              className="px-4 py-2 bg-blue-600 text-[#ffffff] rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-all cursor-pointer"
            >
              ▶ Run Synthesis Now
            </button>
          </div>
        </div>
      ) : (
        /* Data-driven FPGA Die Silicon SVG Canvas */
        <div className="flex-1 relative bg-[#02050b] overflow-hidden flex items-center justify-center p-2">
          <svg
            className="w-full h-full max-w-5xl max-h-[620px]"
            viewBox="0 0 1000 700"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Dark Die Silicon Background */}
            <rect x="0" y="0" width="1000" height="700" fill="#030712" rx="4" />

            {/* Substrate Grid Pattern Lines */}
            <defs>
              <pattern id="siliconGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0f172a" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="1000" height="700" fill="url(#siliconGrid)" />

            {/* Left Outer Die Frame & Peripheral I/O Controller Block */}
            <rect x="10" y="20" width="190" height="660" fill="#090d16" stroke="#1e293b" strokeWidth="1" rx="4" />
            <text x="25" y="45" fill="#00f0ff" fontSize="11" fontWeight="bold">
              PS7 / I/O CONTROLLER
            </text>
            <rect x="25" y="60" width="160" height="120" fill="#0f172a" stroke="#00f0ff" strokeWidth="0.8" opacity="0.6" rx="2" />
            <text x="105" y="125" fill="#94a3b8" fontSize="10" textAnchor="middle">
              ARM Cortex-A9 Dual Core
            </text>

            {/* Physical I/O Pads (Far Left) */}
            {Array.from({ length: 32 }).map((_, i) => (
              <rect
                key={`pad-left-${i}`}
                x="185"
                y={40 + i * 20}
                width="12"
                height="10"
                fill="#10b981"
                stroke="#047857"
                strokeWidth="0.5"
                rx="1"
              />
            ))}

            {/* Physical I/O Pads (Far Right) */}
            {Array.from({ length: 32 }).map((_, i) => (
              <rect
                key={`pad-right-${i}`}
                x="930"
                y={40 + i * 20}
                width="14"
                height="12"
                fill="#d97706"
                stroke="#b45309"
                strokeWidth="0.5"
                rx="1"
              />
            ))}

            {/* Clock Regions Borders & Labels */}
            {showClockRegions &&
              Object.entries(clockRegionBounds).map(([regionName, bounds]) => (
                <g key={`region-${regionName}`}>
                  <rect
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.w}
                    height={bounds.h}
                    fill="#090d16"
                    fillOpacity="0.4"
                    stroke="#a855f7"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    rx="3"
                  />
                  <text
                    x={bounds.x + 10}
                    y={bounds.y + 20}
                    fill="#c084fc"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    Region {regionName}
                  </text>
                </g>
              ))}

            {/* BRAM & DSP Dedicated Resource Columns */}
            <g>
              <rect x="540" y="40" width="22" height="570" fill="#090d16" stroke="#334155" strokeWidth="1" rx="2" />
              <text x="551" y="320" fill="#ec4899" fontSize="9" fontWeight="bold" transform="rotate(-90 551 320)" textAnchor="middle">
                BLOCK RAM (RAMB36) / DSP48E1
              </text>
            </g>

            {/* Routing Nets Connections */}
            {showNets && showLogic && renderedCells.length > 1 && (
              <g opacity="0.6">
                {renderedCells.map((cell: any, i: number) => {
                  if (i === 0) return null;
                  const prev = renderedCells[i - 1];
                  const isSelectedPath =
                    activeInspectCell && (activeInspectCell.id === cell.id || activeInspectCell.id === prev.id);
                  return (
                    <path
                      key={`net-${cell.id}-${i}`}
                      d={`M ${prev.posX + 6} ${prev.posY + 6} Q ${(prev.posX + cell.posX) / 2} ${(prev.posY + cell.posY) / 2 - 20} ${cell.posX + 6} ${cell.posY + 6}`}
                      stroke={isSelectedPath ? "#00f0ff" : "#ef4444"}
                      strokeWidth={isSelectedPath ? "2.5" : "1"}
                      fill="none"
                      strokeDasharray={isSelectedPath ? "none" : "3 2"}
                    />
                  );
                })}
              </g>
            )}

            {/* Data-Driven Placed Logic Cells */}
            {showLogic &&
              renderedCells.map((cell: any) => {
                const isHovered = hoveredCell?.id === cell.id;
                const isSelected = selectedCell?.id === cell.id;

                return (
                  <g
                    key={`cell-node-${cell.id}`}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => setSelectedCell(isSelected ? null : cell)}
                  >
                    <rect
                      x={cell.posX}
                      y={cell.posY}
                      width={isHovered || isSelected ? 16 : 13}
                      height={isHovered || isSelected ? 16 : 13}
                      fill={cell.color}
                      stroke={isSelected ? "#ffffff" : isHovered ? "#00f0ff" : "none"}
                      strokeWidth={isSelected || isHovered ? 2 : 0}
                      rx="2"
                      opacity={isSelected || isHovered ? 1 : 0.85}
                    />
                  </g>
                );
              })}

            {/* Interactive Inspector HUD Card */}
            {activeInspectCell && (
              <g transform="translate(240, 620)">
                <rect x="0" y="0" width="660" height="65" fill="#090d16" stroke="#00f0ff" strokeWidth="1" rx="4" />
                <text x="15" y="22" fill="#00f0ff" fontSize="11" fontWeight="bold">
                  Cell: {activeInspectCell.name}
                </text>
                <text x="15" y="42" fill="#94a3b8" fontSize="10">
                  Type: <tspan fill="#e2e8f0">{activeInspectCell.rawType || activeInspectCell.type}</tspan> | Region:{" "}
                  <tspan fill="#c084fc">{activeInspectCell.clockRegion}</tspan> | Slice: X{activeInspectCell.sliceX}Y{activeInspectCell.sliceY}
                </text>
                <text x="380" y="22" fill="#10b981" fontSize="10">
                  Status: Placed & Routed
                </text>
                <text x="380" y="42" fill="#cbd5e1" fontSize="9">
                  Pins: {Object.keys(activeInspectCell.connections || {}).join(", ") || "CLK, D, Q"}
                </text>
              </g>
            )}
          </svg>

          {/* Bottom Scale & Legend Overlay */}
          <div className="absolute bottom-3 right-3 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-300 flex items-center gap-3 backdrop-blur-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#00f0ff] rounded-xs" /> LUT (Logic)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#a855f7] rounded-xs" /> Flip-Flop
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ec4899] rounded-xs" /> Block RAM
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#10b981] rounded-xs" /> I/O Pad
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
