import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users, refreshTokens } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { rateLimit, withErrorHandler } from "@/lib/api-utils";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import "@/lib/init";
import { logAuditEvent } from "@/lib/audit";

import { checkRateLimit, clearRateLimit } from "@/lib/auth/rate-limiter";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  // Check user lock status
  if (user && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Account is temporarily locked. Try again in ${minutesLeft} minutes.` },
      { status: 403 }
    );
  }

  // Persistent SQLite-backed rate limiting per email + IP
  const limit = checkRateLimit({
    email: email.toLowerCase(),
    ipAddress: ip,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 mins
  });

  if (!limit.allowed) {
    if (user) {
      // Lock account for 15 minutes in DB
      db.update(users)
        .set({ lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
        .where(eq(users.id, user.id))
        .run();
        
      logAuditEvent({
        userId: user.id,
        action: "account_lockout",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || null,
        metadata: { reason: "Too many failed attempts" },
      });
    }
    return NextResponse.json(
      { error: "Too many failed login attempts. Your account is locked for 15 minutes." },
      { status: 429 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  if (!user.verified) {
    return NextResponse.json(
      { error: "Please verify your email before logging in" },
      { status: 403 }
    );
  }

  if (user.status === "suspended") {
    return NextResponse.json(
      { error: "Your account is suspended. Contact administrator." },
      { status: 403 }
    );
  }

  // Success: Clear login attempts rate limit and remove lockout if present
  clearRateLimit(email.toLowerCase(), ip);
  if (user.lockedUntil) {
    db.update(users)
      .set({ lockedUntil: null })
      .where(eq(users.id, user.id))
      .run();
  }

    db.update(users)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run();

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      version: user.tokenVersion || 1,
    });

    // Generate opaque refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Store in DB
    db.insert(refreshTokens)
      .values({
        id: uuid(),
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: req.headers.get("user-agent") || null,
        ipAddress: ip,
      })
      .run();

    const response = NextResponse.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    // Set 15-minute access token cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    // Set 7-day refresh token cookie
    response.cookies.set("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    logAuditEvent({
      userId: user.id,
      action: "login",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || null,
    });

    return response;
});
