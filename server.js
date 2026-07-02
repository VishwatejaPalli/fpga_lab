/**
 * Custom server for FPGA Remote Lab.
 *
 * Wraps the Next.js request handler with a raw HTTP server so we can
 * handle WebSocket upgrades for:
 *   /ws/uart/:boardId   — bidirectional serial console
 *   /ws/logs/:jobId     — real-time programming log stream
 *   /ws/camera/:boardId — MJPEG frame stream
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ─── WebSocket servers ──────────────────────────────────────────────────

  const uartWss = new WebSocketServer({ noServer: true });
  const logsWss = new WebSocketServer({ noServer: true });
  const cameraWss = new WebSocketServer({ noServer: true });

  // Route WebSocket upgrades by path
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true);

    if (pathname && pathname.startsWith("/ws/uart/")) {
      uartWss.handleUpgrade(req, socket, head, (ws) => {
        const boardId = pathname.split("/ws/uart/")[1];
        uartWss.emit("connection", ws, req, boardId);
      });
    } else if (pathname && pathname.startsWith("/ws/logs/")) {
      logsWss.handleUpgrade(req, socket, head, (ws) => {
        const jobId = pathname.split("/ws/logs/")[1];
        logsWss.emit("connection", ws, req, jobId);
      });
    } else if (pathname && pathname.startsWith("/ws/camera/")) {
      cameraWss.handleUpgrade(req, socket, head, (ws) => {
        const boardId = pathname.split("/ws/camera/")[1];
        cameraWss.emit("connection", ws, req, boardId);
      });
    } else {
      socket.destroy();
    }
  });

  // ─── UART WebSocket handler ─────────────────────────────────────────────

  uartWss.on("connection", (ws, _req, boardId) => {
    console.log(`[WS] UART client connected for board ${boardId}`);

    // Try to get the UART service from the global scope
    const uartService = globalThis.__uartService;

    if (uartService) {
      // Open the serial port if not already open
      uartService.open(boardId).catch((err) => {
        console.warn(`[WS] Could not open UART for ${boardId}:`, err.message);
      });

      // Forward serial data to the WebSocket client
      const onData = ({ boardId: bId, data }) => {
        if (bId === boardId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "uart-data", data }));
        }
      };
      uartService.on("data", onData);

      // Forward client input to the serial port
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "uart-input" && msg.data) {
            uartService.write(boardId, msg.data);
          }
        } catch {
          // Not JSON — send raw as serial data
          uartService.write(boardId, raw.toString());
        }
      });

      ws.on("close", () => {
        uartService.removeListener("data", onData);
        console.log(`[WS] UART client disconnected for board ${boardId}`);
      });
    } else {
      // No UART service available — close after a brief delay
      // (client-side terminal will fall back to demo mode on close)
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 500);
    }
  });

  // ─── Job Logs WebSocket handler ─────────────────────────────────────────

  logsWss.on("connection", (ws, _req, jobId) => {
    console.log(`[WS] Logs client connected for job ${jobId}`);

    const jobQueue = globalThis.__jobQueue;

    if (jobQueue) {
      const onLog = (data) => {
        if (data.jobId === jobId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "job-log", data: data.text }));
        }
      };

      const onComplete = (data) => {
        if (data.jobId === jobId && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "job-complete",
              success: data.success,
              sessionId: data.sessionId || null,
            })
          );
        }
      };

      jobQueue.on("job-log", onLog);
      jobQueue.on("job-complete", onComplete);

      ws.on("close", () => {
        jobQueue.removeListener("job-log", onLog);
        jobQueue.removeListener("job-complete", onComplete);
        console.log(`[WS] Logs client disconnected for job ${jobId}`);
      });
    } else {
      ws.on("close", () => {
        console.log(`[WS] Logs client disconnected for job ${jobId}`);
      });
    }
  });

  // ─── Camera WebSocket handler ───────────────────────────────────────────

  cameraWss.on("connection", (ws, _req, boardId) => {
    console.log(`[WS] Camera client connected for board ${boardId}`);

    const cameraService = globalThis.__cameraService;
    let unsubscribe;

    if (cameraService) {
      // Forward camera stream binary JPEG frames to the client
      unsubscribe = cameraService.subscribe(boardId, (frame) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(frame, { binary: true });
        }
      });
    } else {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 500);
    }

    ws.on("close", () => {
      if (unsubscribe) {
        unsubscribe();
      }
      console.log(`[WS] Camera client disconnected for board ${boardId}`);
    });
  });

  // ─── Start server ──────────────────────────────────────────────────────

  server.listen(port, hostname, () => {
    console.log(`\n  ⚡ FPGA Remote Lab running at http://${hostname}:${port}\n`);
  });
});
