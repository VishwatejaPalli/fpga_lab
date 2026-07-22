import { NextRequest, NextResponse } from "next/server";

// Verify signature using the Web Crypto API (supported in Edge/Next.js middleware)
async function verifySignature(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [header, payload, signature] = parts;
  const message = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["verify"]
    );

    // Decode base64url signature to Uint8Array
    let base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const sigBuf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBuf[i] = binary.charCodeAt(i);
    }

    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuf,
      messageData
    );
  } catch (err) {
    console.error("[Middleware] Web Crypto signature verification failed:", err);
    return false;
  }
}

// Native decode base64url payload to prevent node dependencies in Edge middleware
function decodeJwtPayload(
  token: string
): { userId: string; role: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const jsonStr = decodeURIComponent(
      atob(base64)
         .split("")
         .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
         .join("")
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. CSRF Protection for state-mutating requests (POST, PUT, DELETE, PATCH)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const hasAuthHeader = req.headers.has("authorization");

    // Retrieve allowed hosts (request host + public app URL proxy host + x-forwarded-host)
    const allowedHosts = [req.nextUrl.host];
    const hostHeader = req.headers.get("host");
    if (hostHeader) allowedHosts.push(hostHeader);
    const forwardedHost = req.headers.get("x-forwarded-host");
    if (forwardedHost) allowedHosts.push(forwardedHost);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      try {
        allowedHosts.push(new URL(appUrl).host);
      } catch {}
    }

    // CSRF is only a threat for cookie-authenticated requests. API requests using Bearer token/auth header are safe.
    if (!hasAuthHeader) {
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (!allowedHosts.includes(originUrl.host) && !allowedHosts.includes(originUrl.hostname)) {
            return NextResponse.json({ error: "CSRF verification failed: Invalid origin" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: "CSRF verification failed: Malformed origin" }, { status: 403 });
        }
      } else if (referer) {
        try {
          const refererUrl = new URL(referer);
          if (!allowedHosts.includes(refererUrl.host) && !allowedHosts.includes(refererUrl.hostname)) {
            return NextResponse.json({ error: "CSRF verification failed: Invalid referer" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: "CSRF verification failed: Malformed referer" }, { status: 403 });
        }
      } else {
        // Block API mutations missing both origin and referer headers
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "CSRF verification failed: Missing origin and referer" }, { status: 403 });
        }
      }
    }
  }

  // Public paths — no auth required.
  const publicPaths = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/verify",
    "/api/auth/signup",
    "/api/auth/login",
    "/api/auth/verify",
    "/api/auth/logout",
  ];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Static files and Next.js internals.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth token.
  const token = req.cookies.get("token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Full signature verification check (Edge compatible)
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const isSignatureValid = await verifySignature(token, secret);

  if (!isSignatureValid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token signature" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/auth/login", req.url));
    response.cookies.set("token", "", { maxAge: 0 });
    return response;
  }

  // Decode JWT (lightweight check).
  const payload = decodeJwtPayload(token);

  if (!payload || !payload.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Check expiry.
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Token expired" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/login", req.url));

    response.cookies.set("token", "", { maxAge: 0 });
    return response;
  }

  // Admin routes check.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (payload.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Researcher routes check (researcher + admin allowed).
  if (
    pathname.startsWith("/researcher") ||
    pathname.startsWith("/api/researcher")
  ) {
    if (payload.role !== "researcher" && payload.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
