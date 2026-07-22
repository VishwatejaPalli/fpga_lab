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
const http = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Pool } = require("pg");
const path = require("path");

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fpga_lab";
const pool = new Pool({
  connectionString,
});

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((res, c) => {
    const parts = c.trim().split("=");
    if (parts.length < 2) return res;
    const key = parts[0];
    const val = parts.slice(1).join("=");
    try {
      res[key] = decodeURIComponent(val);
    } catch {
      res[key] = val;
    }
    return res;
  }, {});
}

function authenticateRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.token;
  if (!token) return null;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function verifyUserSession(userId, boardId) {
  try {
    const res = await pool.query(
      "SELECT id FROM hw_sessions WHERE board_id = $1 AND user_id = $2 AND status = 'active'",
      [boardId, userId]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error("Error verifying user session:", err.message);
    return false;
  }
}

async function verifyUserJob(user, jobId) {
  try {
    if (user.role === "admin" || user.role === "researcher") return true;
    const res = await pool.query("SELECT user_id FROM jobs WHERE id = $1", [jobId]);
    const job = res.rows[0];
    return job && job.user_id === user.userId;
  } catch (err) {
    console.error("Error verifying user job:", err.message);
    return false;
  }
}

async function getBoardIp(boardId) {
  try {
    const res = await pool.query("SELECT ip_address FROM boards WHERE id = $1", [boardId]);
    const board = res.rows[0];
    return board ? board.ip_address : null;
  } catch (err) {
    console.error("Error getting board IP:", err.message);
    return null;
  }
}

const JUPYTER_PATHS = [
  "/static/",
  "/api/kernels/",
  "/api/sessions",
  "/api/contents/",
  "/api/terminals/",
  "/kernelspecs/",
  "/nbextensions/",
  "/custom/",
  "/files/",
  "/notebooks/",
  "/terminals/",
  "/tree",
  "/login",
  "/logout"
];

function shouldProxyHttp(req) {
  const { pathname } = parse(req.url, true);
  if (!pathname) return false;

  if (pathname.startsWith("/pynq-proxy/")) {
    return true;
  }

  const cookies = parseCookies(req.headers.cookie);
  const boardId = cookies.pynq_board_id;
  if (!boardId) return false;

  return JUPYTER_PATHS.some(p => pathname.startsWith(p));
}

async function handleProxyHttp(req, res) {
  const user = authenticateRequest(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  let boardId = null;
  let targetPath = "";

  const { pathname } = parse(req.url, true);
  if (pathname.startsWith("/pynq-proxy/")) {
    const match = req.url.match(/^\/pynq-proxy\/([^\/?#]+)(.*)$/);
    if (match) {
      boardId = match[1];
      targetPath = match[2] || "/";
    }
  } else {
    const cookies = parseCookies(req.headers.cookie);
    boardId = cookies.pynq_board_id;
    targetPath = req.url;
  }

  if (!boardId || !(await verifyUserSession(user.userId, boardId))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden - Active session required");
    return;
  }

  const ip = await getBoardIp(boardId);
  if (!ip) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway - Board offline");
    return;
  }

  const headers = { ...req.headers };
  delete headers.host;

  const proxyReq = http.request({
    host: ip,
    port: 9090,
    path: targetPath,
    method: req.method,
    headers: {
      ...headers,
      host: `${ip}:9090`
    }
  }, (proxyRes) => {
    if (pathname.startsWith("/pynq-proxy/")) {
      res.setHeader("Set-Cookie", `pynq_board_id=${boardId}; Path=/; HttpOnly; SameSite=Lax`);
    }
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("[Proxy HTTP Error]:", err.message);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway - Jupyter unreachable");
  });

  req.pipe(proxyReq);
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    if (shouldProxyHttp(req)) {
      await handleProxyHttp(req, res);
    } else {
      handle(req, res, parsedUrl);
    }
  });

  const activeSockets = new Map();

  function registerSocket(boardId, ws) {
    if (!boardId) return;
    if (!activeSockets.has(boardId)) {
      activeSockets.set(boardId, new Set());
    }
    activeSockets.get(boardId).add(ws);

    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

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

  // Periodic session checker (every 5 seconds) to disconnect inactive sessions
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
            console.log(`[Sessions] Force-closing ${sockets.size} active WebSocket(s) for board ${boardId} due to session expiration`);
            for (const ws of sockets) {
              try {
                ws.send(JSON.stringify({ type: "session-expired", message: "Session expired or ended." }));
                ws.close();
              } catch (e) { }
              sockets.delete(ws);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Sessions] Error checking active WebSocket sessions:", err.message);
    }
  }, 5000);

  // ─── WebSocket servers ──────────────────────────────────────────────────

  const uartWss = new WebSocketServer({ noServer: true });
  const logsWss = new WebSocketServer({ noServer: true });
  const cameraWss = new WebSocketServer({ noServer: true });
  const sshWss = new WebSocketServer({ noServer: true });

  // Route WebSocket upgrades by path
  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = parse(req.url, true);

    // Parse cookies manually
    const cookies = req.headers.cookie
      ? req.headers.cookie.split(";").reduce((res, c) => {
        const [key, val] = c.trim().split("=").map(decodeURIComponent);
        try {
          return Object.assign(res, { [key]: JSON.parse(val) });
        } catch (e) {
          return Object.assign(res, { [key]: val });
        }
      }, {})
      : {};

    const token = cookies.token;

    // Basic JWT verification (API key verification skipped here for brevity, 
    // but JWT secures the web UI clients)
    let user = null;
    if (token) {
      try {
        const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
        user = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        // Invalid token
      }
    }

    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    let isJupyterWs = false;
    let targetBoardId = null;
    let jupyterTargetPath = null;

    if (pathname) {
      if (pathname.startsWith("/pynq-proxy/")) {
        const match = pathname.match(/^\/pynq-proxy\/([^\/]+)(.*)$/);
        if (match) {
          const boardId = match[1];
          const subPath = match[2] || "/";
          if (subPath.startsWith("/api/kernels/") || subPath.startsWith("/terminals/websocket/")) {
            isJupyterWs = true;
            targetBoardId = boardId;
            jupyterTargetPath = subPath;
          }
        }
      } else if (pathname.startsWith("/api/kernels/") || pathname.startsWith("/terminals/websocket/")) {
        // Fallback check cookie if not prefixed (absolute path ws request)
        if (cookies.pynq_board_id) {
          isJupyterWs = true;
          targetBoardId = cookies.pynq_board_id;
          jupyterTargetPath = pathname;
        }
      }
    }

    if (isJupyterWs && targetBoardId) {
      if (!(await verifyUserSession(user.userId, targetBoardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const ip = await getBoardIp(targetBoardId);
      if (!ip) {
        socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        socket.destroy();
        return;
      }

      const queryStr = parse(req.url).search || "";
      const targetUrl = `ws://${ip}:9090${jupyterTargetPath}${queryStr}`;

      const jupyterWss = new WebSocketServer({ noServer: true });
      jupyterWss.handleUpgrade(req, socket, head, (ws) => {
        registerSocket(targetBoardId, ws);
        const targetWs = new WebSocket(targetUrl);

        ws.on("message", (data) => {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(data);
          }
        });

        targetWs.on("message", (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        ws.on("close", () => {
          targetWs.close();
        });

        targetWs.on("close", () => {
          ws.close();
        });

        ws.on("error", () => {
          targetWs.close();
        });

        targetWs.on("error", () => {
          ws.close();
        });
      });
      return;
    }

    if (pathname && pathname.startsWith("/ws/uart/")) {
      const boardId = pathname.split("/ws/uart/")[1];
      if (!(await verifyUserSession(user.userId, boardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      uartWss.handleUpgrade(req, socket, head, (ws) => {
        uartWss.emit("connection", ws, req, boardId, user);
      });
    } else if (pathname && pathname.startsWith("/ws/logs/")) {
      const jobId = pathname.split("/ws/logs/")[1];
      if (!(await verifyUserJob(user, jobId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      logsWss.handleUpgrade(req, socket, head, (ws) => {
        logsWss.emit("connection", ws, req, jobId, user);
      });
    } else if (pathname && pathname.startsWith("/ws/camera/")) {
      const boardId = pathname.split("/ws/camera/")[1];
      if (!(await verifyUserSession(user.userId, boardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      cameraWss.handleUpgrade(req, socket, head, (ws) => {
        cameraWss.emit("connection", ws, req, boardId, user);
      });
    } else if (pathname && pathname.startsWith("/ws/ssh/")) {
      const boardId = pathname.split("/ws/ssh/")[1];
      if (!(await verifyUserSession(user.userId, boardId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      sshWss.handleUpgrade(req, socket, head, (ws) => {
        sshWss.emit("connection", ws, req, boardId, user);
      });
    } else {
      socket.destroy();
    }
  });

  // ─── UART WebSocket handler ─────────────────────────────────────────────

  uartWss.on("connection", (ws, _req, boardId) => {
    console.log(`[WS] UART client connected for board ${boardId}`);
    registerSocket(boardId, ws);

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

  // ─── SSH WebSocket handler ──────────────────────────────────────────────

  sshWss.on("connection", (ws, _req, boardId) => {
    console.log(`[WS] SSH client connected for board ${boardId}`);
    registerSocket(boardId, ws);

    const sshService = globalThis.__sshService;

    if (sshService) {
      sshService.open(boardId).catch((err) => {
        console.warn(`[WS] Could not open SSH for ${boardId}:`, err.message);
      });

      const onData = ({ boardId: bId, data }) => {
        if (bId === boardId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ssh-data", data }));
        }
      };
      sshService.on("data", onData);

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "ssh-input" && msg.data) {
            sshService.write(boardId, msg.data);
          } else if (msg.type === "ssh-resize" && msg.cols && msg.rows) {
            sshService.resize(boardId, msg.cols, msg.rows);
          }
        } catch {
          sshService.write(boardId, raw.toString());
        }
      });

      ws.on("close", () => {
        sshService.removeListener("data", onData);
        console.log(`[WS] SSH client disconnected for board ${boardId}`);
      });
    } else {
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
    registerSocket(boardId, ws);

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

  // ─── Graceful Shutdown ──────────────────────────────────────────────────

  const gracefulShutdown = () => {
    console.log("\n[Server] Shutting down gracefully...");
    clearInterval(sessionCheckInterval);

    // Clean up ffmpeg processes
    if (globalThis.__cameraService) {
      try {
        globalThis.__cameraService.stopAll();
      } catch (e) {
        console.error("[Server] Error stopping camera streams:", e);
      }
    }

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
