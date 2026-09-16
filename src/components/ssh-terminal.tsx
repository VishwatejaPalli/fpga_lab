"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  boardId: string;
  isFullscreen?: boolean;
}

export default function SshTerminal({ boardId, isFullscreen }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let isDestroyed = false;

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

      term.write("Connecting to board SSH...\r\n");

      // Establish WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/ssh/${boardId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // We notify the backend about the terminal size so SSH PTY can size properly
        ws.send(JSON.stringify({ 
          type: "ssh-resize", 
          cols: term.cols, 
          rows: term.rows 
        }));
      };

      let sessionExpired = false;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ssh-data") {
            // SSH PTY stream sends exact raw PTY output (carriage returns included usually)
            term.write(msg.data);
          } else if (msg.type === "session-expired") {
            sessionExpired = true;
            term.write("\r\n\x1b[31m[SESSION EXPIRED / TERMINATED]\x1b[0m\r\n");
            term.write("\x1b[90mRedirecting to dashboard...\x1b[0m\r\n");
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 3000);
          }
        } catch {
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        if (sessionExpired) return;
        term.write("\r\n\x1b[31m[SSH Connection Closed]\x1b[0m\r\n");
        term.write("\x1b[90mPlease verify that the board IP address, network settings, and SSH service are properly configured.\x1b[0m\r\n");
      };

      // Send keystrokes directly to the WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ssh-input", data }));
        }
      });

      // Fit addon on resize
      const handleResize = () => {
        try {
          fitAddon.fit();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: "ssh-resize", 
              cols: term.cols, 
              rows: term.rows 
            }));
          }
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
      if (wsRef.current) wsRef.current.close();
      if (terminalRef.current) {
        if (terminalRef.current._resizeHandler) {
          window.removeEventListener("resize", terminalRef.current._resizeHandler);
        }
        terminalRef.current.dispose();
      }
    };
  }, [boardId]);

  const handleClear = () => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
  };

  return (
    <div className={`bg-slate-950 rounded-xl border border-border overflow-hidden flex flex-col shadow-lg ${isFullscreen ? 'h-full' : ''}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="text-xs text-slate-300 ml-2 font-medium font-mono">
            SSH Terminal — {boardId.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="text-[11px] font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            title="Clear Terminal Output"
          >
            Clear
          </button>
        </div>
      </div>
      <div ref={containerRef} className={`p-2 w-full ${isFullscreen ? 'flex-1 h-[calc(100vh-8rem)]' : 'h-60 sm:h-80'}`} />
    </div>
  );
}
