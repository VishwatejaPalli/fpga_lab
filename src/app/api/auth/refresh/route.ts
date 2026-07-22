import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/lib/db";
import { users, refreshTokens } from "@/lib/db/schema";
import { signToken } from "@/lib/auth/jwt";
import { withErrorHandler } from "@/lib/api-utils";
import { v4 as uuid } from "uuid";
import crypto from "crypto";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rawRefreshToken = req.cookies.get("refreshToken")?.value;

  if (!rawRefreshToken) {
    return NextResponse.json({ error: "Refresh token missing" }, { status: 401 });
  }

  const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

  // Lookup the refresh token
  const [dbToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!dbToken) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  // Check if expired
  if (new Date(dbToken.expiresAt) < new Date()) {
    // Delete expired token from DB
    await db.delete(refreshTokens).where(eq(refreshTokens.id, dbToken.id));
    
    const response = NextResponse.json({ error: "Refresh token expired" }, { status: 401 });
    response.cookies.set("token", "", { maxAge: 0 });
    response.cookies.set("refreshToken", "", { maxAge: 0 });
    return response;
  }

  // Fetch the user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, dbToken.userId));

  if (!user || user.status === "suspended") {
    // Revoke token if user doesn't exist or is suspended
    await db.delete(refreshTokens).where(eq(refreshTokens.id, dbToken.id));
    
    const response = NextResponse.json({ error: "User is suspended or deleted" }, { status: 401 });
    response.cookies.set("token", "", { maxAge: 0 });
    response.cookies.set("refreshToken", "", { maxAge: 0 });
    return response;
  }

  // Generate new tokens
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    version: user.tokenVersion || 1,
  });

  const newRawRefreshToken = crypto.randomBytes(40).toString("hex");
  const newHash = crypto.createHash("sha256").update(newRawRefreshToken).digest("hex");
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Rotate the refresh token by replacing the old one
  await db.delete(refreshTokens).where(eq(refreshTokens.id, dbToken.id));
  
  await db.insert(refreshTokens)
    .values({
      id: uuid(),
      userId: user.id,
      tokenHash: newHash,
      expiresAt: newExpiresAt,
      userAgent: req.headers.get("user-agent") || null,
      ipAddress: ip,
    });

  const response = NextResponse.json({
    message: "Token refreshed successfully",
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });

  // Set cookies
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  });

  response.cookies.set("refreshToken", newRawRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return response;
});
