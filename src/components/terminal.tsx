"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  boardId: string;
}

const DEMO_UART_LINES = [
  "=== FPGA UART Console ===",
  "Board initialized successfully",
  "Clock: 100 MHz | Baud: 115200",
  "",
  "> LED Pattern: 0b10101010",
  "> Switch Status: SW[7:0] = 0xFF",
  "> Counter: 0x0001",
  "> Counter: 0x0002",
  "> Counter: 0x0003",
  "> Counter: 0x0004",
  "> Temperature: 34.2°C",
  "> Counter: 0x0005",
  "> LED Pattern: 0b01010101",
  "> Counter: 0x0006",
  "> Button pressed: BTN0",
  "> Counter: 0x0007",
  "> Switch Status: SW[7:0] = 0x0F",
  "> Counter: 0x0008",
  "",
  "Type a character to send to FPGA...",
];

export default function Terminal({ boardId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/uart/${boardId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    let demoInterval: ReturnType<typeof setInterval> | null = null;

    ws.onopen = () => {
      appendOutput("[Connected to UART]\n", "text-success");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "uart-data") {
          appendOutput(msg.data);
        }
      } catch {
        appendOutput(event.data);
      }
    };

    ws.onclose = () => {
      appendOutput("\n[Hardware not connected — showing demo output]\n\n", "text-warning");
      // Start demo mode: simulate UART output
      let lineIdx = 0;
      demoInterval = setInterval(() => {
        if (lineIdx < DEMO_UART_LINES.length) {
          appendOutput(DEMO_UART_LINES[lineIdx] + "\n");
          lineIdx++;
        } else {
          // Loop with random counter values
          const counter = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0").toUpperCase();
          appendOutput(`> Counter: 0x${counter}\n`);
        }
      }, 800);
    };

    ws.onerror = () => {
      // Will trigger onclose which starts demo mode
    };

    // Handle keyboard input
    function handleKeyDown(e: KeyboardEvent) {
      if (
        ws.readyState === WebSocket.OPEN &&
        containerRef.current?.contains(document.activeElement)
      ) {
        const key = e.key.length === 1 ? e.key : e.key === "Enter" ? "\r\n" : "";
        if (key) {
          ws.send(JSON.stringify({ type: "uart-input", data: key }));
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (demoInterval) clearInterval(demoInterval);
      ws.close();
    };
  }, [boardId]);

  function appendOutput(text: string, className?: string) {
    if (!outputRef.current) return;
    const span = document.createElement("span");
    if (className) span.className = className;
    span.textContent = text;
    outputRef.current.appendChild(span);
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }

  return (
    <div
      ref={containerRef}
      className="bg-black rounded-lg border border-border overflow-hidden"
      tabIndex={0}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <div className="w-3 h-3 rounded-full bg-danger" />
        <div className="w-3 h-3 rounded-full bg-warning" />
        <div className="w-3 h-3 rounded-full bg-success" />
        <span className="text-xs text-muted ml-2">
          UART Console — {boardId.slice(0, 8)}
        </span>
      </div>
      <pre
        ref={outputRef}
        className="p-3 sm:p-4 font-mono text-xs sm:text-sm text-green-400 h-60 sm:h-80 overflow-y-auto whitespace-pre-wrap scrollbar-hide"
      />
    </div>
  );
}
