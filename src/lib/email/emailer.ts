import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  fallbackUsed: boolean;
  previewUrl?: string;
  error?: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
      },
    });
  }

  return null;
}

export async function sendMail(options: SendMailOptions): Promise<EmailResult> {
  const from = process.env.SMTP_FROM || "FPGA Remote Lab <noreply@fpgalab.org>";
  const transporter = getTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>?/gm, ""),
      });

      console.log(`[Emailer] Sent email successfully to ${options.to}. MessageId: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        fallbackUsed: false,
      };
    } catch (err: any) {
      console.warn(`[Emailer] SMTP sendMail failed for ${options.to}:`, err.message);
    }
  }

  // Local / Dev Fallback Execution Mode
  console.warn(`\n========================================================`);
  console.warn(`[Emailer] DEV FALLBACK LOG (SMTP unconfigured or unavailable)`);
  console.warn(`To: ${options.to}`);
  console.warn(`Subject: ${options.subject}`);
  console.warn(`========================================================\n`);

  // Write snapshot HTML preview file into local .sent_emails folder
  try {
    const sentDir = path.resolve(process.cwd(), ".sent_emails");
    if (!fs.existsSync(sentDir)) {
      fs.mkdirSync(sentDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `email_${timestamp}_${options.to.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
    const filePath = path.join(sentDir, filename);
    
    fs.writeFileSync(filePath, options.html, "utf-8");
    console.log(`[Emailer] Saved email preview snapshot to: ${filePath}`);
  } catch (fsErr: any) {
    console.warn(`[Emailer] Failed saving local email preview:`, fsErr.message);
  }

  return {
    success: true,
    fallbackUsed: true,
  };
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName?: string
): Promise<EmailResult> {
  const subject = "Reset your FPGA Remote Lab password";
  const displayName = userName || to.split("@")[0];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your FPGA Remote Lab password</title>
</head>
<body style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; color: #f8fafc;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <!-- Header Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%); padding: 28px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; tracking-wide: 1px;">FPGA Remote Lab</h1>
        <p style="color: #e0f2fe; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Cloud IDE & Distributed Hardware Platform</p>
      </td>
    </tr>

    <!-- Email Body -->
    <tr>
      <td style="padding: 32px;">
        <h2 style="color: #f8fafc; font-size: 18px; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Hello <strong style="color: #e2e8f0;">${displayName}</strong>,
        </p>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          We received a request to reset your password for your FPGA Remote Lab account. Click the button below to choose a new password:
        </p>

        <!-- CTA Button -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background: #2563eb;">
              <a href="${resetUrl}" target="_blank" style="font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; border: 1px solid #3b82f6; display: inline-block;">
                Reset My Password →
              </a>
            </td>
          </tr>
        </table>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px;">
          If the button does not work, copy and paste this link into your web browser:<br>
          <a href="${resetUrl}" style="color: #38bdf8; text-decoration: underline; word-break: break-all;">${resetUrl}</a>
        </p>

        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
          This link will expire in <strong>60 minutes</strong>. If you did not request a password reset, please ignore this email.
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

  return sendMail({
    to,
    subject,
    html,
  });
}
