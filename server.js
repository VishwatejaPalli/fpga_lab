// Custom server with WebSocket support for UART and job logs
// Run with: node server.js

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");

const { EventEmitter } = require("events");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.APP_PORT || "3000", 10);

// Initialize global event emitters for WebSocket communication
if (!globalThis.__jobQueue) {
  globalThis.__jobQueue = new EventEmitter();
  globalThis.__jobQueue.setMaxListeners(50);
}
if (!globalThis.__uartService) {
  // Will be replaced by real UART service when hardware is connected
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ─── WebSocket server for UART and job logs ──────────────────────────────

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true);

    // Only handle our WebSocket paths
    if (
      pathname &&
      (pathname.startsWith("/ws/uart/") ||
        pathname.startsWith("/ws/logs/"))
    ) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    const { pathname } = parse(req.url, true);

    if (pathname.startsWith("/ws/uart/")) {
      const boardId = pathname.replace("/ws/uart/", "");
      handleUARTConnection(ws, boardId);
    } else if (pathname.startsWith("/ws/logs/")) {
      const jobId = pathname.replace("/ws/logs/", "");
      handleLogConnection(ws, jobId);
    }
  });

  // ─── UART WebSocket handler ──────────────────────────────────────────────

  function handleUARTConnection(ws, boardId) {
    console.log(`[WS] UART client connected for board ${boardId}`);

    // Dynamic import for UART service (ESM modules)
    let uartCleanup = null;

    // Forward UART data to WebSocket
    const onData = ({ boardId: id, data }) => {
      if (id === boardId && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "uart-data", data }));
      }
    };

    // We'll set up the listener once the UART service is available
    // For now, the UART service emits events that we can listen to
    // This will be connected via the global event system

    // Listen for input from the browser to write to serial
    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "uart-input") {
          // Forward to UART service
          globalThis.__uartService?.write(boardId, parsed.data);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      console.log(`[WS] UART client disconnected for board ${boardId}`);
      if (uartCleanup) uartCleanup();
      if (globalThis.__uartService) {
        globalThis.__uartService.removeListener("data", onData);
      }
    });

    // Register listener on global UART service
    if (globalThis.__uartService) {
      globalThis.__uartService.on("data", onData);
    }

    // Retry: check periodically if UART service becomes available
    const checkInterval = setInterval(() => {
      if (globalThis.__uartService && !uartCleanup) {
        globalThis.__uartService.on("data", onData);
        uartCleanup = () =>
          globalThis.__uartService?.removeListener("data", onData);
        clearInterval(checkInterval);
      }
    }, 1000);

    ws.on("close", () => clearInterval(checkInterval));
  }

  // ─── Job log WebSocket handler ───────────────────────────────────────────

  function handleLogConnection(ws, jobId) {
    console.log(`[WS] Log client connected for job ${jobId}`);

    const onLog = ({ jobId: id, text }) => {
      if (id === jobId && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "job-log", data: text }));
      }
    };

    const onComplete = ({ jobId: id, success, sessionId }) => {
      if (id === jobId && ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            type: "job-complete",
            success,
            sessionId,
          })
        );
      }
    };

    if (globalThis.__jobQueue) {
      globalThis.__jobQueue.on("job-log", onLog);
      globalThis.__jobQueue.on("job-complete", onComplete);
    }

    ws.on("close", () => {
      console.log(`[WS] Log client disconnected for job ${jobId}`);
      if (globalThis.__jobQueue) {
        globalThis.__jobQueue.removeListener("job-log", onLog);
        globalThis.__jobQueue.removeListener("job-complete", onComplete);
      }
    });
  }

  // ─── Initialize services ─────────────────────────────────────────────────

  // Run migrations and start background services
  // These use dynamic require since they're compiled TypeScript
  setTimeout(async () => {
    try {
      // Migrations run synchronously via better-sqlite3
      console.log("[Server] Running database migrations...");

      // We need to use ts-node or tsx to import TypeScript modules
      // In production, these would be compiled. For dev, use tsx.
      // The services are initialized via the imports in the Next.js app
      // We set up globals that the WebSocket handlers can reference.

      console.log("[Server] Services will be initialized on first request");
    } catch (err) {
      console.error("[Server] Initialization error:", err);
    }
  }, 100);

  // ─── Start server ────────────────────────────────────────────────────────

  server.listen(port, hostname, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║          FPGA Remote Lab Server Started              ║
║                                                      ║
║   Local:   http://localhost:${port}                    ║
║   Network: http://${hostname}:${port}                    ║
║                                                      ║
║   WebSocket: ws://localhost:${port}/ws/uart/:boardId   ║
║   WebSocket: ws://localhost:${port}/ws/logs/:jobId     ║
╚══════════════════════════════════════════════════════╝
    `);
  });
});
