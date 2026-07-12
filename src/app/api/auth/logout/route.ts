import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { refreshTokens } from "@/lib/db/schema";
import crypto from "crypto";
import { getSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const rawRefreshToken = req.cookies.get("refreshToken")?.value;
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

  if (session) {
    logAuditEvent({
      userId: session.userId,
      action: "logout",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || null,
    });
  }

  if (rawRefreshToken) {
    try {
      const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
      db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).run();
    } catch (err) {
      console.error("[Logout] Failed to revoke refresh token:", err);
    }
  }

  const response = NextResponse.json({ message: "Logged out" });
  
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  response.cookies.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  // Also clear the proxy cookie
  response.cookies.set("pynq_board_id", "", {
    maxAge: 0,
    path: "/",
  });

  return response;
}
