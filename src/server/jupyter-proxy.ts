import http from "http";
import { parse } from "url";
import { authenticateRequest, verifyUserSession } from "./websocket-auth";
import { PynqConnectionManager } from "@/lib/hardware/connection-manager";

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

export function shouldProxyHttp(req: http.IncomingMessage): boolean {
  const { pathname } = parse(req.url || "", true);
  if (!pathname) return false;

  if (pathname.startsWith("/pynq-proxy/")) {
    return true;
  }

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/pynq_board_id=([^;]+)/);
  const boardId = match ? match[1] : null;
  if (!boardId) return false;

  return JUPYTER_PATHS.some((p) => pathname.startsWith(p));
}

export async function handleProxyHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const user = authenticateRequest(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  let boardId: string | null = null;
  let targetPath = "";

  const { pathname } = parse(req.url || "", true);
  if (pathname && pathname.startsWith("/pynq-proxy/")) {
    const match = (req.url || "").match(/^\/pynq-proxy\/([^\/?#]+)(.*)$/);
    if (match) {
      boardId = match[1];
      targetPath = match[2] || "/";
    }
  } else {
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(/pynq_board_id=([^;]+)/);
    boardId = match ? match[1] : null;
    targetPath = req.url || "/";
  }

  if (!boardId || !(await verifyUserSession(user, boardId))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden - Active session required");
    return;
  }

  const ip = await PynqConnectionManager.getBoardIp(boardId);
  if (!ip) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway - Board offline");
    return;
  }

  const headers = { ...req.headers };
  delete headers.host;

  const proxyReq = http.request(
    {
      host: ip,
      port: 9090,
      path: targetPath,
      method: req.method,
      headers: {
        ...headers,
        host: `${ip}:9090`,
      },
    },
    (proxyRes) => {
      if (pathname && pathname.startsWith("/pynq-proxy/")) {
        res.setHeader("Set-Cookie", `pynq_board_id=${boardId}; Path=/; HttpOnly; SameSite=Lax`);
      }
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (err) => {
    console.error("[Proxy HTTP Error]:", err.message);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Bad Gateway - Jupyter server unreachable on board ${boardId} (${err.message})`);
  });

  req.pipe(proxyReq);
}
