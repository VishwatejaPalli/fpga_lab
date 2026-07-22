import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/lib/db";
import { boards, hwSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [board] = await db.select().from(boards).where(eq(boards.id, id));

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  if (board.boardType.toLowerCase().includes("pynq")) {
      const host = board.ipAddress || board.devicePath;
      if (!host) {
        return NextResponse.json({ error: "IP address not configured for this board" }, { status: 400 });
      }

      // Check if board already has an active session
      const [activeSessionForBoard] = await db
        .select()
        .from(hwSessions)
        .where(
          and(
            eq(hwSessions.boardId, id),
            eq(hwSessions.status, "active")
          )
        );

      if (activeSessionForBoard) {
        if (activeSessionForBoard.userId !== session.userId) {
          return NextResponse.json(
            { error: "This board is currently in use by another student." },
            { status: 400 }
          );
        }
      } else {
        if (board.status === "offline") {
          return NextResponse.json({ error: "This board is currently offline." }, { status: 400 });
        }

        // Auto-end the user's current active session if they have one elsewhere
        const [userActiveSession] = await db
          .select()
          .from(hwSessions)
          .where(
            and(
              eq(hwSessions.userId, session.userId),
              eq(hwSessions.status, "active")
            )
          );

        if (userActiveSession) {
          await db.update(hwSessions)
            .set({ status: "ended" })
            .where(eq(hwSessions.id, userActiveSession.id));

          await db.update(boards)
            .set({ status: "free", currentSessionId: null })
            .where(eq(boards.id, userActiveSession.boardId));
        }

        // Create new active session for this board
        const newSessionId = randomUUID();
        const expiresAt = new Date(Date.now() + (board.sessionTimeoutMinutes || 30) * 60 * 1000).toISOString();

        await db.insert(hwSessions)
          .values({
            id: newSessionId,
            userId: session.userId,
            boardId: id,
            status: "active",
            expiresAt,
          });

        await db.update(boards)
          .set({ status: "busy", currentSessionId: newSessionId })
          .where(eq(boards.id, id));
      }

      const proxyUrl = `/pynq-proxy/${id}/tree`;
      return NextResponse.json({ url: proxyUrl });
  }

  return NextResponse.json({ error: "Jupyter not supported on this board type" }, { status: 400 });
}
