import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, and, desc } from "drizzle-orm";
import db from "@/lib/db";
import { jobs, boards, hwSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { runDemoJob } from "@/lib/fpga/demo-runner";

const jobSchema = z.object({
  boardId: z.string().uuid(),
  bitstreamPath: z.string().min(1),
  bitstreamName: z.string().min(1),
});

export async function GET(req: NextRequest) {
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
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    // Check if user already has an active session — auto-end for demo flow
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

    if (activeSession) {
      // Auto-end previous session for demo convenience
      db.update(hwSessions)
        .set({ status: "ended" })
        .where(eq(hwSessions.id, activeSession.id))
        .run();

      // Free the old board
      if (activeSession.boardId) {
        db.update(boards)
          .set({ status: "free" })
          .where(eq(boards.id, activeSession.boardId))
          .run();
      }
    }

    // Create job
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

    // Start demo simulation in background (runs without blocking the response)
    // In production with real hardware, this would dispatch to openFPGALoader instead
    runDemoJob(jobId, boardId, session.userId, bitstreamName).catch((err) => {
      console.error("[Jobs] Demo runner error:", err);
      db.update(jobs)
        .set({ status: "failed", logs: `Error: ${err.message}` })
        .where(eq(jobs.id, jobId))
        .run();
    });

    return NextResponse.json(
      { id: jobId, status: "queued", message: "Job queued" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Jobs] Create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
