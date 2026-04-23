import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import db from "@/lib/db";
import { jobs, boards, hwSessions } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Get job history
  const jobHistory = await db
    .select({
      id: jobs.id,
      boardId: jobs.boardId,
      boardName: boards.name,
      boardType: boards.boardType,
      bitstreamName: jobs.bitstreamName,
      status: jobs.status,
      createdAt: jobs.createdAt,
      startedAt: jobs.startedAt,
      completedAt: jobs.completedAt,
      logs: jobs.logs,
    })
    .from(jobs)
    .leftJoin(boards, eq(jobs.boardId, boards.id))
    .where(eq(jobs.userId, session.userId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get session history
  const sessionHistory = await db
    .select({
      id: hwSessions.id,
      boardId: hwSessions.boardId,
      boardName: boards.name,
      startedAt: hwSessions.startedAt,
      expiresAt: hwSessions.expiresAt,
      status: hwSessions.status,
    })
    .from(hwSessions)
    .leftJoin(boards, eq(hwSessions.boardId, boards.id))
    .where(eq(hwSessions.userId, session.userId))
    .orderBy(desc(hwSessions.startedAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    jobs: jobHistory,
    sessions: sessionHistory,
  });
}
