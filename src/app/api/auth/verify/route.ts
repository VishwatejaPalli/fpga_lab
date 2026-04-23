import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const record = db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .get();

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date(record.expiresAt) < new Date()) {
      db.delete(verificationTokens)
        .where(eq(verificationTokens.id, record.id))
        .run();
      return NextResponse.json(
        { error: "Verification link has expired" },
        { status: 400 }
      );
    }

    // Mark user as verified
    db.update(users)
      .set({ verified: true })
      .where(eq(users.id, record.userId))
      .run();

    // Delete token
    db.delete(verificationTokens)
      .where(eq(verificationTokens.id, record.id))
      .run();

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("[Auth] Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
