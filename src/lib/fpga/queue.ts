import { v4 as uuid } from "uuid";
import { eq, desc, and } from "drizzle-orm";
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
  private activeProgrammers = new Map<string, FPGAProgrammer>();
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
    const queuedJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "queued"))
      .orderBy(desc(jobs.priority), jobs.createdAt);

    for (const job of queuedJobs) {
      // Check if board is locked (already being programmed)
      if (this.boardLocks.get(job.boardId)) continue;

      // Check board status
      const [board] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, job.boardId));

      if (!board || board.status === "offline") continue;

      if (this.boardLocks.get(job.boardId) || board.status === "programming") {
        // Board is currently being programmed. Wait.
        continue;
      }

      if (board.status === "allocated" || board.status === "busy") {
        // Only allow if the board is allocated to the user who submitted the job
        const [activeSession] = await db
          .select()
          .from(hwSessions)
          .where(and(eq(hwSessions.boardId, job.boardId), eq(hwSessions.status, "active")));

        if (activeSession && activeSession.userId === job.userId) {
          // It's their board, allow reprogramming
          console.log(`[Queue] User ${job.userId} reprogramming allocated board ${job.boardId}`);
        } else {
          // Allocated to someone else (or busy), wait
          continue;
        }
      }

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
      await db.update(jobs)
        .set({
          status: "programming",
          startedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, job.id));

      // Update board status
      await db.update(boards)
        .set({ status: "programming" })
        .where(eq(boards.id, board.id));

      // Create programmer instance
      const programmer = new FPGAProgrammer();
      this.activeProgrammers.set(board.id, programmer);

      // Forward log events
      programmer.on("log", (text: string) => {
        this.emit("job-log", { jobId: job.id, boardId: board.id, text });
      });

      // Program the FPGA (with up to 3 retry attempts for USB/JTAG transient issues)
      let result: any = { success: false, logs: "", exitCode: null, duration: 0 };
      let attempt = 1;
      const maxAttempts = 3;

      while (attempt <= maxAttempts) {
        if (attempt > 1) {
          programmer.emit("log", `\n[Queue] Retrying programming (attempt ${attempt}/${maxAttempts})...\n`);
        }
        
        let activeIp = board.ipAddress;
        if (board.connectionType === "network") {
          try {
            const { PynqConnectionManager } = await import("../hardware/connection-manager");
            const target = await PynqConnectionManager.resolveTarget(board.id);
            activeIp = target.ipAddress;
          } catch (err: any) {
            console.warn(`[Queue] Failed to resolve target IP for board ${board.id}:`, err.message);
          }
        }

        result = await programmer.program({
          boardType: board.boardType,
          bitstreamPath: job.bitstreamPath,
          programmingTool: board.programmingTool || "openFPGALoader",
          devicePath: board.devicePath,
          ipAddress: activeIp,
          sshUsername: board.sshUsername,
          sshPassword: board.sshPassword,
          timeout: 120000,
        });

        if (result.success) {
          break;
        }

        attempt++;
        if (attempt <= maxAttempts) {
          // Wait 1 second before retrying to let the JTAG connection/USB controller settle
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (result.success) {
        const sessionTimeout = board.sessionTimeoutMinutes || 30;
        const expiresAt = new Date(Date.now() + sessionTimeout * 60 * 1000).toISOString();

        // Check if there is already an active session for this user on this board (reprogramming)
        const [existingUserSession] = await db
          .select()
          .from(hwSessions)
          .where(
            and(
              eq(hwSessions.boardId, board.id),
              eq(hwSessions.userId, job.userId),
              eq(hwSessions.status, "active")
            )
          );

        let sessionId: string;
        if (existingUserSession) {
          // Reprogramming: reuse and extend existing session
          sessionId = existingUserSession.id;
          await db
            .update(hwSessions)
            .set({
              jobId: job.id,
              expiresAt,
            })
            .where(eq(hwSessions.id, sessionId));
        } else {
          // Clean up any stale active session before creating a new one
          await db
            .update(hwSessions)
            .set({ status: "ended" })
            .where(and(eq(hwSessions.boardId, board.id), eq(hwSessions.status, "active")));

          sessionId = uuid();
          await db.insert(hwSessions).values({
            id: sessionId,
            userId: job.userId,
            boardId: board.id,
            jobId: job.id,
            expiresAt,
            status: "active",
          });
        }

        // Update board with session
        await db.update(boards)
          .set({ status: "allocated", currentSessionId: sessionId })
          .where(eq(boards.id, board.id));

        // Update job
        await db.update(jobs)
          .set({
            status: "success",
            logs: result.logs,
            completedAt: new Date().toISOString(),
          })
          .where(eq(jobs.id, job.id));

        this.emit("job-complete", {
          jobId: job.id,
          boardId: board.id,
          sessionId,
          success: true,
        });
      } else {
        // Check if there is already an active session on this board to preserve
        const [activeSession] = await db
          .select()
          .from(hwSessions)
          .where(and(eq(hwSessions.boardId, board.id), eq(hwSessions.status, "active")));

        if (activeSession) {
          // Restore the allocated status so the user doesn't lose their session
          await db.update(boards)
            .set({ status: "allocated", currentSessionId: activeSession.id })
            .where(eq(boards.id, board.id));
        } else {
          // Release board back to free pool
          await db.update(boards)
            .set({ status: "free", currentSessionId: null })
            .where(eq(boards.id, board.id));
        }

        await db.update(jobs)
          .set({
            status: "failed",
            logs: result.logs,
            completedAt: new Date().toISOString(),
          })
          .where(eq(jobs.id, job.id));

        this.emit("job-complete", {
          jobId: job.id,
          boardId: board.id,
          success: false,
        });
      }
    } catch (error) {
      console.error(`[Queue] Job ${job.id} error:`, error);

      await db.update(jobs)
        .set({
          status: "failed",
          logs: `Internal error: ${error}`,
          completedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, job.id));

      // Check if there was an active session to preserve rather than destroying it
      const [activeSession] = await db
        .select()
        .from(hwSessions)
        .where(and(eq(hwSessions.boardId, board.id), eq(hwSessions.status, "active")));

      if (activeSession) {
        await db.update(boards)
          .set({ status: "allocated", currentSessionId: activeSession.id })
          .where(eq(boards.id, board.id));
      } else {
        await db.update(boards)
          .set({ status: "free", currentSessionId: null })
          .where(eq(boards.id, board.id));
      }
    } finally {
      this.boardLocks.set(job.boardId, false);
      this.activeProgrammers.delete(board.id);
    }
  }
}

export const jobQueue = new JobQueue();
