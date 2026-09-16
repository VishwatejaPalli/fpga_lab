/**
 * Custom server for FPGA Remote Lab.
 *
 * Wraps Next.js request handler with an HTTP server supporting WebSocket upgrades for:
 *   /ws/uart/:boardId   — bidirectional serial console
 *   /ws/logs/:jobId     — real-time programming log stream
 *   /ws/camera/:boardId — MJPEG frame stream
 *   /ws/ssh/:boardId    — PTY SSH terminal
 *   /pynq-proxy/*       — reverse-proxied Jupyter Notebook HTTP & WebSocket channels
 */

require("tsx/cjs");

const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const http = require("http");
const https = require("https");
const fs = require("fs");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");
const { pool } = require("./src/lib/db");
const {
  authenticateRequest,
  verifyUserSession,
  verifyUserJob,
} = require("./src/server/websocket-auth.ts");
const { shouldProxyHttp, handleProxyHttp } = require("./src/server/jupyter-proxy.ts");
const {
  handleUartConnection,
  handleSshConnection,
  handleLogsConnection,
  handleCameraConnection,
} = require("./src/server/ws-handlers.ts");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const useHttps = sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const requestHandler = async (req, res) => {
    if (shouldProxyHttp(req)) {
      await handleProxyHttp(req, res);
    } else {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }
  };

  const server = useHttps
    ? https.createServer(
        {
          key: fs.readFileSync(sslKeyPath),
          cert: fs.readFileSync(sslCertPath),
        },
        requestHandler
      )
    : http.createServer(requestHandler);

  const activeSockets = new Map();

  // Validate boardId format: must be UUID or alphanumeric with hyphens/underscores (max 64 chars)
  function isValidBoardId(id) {
    if (!id || typeof id !== "string") return false;
    return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
  }

  function registerSocket(boardId, ws) {
    if (!boardId) return;
    if (!activeSockets.has(boardId)) {
      activeSockets.set(boardId, new Set());
    }
    activeSockets.get(boardId).add(ws);

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      const sockets = activeSockets.get(boardId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          activeSockets.delete(boardId);
        }
      }
    });
  }

  // Ping/pong heartbeat to detect and terminate dead WebSocket connections
  const heartbeatInterval = setInterval(() => {
    for (const [boardId, sockets] of activeSockets.entries()) {
      for (const ws of sockets) {
        if (ws.isAlive === false) {
          console.log(`[WS] Terminating dead socket for board ${boardId}`);
          sockets.delete(ws);
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
      if (sockets.size === 0) {
        activeSockets.delete(boardId);
      }
    }
  }, 30000);

  // Periodic session checker (every 5 seconds) to disconnect inactive WebSocket clients
  const sessionCheckInterval = setInterval(async () => {
    try {
      for (const boardId of activeSockets.keys()) {
        const res = await pool.query(
          "SELECT id FROM hw_sessions WHERE board_id = $1 AND status = 'active'",
          [boardId]
        );
        const session = res.rows[0];

        if (!session) {
          const sockets = activeSockets.get(boardId);
          if (sockets && sockets.size > 0) {
            console.log(
              `[Sessions] Force-closing ${sockets.size} active WebSocket(s) for board ${boardId} due to session expiration`
            );
            for (const ws of sockets) {
              try {
                ws.send(
                  JSON.stringify({
                    type: "session-expired",
                    message: "Session expired or ended.",
                  })
                );
                ws.close();
              } catch (e) {}
              sockets.delete(ws);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Sessions] Error checking active WebSocket sessions:", err.message);
    }
  }, 5000);

  // WebSocket Servers
  const uartWss = new WebSocketServer({ noServer: true });
  const logsWss = new WebSocketServer({ noServer: true });
  const cameraWss = new WebSocketServer({ noServer: true });
  const sshWss = new WebSocketServer({ noServer: true });
  const jupyterWss = new WebSocketServer({ noServer: true }); // Shared Jupyter WS proxy (avoids per-upgrade leak)

  // Handle WebSocket Upgrades
  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    const user = authenticateRequest(req);

    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Check for Jupyter WebSocket proxy upgrade (/pynq-proxy/... or /api/kernels/ or /terminals/websocket/)
    let isJupyterWs = false;
    let targetBoardId = null;
    let jupyterTargetPath = null;

    if (pathname) {
      if (pathname.startsWith("/pynq-proxy/")) {
        const match = pathname.match(/^\/pynq-proxy\/([^\/]+)(.*)$/);
        if (match) {
          const boardId = match[1];
          const subPath = match[2] || "/";
          if (
            subPath.startsWith("/api/kernels/") ||
            subPath.startsWith("/terminals/websocket/")
          ) {
            isJupyterWs = true;
            targetBoardId = boardId;
            jupyterTargetPath = subPath;
          }
        }
      }
    }

    if (isJupyterWs && targetBoardId) {
      if (!(await verifyUserSession(user, targetBoardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const mgr = globalThis.__connectionManager;
      const ip = mgr ? await mgr.getBoardIp(targetBoardId) : null;

      if (!ip) {
        socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        socket.destroy();
        return;
      }

      const queryStr = parse(req.url).search || "";
      const targetUrl = `ws://${ip}:9090${jupyterTargetPath}${queryStr}`;

      jupyterWss.handleUpgrade(req, socket, head, (ws) => {
        registerSocket(targetBoardId, ws);
        const targetWs = new WebSocket(targetUrl);

        ws.on("message", (data) => {
          if (targetWs.readyState === WebSocket.OPEN) targetWs.send(data);
        });
        targetWs.on("message", (data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });
        ws.on("close", () => targetWs.close());
        targetWs.on("close", () => ws.close());
        ws.on("error", () => targetWs.close());
        targetWs.on("error", () => ws.close());
      });
      return;
    }

    if (pathname && pathname.startsWith("/ws/uart/")) {
      const boardId = pathname.split("/ws/uart/")[1];
      if (!isValidBoardId(boardId) || !(await verifyUserSession(user, boardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      uartWss.handleUpgrade(req, socket, head, (ws) => {
        registerSocket(boardId, ws);
        handleUartConnection(ws, boardId);
      });
    } else if (pathname && pathname.startsWith("/ws/logs/")) {
      const jobId = pathname.split("/ws/logs/")[1];
      if (!isValidBoardId(jobId) || !(await verifyUserJob(user, jobId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      logsWss.handleUpgrade(req, socket, head, (ws) => {
        handleLogsConnection(ws, jobId);
      });
    } else if (pathname && pathname.startsWith("/ws/camera/")) {
      const boardId = pathname.split("/ws/camera/")[1];
      if (!isValidBoardId(boardId) || !(await verifyUserSession(user, boardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      cameraWss.handleUpgrade(req, socket, head, (ws) => {
        registerSocket(boardId, ws);
        handleCameraConnection(ws, boardId);
      });
    } else if (pathname && pathname.startsWith("/ws/ssh/")) {
      const boardId = pathname.split("/ws/ssh/")[1];
      if (!isValidBoardId(boardId) || !(await verifyUserSession(user, boardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      sshWss.handleUpgrade(req, socket, head, (ws) => {
        registerSocket(boardId, ws);
        handleSshConnection(ws, boardId);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, hostname, () => {
    const protocol = useHttps ? "https" : "http";
    console.log(`\n  ⚡ FPGA Remote Lab running at ${protocol}://${hostname}:${port}\n`);
  });

  const gracefulShutdown = () => {
    console.log("\n[Server] Shutting down gracefully...");
    clearInterval(sessionCheckInterval);
    clearInterval(heartbeatInterval);

    if (globalThis.__cameraService) {
      try {
        globalThis.__cameraService.stopAll();
      } catch (e) {
        console.error("[Server] Error stopping camera streams:", e);
      }
    }

    // Close PostgreSQL connection pool
    pool.end().catch((err) => {
      console.error("[Server] Error closing DB pool:", err);
    });

    server.close(() => {
      console.log("[Server] HTTP server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("[Server] Forcefully shutting down after 5s timeout...");
      process.exit(1);
    }, 5000).unref();
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
});
