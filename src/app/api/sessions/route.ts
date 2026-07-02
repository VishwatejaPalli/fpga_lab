import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/lib/db";
import { hwSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { sessionEnforcer } from "@/lib/sessions/enforcer";

/**
 * GET - Get user's active session
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeSession = db
    .select()
    .from(hwSessions)
    .where(
      and(
        eq(hwSessions.userId, session.userId),
        eq(hwSessions.status, "active")
      )
    )
    .get();

  return NextResponse.json({ session: activeSession || null });
}

/**
 * DELETE - End active session
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json();

  const hwSession = db
    .select()
    .from(hwSessions)
    .where(eq(hwSessions.id, sessionId))
    .get();

  if (!hwSession) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (hwSession.userId !== session.userId && session.role !== "admin" && session.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // End session and cleanup hardware
  await sessionEnforcer.endSession(hwSession, "ended");

  return NextResponse.json({ message: "Session ended" });
}
