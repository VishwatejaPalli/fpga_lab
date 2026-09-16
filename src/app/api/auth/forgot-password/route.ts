import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { withErrorHandler } from "@/lib/api-utils";
import { sendPasswordResetEmail } from "@/lib/email/emailer";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  // If user does not exist, return a generic success message to prevent user enumeration
  if (!user) {
    return NextResponse.json({ message: "If the email exists, a reset link has been sent." });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Clear any existing reset tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

  // Store new reset token
  await db.insert(passwordResetTokens)
    .values({
      id: uuid(),
      userId: user.id,
      tokenHash,
      expiresAt,
    });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}`;

  const emailResult = await sendPasswordResetEmail(user.email, resetUrl, user.name || user.email);

  const isDev = process.env.NODE_ENV !== "production";

  return NextResponse.json({
    message: "If the email exists, a reset link has been sent.",
    devResetUrl: isDev && emailResult.fallbackUsed ? resetUrl : undefined,
  });
});
