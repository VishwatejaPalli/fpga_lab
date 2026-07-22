import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users, passwordResetTokens, refreshTokens } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import crypto from "crypto";
import { withErrorHandler } from "@/lib/api-utils";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const [dbToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash));

  if (!dbToken) {
    return NextResponse.json({ error: "Invalid or expired password reset token" }, { status: 400 });
  }

  // Check if token expired
  if (new Date(dbToken.expiresAt) < new Date()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, dbToken.id));
    return NextResponse.json({ error: "Password reset token has expired" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, dbToken.userId));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  // Hash new password
  const passwordHash = await hashPassword(password);
  const newTokenVersion = (user.tokenVersion || 1) + 1;

  // Transactionally update password, increment token version, unlock account, delete tokens
  await db.update(users)
    .set({
      passwordHash,
      tokenVersion: newTokenVersion,
      lockedUntil: null,
    })
    .where(eq(users.id, user.id));

  // Invalidate all active sessions / refresh tokens of this user
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

  // Delete used reset token
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, dbToken.id));

  return NextResponse.json({ message: "Password has been reset successfully" });
});
