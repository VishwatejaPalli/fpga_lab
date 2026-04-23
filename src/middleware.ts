import { NextRequest, NextResponse } from "next/server";

// Note: We can't use jsonwebtoken in Edge middleware (native crypto not available).
// Instead we do a lightweight JWT decode (base64) and verify structure.
// Full verification happens in the API route handlers.

function decodeJwtPayload(
  token: string
): { userId: string; role: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return payload;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — no auth required
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

  // Static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = req.cookies.get("token")?.value;

  if (!token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Decode JWT (lightweight check)
  const payload = decodeJwtPayload(token);

  if (!payload || !payload.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Check expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Token expired" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/login", req.url));

    response.cookies.set("token", "", { maxAge: 0 });
    return response;
  }

  // Admin routes check
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (payload.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Researcher routes check (researcher + admin allowed)
  if (pathname.startsWith("/researcher") || pathname.startsWith("/api/researcher")) {
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
     * Match all paths except static files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
