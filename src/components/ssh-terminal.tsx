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
        term.write("\r\n\x1b[33m[Hardware not connected or SSH unavailable]\x1b[0m\r\n\r\n");

        const DEMO_SSH_LINES = [
          "Connection refused or timed out.",
          "Please verify that this board supports SSH and is properly configured",
          "in the admin panel (network connection type, IP address).",
        ];

        let lineIdx = 0;
        demoInterval = setInterval(() => {
          if (lineIdx < DEMO_SSH_LINES.length) {
            term.write(DEMO_SSH_LINES[lineIdx] + "\r\n");
            lineIdx++;
          } else {
            clearInterval(demoInterval!);
          }
        }, 300);
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
    <div className={`bg-[#0f172a] rounded-lg border border-border overflow-hidden flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="w-3 h-3 rounded-full bg-danger/80" />
        <div className="w-3 h-3 rounded-full bg-warning/80" />
        <div className="w-3 h-3 rounded-full bg-success/80" />
        <span className="text-xs text-muted ml-2 font-medium font-mono">
          SSH Terminal — {boardId.slice(0, 8)}
        </span>
      </div>
      <div ref={containerRef} className={`p-2 w-full ${isFullscreen ? 'flex-1 h-[calc(100vh-8rem)]' : 'h-60 sm:h-80'}`} />
    </div>
  );
}
