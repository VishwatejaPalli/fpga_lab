import nodemailer from "nodemailer";
import crypto from "crypto";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/auth/verify?token=${token}`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "FPGA Lab <noreply@lab.org>",
      to,
      subject: "Verify your FPGA Lab account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">FPGA Remote Lab</h2>
          <p>Click the button below to verify your email address:</p>
          <a href="${verifyUrl}" 
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Verify Email
          </a>
          <p style="color: #6b7280; font-size: 14px;">
            Or copy this link: ${verifyUrl}
          </p>
          <p style="color: #6b7280; font-size: 12px;">
            This link expires in 24 hours.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.warn("\n=== DEVELOPMENT VERIFICATION LINK ===");
    console.warn(`Could not send verification email. Use this link to verify:`);
    console.warn(`${verifyUrl}`);
    console.warn("======================================\n");
    throw error;
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
  return allowedDomains.includes(domain);
}
