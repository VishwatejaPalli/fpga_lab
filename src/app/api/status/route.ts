import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import db from "@/lib/db";
import { boards, jobs, hwSessions, users } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Board counts by status
  const boardStats = await db
    .select({
      status: boards.status,
      count: sql<number>`count(*)`,
    })
    .from(boards)
    .groupBy(boards.status);

  const boardCounts: Record<string, number> = {};
  for (const row of boardStats) {
    boardCounts[row.status] = row.count;
  }

  // All boards with current state
  const allBoards = await db
    .select({
      id: boards.id,
      name: boards.name,
      boardType: boards.boardType,
      fpgaFamily: boards.fpgaFamily,
      status: boards.status,
      connectionType: boards.connectionType,
    })
    .from(boards);

  // Active sessions count
  const [activeSessions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(hwSessions)
    .where(eq(hwSessions.status, "active"));

  // Recent jobs (last 10)
  const recentJobs = await db
    .select({
      id: jobs.id,
      bitstreamName: jobs.bitstreamName,
      status: jobs.status,
      boardId: jobs.boardId,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .orderBy(sql`${jobs.createdAt} desc`)
    .limit(10);

  // Total users (admin only)
  let totalUsers = 0;
  if (session.role === "admin") {
    const [uCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    totalUsers = uCount?.count ?? 0;
  }

  return NextResponse.json({
    boards: {
      total: allBoards.length,
      free: boardCounts["free"] ?? 0,
      busy: boardCounts["busy"] ?? 0,
      offline: boardCounts["offline"] ?? 0,
      list: allBoards,
    },
    activeSessions: activeSessions?.count ?? 0,
    recentJobs,
    totalUsers,
  });
}
