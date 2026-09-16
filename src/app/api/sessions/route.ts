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

  const [activeSession] = await db
    .select()
    .from(hwSessions)
    .where(
      and(
        eq(hwSessions.userId, session.userId),
        eq(hwSessions.status, "active")
      )
    );

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

  const { sessionId, boardId } = await req.json();

  let hwSession;
  if (sessionId) {
    const sessions = await db
      .select()
      .from(hwSessions)
      .where(eq(hwSessions.id, sessionId));
    hwSession = sessions[0];
  } else if (boardId) {
    const sessions = await db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.status, "active")
        )
      );
    hwSession = sessions[0];
  }

  if (!hwSession) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (hwSession.userId !== session.userId && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // End session and cleanup hardware
  await sessionEnforcer.endSession(hwSession, "ended");

  return NextResponse.json({ message: "Session ended" });
}

/**
 * PATCH - Extend active session duration (by 15 minutes)
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, boardId } = body;
  // Validate and clamp extensionMinutes: must be 1–30 (prevents client abuse)
  const rawMinutes = typeof body.extensionMinutes === "number" ? body.extensionMinutes : 15;
  const extensionMinutes = Math.max(1, Math.min(30, Math.round(rawMinutes)));

  let hwSession;
  if (sessionId) {
    const sessions = await db
      .select()
      .from(hwSessions)
      .where(eq(hwSessions.id, sessionId));
    hwSession = sessions[0];
  } else if (boardId) {
    const sessions = await db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.status, "active")
        )
      );
    hwSession = sessions[0];
  }

  if (!hwSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (hwSession.userId !== session.userId && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Extend session time
  const currentExpiry = new Date(hwSession.expiresAt);
  const now = new Date();
  const baseTime = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseTime.getTime() + extensionMinutes * 60 * 1000);

  // Maximum allowed session length: 2 hours from session creation
  const createdTime = new Date(hwSession.startedAt);
  const maxExpiry = new Date(createdTime.getTime() + 120 * 60 * 1000);

  const finalExpiry = newExpiry > maxExpiry ? maxExpiry : newExpiry;

  await db
    .update(hwSessions)
    .set({ expiresAt: finalExpiry.toISOString() })
    .where(eq(hwSessions.id, hwSession.id));

  return NextResponse.json({
    message: "Session extended successfully",
    session: {
      ...hwSession,
      expiresAt: finalExpiry.toISOString(),
    },
  });
}

