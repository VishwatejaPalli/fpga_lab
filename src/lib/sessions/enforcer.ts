import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { hwSessions, boards } from "@/lib/db/schema";
import { resetBoard } from "@/lib/fpga/reset";
import { FPGAProgrammer } from "@/lib/fpga/programmer";
import { uartService } from "@/lib/hardware/uart";
import { cameraService } from "@/lib/hardware/camera";
import { sshService } from "@/lib/hardware/ssh";
import fs from "fs";
import path from "path";

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

    // Auto-cleanup old bitstreams (>24h)
    this.cleanupUploads();
  }

  private cleanupUploads() {
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    if (!fs.existsSync(uploadDir)) return;

    try {
      const users = fs.readdirSync(uploadDir);
      const now = Date.now();
      const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

      for (const userId of users) {
        const userDir = path.join(uploadDir, userId);
        if (!fs.existsSync(userDir) || !fs.statSync(userDir).isDirectory()) continue;

        const files = fs.readdirSync(userDir);
        for (const file of files) {
          const filePath = path.join(userDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
             // Handle uuid folders from new upload route
             const innerFiles = fs.readdirSync(filePath);
             for(const innerFile of innerFiles) {
                const innerPath = path.join(filePath, innerFile);
                if (now - fs.statSync(innerPath).mtimeMs > maxAgeMs) {
                   fs.rmSync(innerPath, { recursive: true, force: true });
                }
             }
             if (fs.readdirSync(filePath).length === 0) {
                fs.rmdirSync(filePath);
             }
          } else if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (err) {
      console.error("[Sessions] Failed to cleanup uploads:", err);
    }
  }

  /**
   * Cleanup a session: stop UART, stop camera, stop SSH, reset FPGA, release board.
   */
  async endSession(
    session: typeof hwSessions.$inferSelect,
    status: "expired" | "ended" = "expired"
  ) {
    try {
      // Stop UART
      uartService.close(session.boardId);

      // Stop camera
      cameraService.stop(session.boardId);

      // Stop SSH
      sshService.close(session.boardId);

      // Get board for reset
      const board = db
        .select()
        .from(boards)
        .where(eq(boards.id, session.boardId))
        .get();

      if (board) {
        const blankPath = board.blankBitstreamPath || process.env.BLANK_BITSTREAM_PATH;
        const canBlank = blankPath && fs.existsSync(blankPath);

        let resetSuccess = false;
        if (canBlank) {
          const programmer = new FPGAProgrammer();
          const result = await programmer.program({
            boardType: board.boardType,
            bitstreamPath: blankPath,
            programmingTool: board.programmingTool || "openFPGALoader",
            devicePath: board.devicePath,
            ipAddress: board.ipAddress,
            timeout: 120000,
          });

          if (!result.success) {
            resetSuccess = await resetBoard({
              boardType: board.boardType,
              programmingTool: board.programmingTool || "openFPGALoader",
              devicePath: board.devicePath,
              ipAddress: board.ipAddress,
            });
          } else {
            resetSuccess = true;
          }
        } else {
          // Fallback to reset if no blank bitstream is configured
          resetSuccess = await resetBoard({
            boardType: board.boardType,
            programmingTool: board.programmingTool || "openFPGALoader",
            devicePath: board.devicePath,
            ipAddress: board.ipAddress,
          });
        }

        if (resetSuccess) {
          // Release board
          db.update(boards)
            .set({ status: "free", currentSessionId: null })
            .where(eq(boards.id, board.id))
            .run();
        } else {
          // Reset failed, mark board as offline for admin intervention
          console.error(`[Enforcer] Failed to reset board ${board.id}. Marking offline.`);
          db.update(boards)
            .set({ status: "offline", currentSessionId: null })
            .where(eq(boards.id, board.id))
            .run();
        }
      }

      // Mark session complete
      db.update(hwSessions)
        .set({ status })
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
