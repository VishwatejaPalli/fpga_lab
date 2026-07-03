import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import "@/lib/init";
import { hashPassword } from "@/lib/auth/password";
import {
  generateToken,
  sendVerificationEmail,
} from "@/lib/auth/email";
import { z } from "zod";
import { rateLimit, withErrorHandler } from "@/lib/api-utils";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["student", "researcher"]).default("student"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  
  if (!rateLimit(`signup_${ip}`, 3, 60 * 60 * 1000)) { // 3 signups per hour per IP
    return NextResponse.json(
      { error: "Too many signups from this IP. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;

    // Check if user exists
    const existing = db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Create user
    const userId = uuid();
    const passwordHash = await hashPassword(password);
    db.insert(users)
      .values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
        verified: false,
      })
      .run();

    // Create verification token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.insert(verificationTokens)
      .values({ id: uuid(), userId, token, expiresAt })
      .run();

    // Send verification email (don't fail signup if email fails)
    try {
      await sendVerificationEmail(email, token);
    } catch (e) {
      console.error("[Auth] Failed to send verification email:", e);
    }

    return NextResponse.json(
      {
        message:
          "Account created. Please check your email to verify your account.",
      },
      { status: 201 }
    );
});
