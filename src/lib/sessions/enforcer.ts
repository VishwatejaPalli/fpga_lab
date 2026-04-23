import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { hwSessions, boards } from "@/lib/db/schema";
import { resetBoard } from "@/lib/fpga/reset";
import { uartService } from "@/lib/hardware/uart";
import { cameraService } from "@/lib/hardware/camera";

/**
 * Session Enforcer — periodically checks for expired hardware sessions
 * and cleans up resources.
 */
class SessionEnforcer {
  private interval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start checking every 30 seconds.
   */
  start() {
    if (this.interval) return;
    console.log("[Sessions] Session enforcer started");
    this.interval = setInterval(() => this.check(), 30000);
  }

  /**
   * Stop the enforcer.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Check for and cleanup expired sessions.
   */
  private async check() {
    const activeSessions = db
      .select()
      .from(hwSessions)
      .where(eq(hwSessions.status, "active"))
      .all();

    const now = new Date();

    for (const session of activeSessions) {
      const expires = new Date(session.expiresAt);
      if (now > expires) {
        console.log(
          `[Sessions] Session ${session.id} expired for board ${session.boardId}`
        );
        await this.endSession(session);
      }
    }
  }

  /**
   * Cleanup a session: stop UART, stop camera, reset FPGA, release board.
   */
  async endSession(session: typeof hwSessions.$inferSelect) {
    try {
      // Stop UART
      uartService.close(session.boardId);

      // Stop camera
      cameraService.stop(session.boardId);

      // Get board for reset
      const board = db
        .select()
        .from(boards)
        .where(eq(boards.id, session.boardId))
        .get();

      if (board) {
        // Reset FPGA
        await resetBoard({
          boardType: board.boardType,
          programmingTool: board.programmingTool || "openFPGALoader",
          devicePath: board.devicePath,
        });

        // Release board
        db.update(boards)
          .set({ status: "free", currentSessionId: null })
          .where(eq(boards.id, board.id))
          .run();
      }

      // Mark session as expired
      db.update(hwSessions)
        .set({ status: "expired" })
        .where(eq(hwSessions.id, session.id))
        .run();

      console.log(`[Sessions] Session ${session.id} cleaned up`);
    } catch (error) {
      console.error(
        `[Sessions] Failed to cleanup session ${session.id}:`,
        error
      );
    }
  }
}

export const sessionEnforcer = new SessionEnforcer();
