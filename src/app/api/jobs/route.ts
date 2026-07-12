import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, and, desc } from "drizzle-orm";
import db from "@/lib/db";
import { jobs, boards, hwSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-utils";
import { validateBitstream } from "@/lib/fpga/bitstream-validator";
import path from "path";
import { logAuditEvent } from "@/lib/audit";

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

    // Resolve path and run bitstream validation
    const resolvedPath = path.isAbsolute(bitstreamPath)
      ? bitstreamPath
      : path.join(process.cwd(), bitstreamPath);

    const validation = validateBitstream(resolvedPath, bitstreamName, board.fpgaFamily);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Bitstream validation failed" },
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

    // Check if the board has an active session
    let boardActiveSession = db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.status, "active")
        )
      )
      .get();

    // If there is an active session, check if it has expired
    if (boardActiveSession) {
      const isExpired = new Date(boardActiveSession.expiresAt) < new Date();
      if (isExpired) {
        // Dynamically clean up expired session
        db.update(hwSessions)
          .set({ status: "expired" })
          .where(eq(hwSessions.id, boardActiveSession.id))
          .run();
        
        db.update(boards)
          .set({ status: "free", currentSessionId: null })
          .where(eq(boards.id, boardId))
          .run();

        // Update local variables for downstream checks
        board.status = "free";
        boardActiveSession = undefined;
      }
    }

    const isAdmin = session.role === "admin";

    // Prevent concurrent uploads/sessions to a board in use (unless requester is Admin or owns the active session)
    if (!isAdmin) {
      if (
        board.status === "busy" ||
        board.status === "programming" ||
        board.status === "allocated" ||
        (boardActiveSession && boardActiveSession.userId !== session.userId)
      ) {
        return NextResponse.json(
          { error: "Board is currently in use by another session or programming job." },
          { status: 409 }
        );
      }
    }


    // Role-based priority assignment
    let priority = 0;
    if (session.role === "admin") priority = 10;
    else if (session.role === "researcher") priority = 5;

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
        priority,
      })
      .run();

    logAuditEvent({
      userId: session.userId,
      action: "job_queued",
      target: jobId,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || null,
      metadata: { boardId, bitstreamName },
    });

    return NextResponse.json(
      { id: jobId, status: "queued", message: "Job queued for programming" },
      { status: 201 }
    );
});
