import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { withErrorHandler } from "@/lib/api-utils";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "FPGA Lab <noreply@lab.org>",
      to: user.email,
      subject: "Reset your FPGA Lab password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">FPGA Remote Lab</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #6b7280; font-size: 14px;">
            Or copy this link: ${resetUrl}
          </p>
          <p style="color: #6b7280; font-size: 12px;">
            This link is valid for 1 hour. If you did not request this, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.warn("\n=== PASSWORD RESET LINK ===");
    console.warn(`Could not send reset email. Use this link to reset:`);
    console.warn(`${resetUrl}`);
    console.warn("============================\n");
  }

  return NextResponse.json({ message: "If the email exists, a reset link has been sent." });
});
