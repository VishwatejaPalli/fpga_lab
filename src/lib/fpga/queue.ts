import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { jobs, boards, hwSessions } from "@/lib/db/schema";
import { FPGAProgrammer } from "./programmer";
import { EventEmitter } from "events";

/**
 * Job Queue Processor.
 * Manages a per-board mutex to ensure only one job runs per board at a time.
 * Emits events for real-time log streaming.
 */
class JobQueue extends EventEmitter {
  private boardLocks = new Map<string, boolean>();
  private interval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the queue processor. Polls every 2 seconds.
   */
  start() {
    if (this.interval) return;
    console.log("[Queue] Job queue processor started");
    this.interval = setInterval(() => this.processQueue(), 2000);
  }

  /**
   * Stop the queue processor.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Check for queued jobs and execute them.
   */
  private async processQueue() {
    // Get all queued jobs
    const queuedJobs = db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "queued"))
      .all();

    for (const job of queuedJobs) {
      // Check if board is locked (already being programmed)
      if (this.boardLocks.get(job.boardId)) continue;

      // Check board status
      const board = db
        .select()
        .from(boards)
        .where(eq(boards.id, job.boardId))
        .get();

      if (!board || board.status === "offline") continue;
      if (board.status === "busy") continue;

      // Lock board and start programming
      this.boardLocks.set(job.boardId, true);
      this.executeJob(job, board).catch((err) => {
        console.error(`[Queue] Job ${job.id} failed:`, err);
      });
    }
  }

  /**
   * Execute a single job.
   */
  private async executeJob(
    job: typeof jobs.$inferSelect,
    board: typeof boards.$inferSelect
  ) {
    try {
      // Update job status
      db.update(jobs)
        .set({
          status: "programming",
          startedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, job.id))
        .run();

      // Update board status
      db.update(boards)
        .set({ status: "busy" })
        .where(eq(boards.id, board.id))
        .run();

      // Create programmer instance
      const programmer = new FPGAProgrammer();

      // Forward log events
      programmer.on("log", (text: string) => {
        this.emit("job-log", { jobId: job.id, boardId: board.id, text });
      });

      // Program the FPGA
      const result = await programmer.program({
        boardType: board.boardType,
        bitstreamPath: job.bitstreamPath,
        programmingTool: board.programmingTool || "openFPGALoader",
        devicePath: board.devicePath,
        timeout: 120000,
      });

      if (result.success) {
        // Create hardware session
        const sessionTimeout = board.sessionTimeoutMinutes || 30;
        const expiresAt = new Date(
          Date.now() + sessionTimeout * 60 * 1000
        ).toISOString();
        const sessionId = uuid();

        db.insert(hwSessions)
          .values({
            id: sessionId,
            userId: job.userId,
            boardId: board.id,
            jobId: job.id,
            expiresAt,
            status: "active",
          })
          .run();

        // Update board with session
        db.update(boards)
          .set({ status: "busy", currentSessionId: sessionId })
          .where(eq(boards.id, board.id))
          .run();

        // Update job
        db.update(jobs)
          .set({
            status: "success",
            logs: result.logs,
            completedAt: new Date().toISOString(),
          })
          .where(eq(jobs.id, job.id))
          .run();

        this.emit("job-complete", {
          jobId: job.id,
          boardId: board.id,
          sessionId,
          success: true,
        });
      } else {
        // Failed — release board
        db.update(boards)
          .set({ status: "free" })
          .where(eq(boards.id, board.id))
          .run();

        db.update(jobs)
          .set({
            status: "failed",
            logs: result.logs,
            completedAt: new Date().toISOString(),
          })
          .where(eq(jobs.id, job.id))
          .run();

        this.emit("job-complete", {
          jobId: job.id,
          boardId: board.id,
          success: false,
        });
      }
    } catch (error) {
      console.error(`[Queue] Job ${job.id} error:`, error);

      db.update(jobs)
        .set({
          status: "failed",
          logs: `Internal error: ${error}`,
          completedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, job.id))
        .run();

      db.update(boards)
        .set({ status: "free" })
        .where(eq(boards.id, board.id))
        .run();
    } finally {
      this.boardLocks.set(job.boardId, false);
    }
  }
}

export const jobQueue = new JobQueue();
