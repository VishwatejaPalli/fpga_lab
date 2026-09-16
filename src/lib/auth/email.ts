import crypto from "crypto";
import { sendMail } from "@/lib/email/emailer";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/auth/verify?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your FPGA Lab account</title>
</head>
<body style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; color: #f8fafc;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <!-- Header Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%); padding: 28px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">FPGA Remote Lab</h1>
        <p style="color: #e0f2fe; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Cloud IDE & Distributed Hardware Platform</p>
      </td>
    </tr>

    <!-- Email Body -->
    <tr>
      <td style="padding: 32px;">
        <h2 style="color: #f8fafc; font-size: 18px; margin-top: 0;">Verify Your Email Address</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Welcome to FPGA Remote Lab! Click the button below to verify your email address and activate your account:
        </p>

        <!-- CTA Button -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background: #2563eb;">
              <a href="${verifyUrl}" target="_blank" style="font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; border: 1px solid #3b82f6; display: inline-block;">
                Verify My Email →
              </a>
            </td>
          </tr>
        </table>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px;">
          If the button does not work, copy and paste this link into your web browser:<br>
          <a href="${verifyUrl}" style="color: #38bdf8; text-decoration: underline; word-break: break-all;">${verifyUrl}</a>
        </p>

        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
          This link will expire in <strong>24 hours</strong>. If you did not create an account, please ignore this email.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #0f172a; padding: 16px 32px; text-align: center; border-top: 1px solid #334155;">
        <p style="color: #475569; font-size: 11px; margin: 0;">
          © ${new Date().getFullYear()} FPGA Remote Lab Infrastructure. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const result = await sendMail({
    to,
    subject: "Verify your FPGA Lab account",
    html,
  });

  if (!result.success) {
    throw new Error(`Failed to send verification email to ${to}`);
  }
}

export function isAllowedDomain(email: string): boolean {
  const envValue = process.env.ALLOWED_EMAIL_DOMAINS;
  if (!envValue || envValue === "*" || envValue.trim() === "") {
    return true;
  }
  const allowedDomains = envValue
    .split(",")
    .map((d) => d.trim().toLowerCase());
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && allowedDomains.includes(domain);
}
