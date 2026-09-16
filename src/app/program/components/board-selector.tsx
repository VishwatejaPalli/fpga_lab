"use client";

import { Board } from "../hooks/useProgrammer";
import { useState } from "react";
import { CheckIcon } from "@/components/icons";

interface BoardSelectorProps {
  selectedBoardId: string;
  setSelectedBoardId: (id: string) => void;
  availableBoards: Board[];
  jobId: string | null;
}

export default function BoardSelector({
  selectedBoardId,
  setSelectedBoardId,
  availableBoards,
  jobId,
}: BoardSelectorProps) {
  const [viewMode, setViewMode] = useState<"cards" | "dropdown">("cards");

  return (
    <div className="cockpit-panel p-5 sm:p-6 rounded-2xl border border-border">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/30 text-xs font-mono font-bold">
            01
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-base">
              Target FPGA Hardware
            </h2>
            <p className="text-xs text-muted">
              Select the physical board to program via JTAG interface
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1 text-xs font-mono font-medium rounded transition-all ${
              viewMode === "cards"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("dropdown")}
            className={`px-3 py-1 text-xs font-mono font-medium rounded transition-all ${
              viewMode === "dropdown"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {viewMode === "dropdown" ? (
        <select
          value={selectedBoardId}
          onChange={(e) => setSelectedBoardId(e.target.value)}
          className="w-full bg-card border border-border text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40"
          disabled={!!jobId}
        >
          <option value="">Choose an FPGA board...</option>
          {availableBoards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name} — {board.fpgaFamily} ({board.boardType}){" "}
              {board.status === "busy" ? "[IN USE]" : `[${board.status.toUpperCase()}]`}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {availableBoards.map((board) => {
            const isSelected = board.id === selectedBoardId;
            const capabilities = board.capabilities || [];
            const isOnline = board.status === "free" || board.status === "busy" || board.status === "programming";

            return (
              <div
                key={board.id}
                onClick={() => !jobId && setSelectedBoardId(board.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/10"
                    : "border-border hover:border-primary/40 bg-card/70 hover:bg-card"
                } ${jobId ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2 pr-6">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      board.status === "free"
                        ? "led-glow-green"
                        : board.status === "busy" || board.status === "programming"
                        ? "led-glow-amber"
                        : "led-glow-red"
                    }`}
                  />
                  <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {board.name}
                  </h3>
                </div>

                <div className="text-xs text-muted font-mono mb-3">
                  <span className="text-foreground/80 font-medium">{board.fpgaFamily}</span>
                  <span className="mx-1.5 opacity-40">|</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{board.boardType}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-muted/30 text-muted border border-border"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

