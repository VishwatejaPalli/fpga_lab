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
      ? await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100)
      : await db
          .select()
          .from(jobs)
          .where(eq(jobs.userId, session.userId))
          .orderBy(desc(jobs.createdAt))
          .limit(50);

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
    const [board] = await db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId));

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

    // Auto-end the user's active session ONLY if it was on a different board
    const [userActiveSession] = await db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.userId, session.userId),
          eq(hwSessions.status, "active")
        )
      );

    if (userActiveSession && userActiveSession.boardId !== boardId) {
      await db.update(hwSessions)
        .set({ status: "ended" })
        .where(eq(hwSessions.id, userActiveSession.id));

      await db.update(boards)
        .set({ status: "free", currentSessionId: null })
        .where(eq(boards.id, userActiveSession.boardId));
    }

    // Check if the board has an active session
    const activeSessions = await db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.status, "active")
        )
      );
    let boardActiveSession: typeof hwSessions.$inferSelect | undefined = activeSessions[0];

    // If there is an active session, check if it has expired
    if (boardActiveSession) {
      const isExpired = new Date(boardActiveSession.expiresAt) < new Date();
      if (isExpired) {
        // Dynamically clean up expired session
        await db.update(hwSessions)
          .set({ status: "expired" })
          .where(eq(hwSessions.id, boardActiveSession.id));
        
        await db.update(boards)
          .set({ status: "free", currentSessionId: null })
          .where(eq(boards.id, boardId));

        // Update local variables for downstream checks
        board.status = "free";
        boardActiveSession = undefined;
      }
    }

    const isAdmin = session.role === "admin";

    // Prevent concurrent uploads/sessions to a board in use (unless requester is Admin or owns the active session)
    if (!isAdmin) {
      const isBoardInUseByOther =
        board.status === "busy" ||
        board.status === "programming" ||
        (board.status === "allocated" && (!boardActiveSession || boardActiveSession.userId !== session.userId)) ||
        (boardActiveSession && boardActiveSession.userId !== session.userId);

      if (isBoardInUseByOther) {
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
    await db.insert(jobs)
      .values({
        id: jobId,
        userId: session.userId,
        boardId,
        bitstreamPath,
        bitstreamName,
        status: "queued",
        priority,
      });

    await logAuditEvent({
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
