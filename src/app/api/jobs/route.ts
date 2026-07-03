import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, and, desc } from "drizzle-orm";
import db from "@/lib/db";
import { jobs, boards, hwSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-utils";

const jobSchema = z.object({
  boardId: z.string().uuid(),
  bitstreamPath: z.string().min(1),
  bitstreamName: z.string().min(1),
});

export const GET = withErrorHandler(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Students see their own jobs; researchers and admins see all
  const userJobs =
    session.role === "admin" || session.role === "researcher"
      ? db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100).all()
      : db
          .select()
          .from(jobs)
          .where(eq(jobs.userId, session.userId))
          .orderBy(desc(jobs.createdAt))
          .limit(50)
          .all();

  return NextResponse.json({ jobs: userJobs });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
    const parsed = jobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { boardId, bitstreamPath, bitstreamName } = parsed.data;

    // Check board exists
    const board = db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId))
      .get();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (board.status === "offline") {
      return NextResponse.json(
        { error: "Board is offline" },
        { status: 400 }
      );
    }

    // Auto-end the user's current active session if they have one
    const userActiveSession = db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.userId, session.userId),
          eq(hwSessions.status, "active")
        )
      )
      .get();

    if (userActiveSession) {
      db.update(hwSessions)
        .set({ status: "ended" })
        .where(eq(hwSessions.id, userActiveSession.id))
        .run();

      if (userActiveSession.boardId && userActiveSession.boardId !== boardId) {
        db.update(boards)
          .set({ status: "free" })
          .where(eq(boards.id, userActiveSession.boardId))
          .run();
      }
    }

    // Prevent concurrent uploads/sessions to a board in use
    const boardActiveSession = db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.status, "active")
        )
      )
      .get();

    if (
      board.status === "busy" ||
      board.status === "programming" ||
      board.status === "allocated" ||
      (boardActiveSession && (!userActiveSession || boardActiveSession.userId !== session.userId))
    ) {
      return NextResponse.json(
        { error: "Board is currently in use by another session or programming job." },
        { status: 409 }
      );
    }

    // Create job (The JobQueue will automatically pick this up and process it)
    const jobId = uuid();
    db.insert(jobs)
      .values({
        id: jobId,
        userId: session.userId,
        boardId,
        bitstreamPath,
        bitstreamName,
        status: "queued",
      })
      .run();

    return NextResponse.json(
      { id: jobId, status: "queued", message: "Job queued for programming" },
      { status: 201 }
    );
});
