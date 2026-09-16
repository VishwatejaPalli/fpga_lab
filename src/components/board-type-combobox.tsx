"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Known FPGA board types with display labels, grouped by manufacturer.
 * The `value` is the openFPGALoader-compatible board identifier.
 */
export const KNOWN_BOARD_TYPES: { value: string; label: string; manufacturer: string }[] = [
  // Digilent — Xilinx / AMD
  { value: "basys3", label: "Basys 3", manufacturer: "Digilent" },
  { value: "nexysA7", label: "Nexys A7", manufacturer: "Digilent" },
  { value: "nexys4", label: "Nexys 4 DDR", manufacturer: "Digilent" },
  { value: "nexysVideo", label: "Nexys Video", manufacturer: "Digilent" },
  { value: "arty-a7", label: "Arty A7 (Artix-7)", manufacturer: "Digilent" },
  { value: "arty-s7", label: "Arty S7 (Spartan-7)", manufacturer: "Digilent" },
  { value: "cmod-a7", label: "Cmod A7", manufacturer: "Digilent" },
  { value: "zybo-z7", label: "Zybo Z7 (Zynq-7000)", manufacturer: "Digilent" },
  { value: "zedboard", label: "ZedBoard (Zynq-7000)", manufacturer: "Digilent / Avnet" },
  { value: "genesys2", label: "Genesys 2 (Kintex-7)", manufacturer: "Digilent" },
  { value: "eclypse-z7", label: "Eclypse Z7 (Zynq-7000)", manufacturer: "Digilent" },

  // Xilinx / AMD Evaluation Kits
  { value: "spartan3", label: "Spartan-3 Starter Kit", manufacturer: "Xilinx" },
  { value: "spartan3e", label: "Spartan-3E Starter Kit", manufacturer: "Xilinx" },
  { value: "kintex7", label: "Kintex-7 KC705", manufacturer: "AMD / Xilinx" },
  { value: "virtex7", label: "Virtex-7 VC707", manufacturer: "AMD / Xilinx" },

  // TUL
  { value: "pynq-z2", label: "PYNQ-Z2", manufacturer: "TUL" },

  // Terasic — Intel / Altera
  { value: "de10lite", label: "DE10-Lite", manufacturer: "Terasic" },
  { value: "de0nano", label: "DE0-Nano", manufacturer: "Terasic" },
  { value: "de1soc", label: "DE1-SoC", manufacturer: "Terasic" },

  // Lattice
  { value: "icebreaker", label: "iCEBreaker", manufacturer: "1BitSquared" },
  { value: "icestick", label: "iCEstick (iCE40)", manufacturer: "Lattice" },

  // Gowin / Sipeed
  { value: "tangnano9k", label: "Tang Nano 9K (GW1NR-9)", manufacturer: "Sipeed" },
];

interface BoardTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function BoardTypeCombobox({ value, onChange, required }: BoardTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  const [search, setSearch] = useState(() => {
    const match = KNOWN_BOARD_TYPES.find(
      (b) => b.value.toLowerCase() === value.toLowerCase(),
    );
    return match ? `${match.label} (${match.value})` : value;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  // Sync the search text when the value changes externally (e.g. on edit)
  if (value !== prevValue) {
    setPrevValue(value);
    const match = KNOWN_BOARD_TYPES.find(
      (b) => b.value.toLowerCase() === value.toLowerCase(),
    );
    setSearch(match ? `${match.label} (${match.value})` : value);
  }

  const filtered = KNOWN_BOARD_TYPES.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.value.toLowerCase().includes(q) ||
      b.label.toLowerCase().includes(q) ||
      b.manufacturer.toLowerCase().includes(q)
    );
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  const selectItem = useCallback(
    (val: string) => {
      onChange(val);
      const match = KNOWN_BOARD_TYPES.find(
        (b) => b.value.toLowerCase() === val.toLowerCase(),
      );
      setSearch(match ? `${match.label} (${match.value})` : val);
      setOpen(false);
      setHighlightIdx(-1);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    setOpen(true);
    setHighlightIdx(-1);
    // If user types something that exactly matches a known board value, select it
    const exactMatch = KNOWN_BOARD_TYPES.find(
      (b) => b.value.toLowerCase() === v.toLowerCase(),
    );
    if (exactMatch) {
      onChange(exactMatch.value);
    } else {
      // Custom entry
      onChange(v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (!open) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < filtered.length) {
          selectItem(filtered[highlightIdx].value);
        } else {
          setOpen(false);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlightIdx(-1);
        break;
    }
  };

  const showCustomHint =
    search.trim() !== "" &&
    !KNOWN_BOARD_TYPES.some(
      (b) =>
        b.value.toLowerCase() === search.toLowerCase() ||
        `${b.label} (${b.value})`.toLowerCase() === search.toLowerCase(),
    );

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search or type a board type…"
        className="input-field pr-8"
        required={required}
        autoComplete="off"
      />
      {/* Chevron icon */}
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
        onClick={() => {
          setOpen(!open);
          inputRef.current?.focus();
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg shadow-black/20"
          role="listbox"
        >
          {filtered.length === 0 && !showCustomHint && (
            <li className="px-3 py-2 text-sm text-muted">No boards found</li>
          )}

          {showCustomHint && (
            <li
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/10 border-b border-border/50"
              onClick={() => selectItem(search.trim())}
              role="option"
              aria-selected={false}
            >
              <span className="flex items-center justify-center w-5 h-5 rounded bg-accent/20 text-accent text-xs font-bold">+</span>
              <span>
                Use custom: <span className="font-semibold text-accent">&quot;{search.trim()}&quot;</span>
              </span>
            </li>
          )}

          {filtered.map((board, idx) => {
            const isSelected = board.value.toLowerCase() === value.toLowerCase();
            const isHighlighted = idx === highlightIdx;
            return (
              <li
                key={board.value}
                role="option"
                aria-selected={isSelected}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors
                  ${isHighlighted ? "bg-accent/15 text-foreground" : "hover:bg-accent/10"}
                  ${isSelected ? "text-accent font-medium" : "text-foreground"}
                `}
                onClick={() => selectItem(board.value)}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate">
                    {board.label}
                    <span className="ml-1.5 text-xs text-muted font-mono">{board.value}</span>
                  </span>
                  <span className="text-xs text-muted truncate">{board.manufacturer}</span>
                </div>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-accent">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
