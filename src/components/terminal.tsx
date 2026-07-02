"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  boardId: string;
}

export default function Terminal({ boardId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let isDestroyed = false;
    let demoInterval: ReturnType<typeof setInterval> | null = null;

    const initTerminal = async () => {
      // Dynamically import xterm to prevent Next.js SSR build errors
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (isDestroyed) return;

      const term = new XTerm({
        cursorBlink: true,
        fontFamily: 'Fira Code, Courier New, monospace',
        fontSize: 13,
        theme: {
          background: "#0f172a", // Slate 900
          foreground: "#f8fafc", // Slate 50
          cursor: "#38bdf8", // Sky 400
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(containerRef.current!);
      fitAddon.fit();
      terminalRef.current = term;

      term.write("Connecting to board UART...\r\n");

      // Establish WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/uart/${boardId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        term.write("\r\x1b[32m[Connected to UART]\x1b[0m\r\n");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "uart-data") {
            // Replace \n with \r\n for xterm line wrapping
            term.write(msg.data.replace(/\r?\n/g, "\r\n"));
          }
        } catch {
          term.write(event.data.replace(/\r?\n/g, "\r\n"));
        }
      };

      ws.onclose = () => {
        term.write("\r\n\x1b[33m[Hardware not connected — showing demo output]\x1b[0m\r\n\r\n");

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
          "Type characters below to see echo...",
        ];

        let lineIdx = 0;
        demoInterval = setInterval(() => {
          if (lineIdx < DEMO_UART_LINES.length) {
            term.write(DEMO_UART_LINES[lineIdx] + "\r\n");
            lineIdx++;
          } else {
            const counter = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0").toUpperCase();
            term.write(`> Counter: 0x${counter}\r\n`);
          }
        }, 1000);
      };

      // Send keystrokes directly to the WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "uart-input", data }));
        } else {
          // Local echo fallback for demo mode
          if (data === "\r") {
            term.write("\r\n");
          } else if (data === "\x7f") {
            // Handle backspace locally in demo mode
            term.write("\b \b");
          } else {
            term.write(data);
          }
        }
      });

      // Fit addon on resize
      const handleResize = () => {
        try {
          fitAddon.fit();
        } catch (e) {
          // Fit might fail if container is hidden/collapsing
        }
      };
      window.addEventListener("resize", handleResize);
      (term as any)._resizeHandler = handleResize;
    };

    initTerminal();

    return () => {
      isDestroyed = true;
      if (demoInterval) clearInterval(demoInterval);
      if (wsRef.current) wsRef.current.close();
      if (terminalRef.current) {
        if (terminalRef.current._resizeHandler) {
          window.removeEventListener("resize", terminalRef.current._resizeHandler);
        }
        terminalRef.current.dispose();
      }
    };
  }, [boardId]);

  return (
    <div className="bg-[#0f172a] rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <div className="w-3 h-3 rounded-full bg-danger/80" />
        <div className="w-3 h-3 rounded-full bg-warning/80" />
        <div className="w-3 h-3 rounded-full bg-success/80" />
        <span className="text-xs text-muted ml-2 font-medium font-mono">
          UART Console — {boardId.slice(0, 8)}
        </span>
      </div>
      <div ref={containerRef} className="p-2 h-60 sm:h-80" />
    </div>
  );
}
