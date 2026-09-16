"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  boardId: string;
  isFullscreen?: boolean;
}

export default function Terminal({ boardId, isFullscreen }: TerminalProps) {
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

      let sessionExpired = false;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "uart-data") {
            // Replace \n with \r\n for xterm line wrapping
            term.write(msg.data.replace(/\r?\n/g, "\r\n"));
          } else if (msg.type === "session-expired") {
            sessionExpired = true;
            term.write("\r\n\x1b[31m[SESSION EXPIRED / TERMINATED]\x1b[0m\r\n");
            term.write("\x1b[90mRedirecting to dashboard...\x1b[0m\r\n");
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 3000);
          }
        } catch {
          term.write(event.data.replace(/\r?\n/g, "\r\n"));
        }
      };

      ws.onclose = () => {
        if (sessionExpired) return;
        term.write("\r\n\x1b[33m[Disconnected — Board UART not reachable]\x1b[0m\r\n");
        term.write("\x1b[90mRetrying connection every 5 seconds...\x1b[0m\r\n");

        // Auto-reconnect every 5 seconds
        const reconnect = () => {
          if (isDestroyed || sessionExpired) return;
          term.write("\r\x1b[90m[Reconnecting...]\x1b[0m\r\n");
          const retryWs = new WebSocket(wsUrl);

          retryWs.onopen = () => {
            term.write("\r\x1b[32m[Reconnected to UART]\x1b[0m\r\n");
            wsRef.current = retryWs;

            retryWs.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === "uart-data") {
                  term.write(msg.data.replace(/\r?\n/g, "\r\n"));
                } else if (msg.type === "session-expired") {
                  sessionExpired = true;
                  term.write("\r\n\x1b[31m[SESSION EXPIRED / TERMINATED]\x1b[0m\r\n");
                  term.write("\x1b[90mRedirecting to dashboard...\x1b[0m\r\n");
                  setTimeout(() => {
                    window.location.href = "/dashboard";
                  }, 3000);
                  retryWs.close();
                }
              } catch {
                term.write(event.data.replace(/\r?\n/g, "\r\n"));
              }
            };

            retryWs.onclose = () => {
              if (sessionExpired) return;
              term.write("\r\n\x1b[33m[Connection lost]\x1b[0m\r\n");
              if (!isDestroyed) {
                demoInterval = setTimeout(reconnect, 5000) as unknown as ReturnType<typeof setInterval>;
              }
            };
          };

          retryWs.onerror = () => {
            retryWs.close();
            if (!isDestroyed && !sessionExpired) {
              demoInterval = setTimeout(reconnect, 5000) as unknown as ReturnType<typeof setInterval>;
            }
          };
        };

        demoInterval = setTimeout(reconnect, 5000) as unknown as ReturnType<typeof setInterval>;
      };

      // Send keystrokes directly to the WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "uart-input", data }));
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
            UART Console — {boardId.slice(0, 8)}
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
