import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import { checkPynqOnline, fetchPynqTelemetry } from "./pynq-telemetry";

class BoardHealthMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private failCounts = new Map<string, number>();

  start() {
    if (this.interval) return;
    console.log("[Health] Board health monitor started");
    this.interval = setInterval(() => this.checkAllBoards(), 60000); // Check every 60s
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkAllBoards() {
    try {
      const allBoards = db.select().from(boards).all();
      
      for (const board of allBoards) {
        let isOnline = false;
        
        if (board.connectionType === "network") {
          // Verify online status via SSH
          isOnline = await checkPynqOnline(board.id);
          
          if (isOnline) {
            // Fetch telemetry to monitor thresholds
            try {
              const tel = await fetchPynqTelemetry(board.id);
              if (tel && tel.cpu && tel.cpu.temp) {
                const temp = parseFloat(tel.cpu.temp);
                if (temp > 80) {
                  console.warn(`[Health Alert] Board ${board.name} (${board.id}) temperature is critical: ${temp}°C`);
                }
              }
            } catch (err: any) {
              console.warn(`[Health] Failed to fetch telemetry for online board ${board.name}:`, err.message);
            }
          }
        } else if (board.devicePath) {
          // For JTAG/USB, check if the device path exists on the file system
          isOnline = fs.existsSync(board.devicePath);
        } else {
          // If no connection details, assume online/offline based on manual admin status
          isOnline = board.status !== "offline";
        }
        
        const prevFailCount = this.failCounts.get(board.id) || 0;
        
        if (isOnline) {
          this.failCounts.set(board.id, 0);
          if (board.status === "offline") {
            // Restore previous status based on session existence
            const newStatus = board.currentSessionId ? "allocated" : "free";
            db.update(boards)
              .set({ status: newStatus })
              .where(eq(boards.id, board.id))
              .run();
            console.log(`[Health] Board ${board.name} (${board.id}) is back ONLINE`);
          }
        } else {
          const newFailCount = prevFailCount + 1;
          this.failCounts.set(board.id, newFailCount);
          
          if (newFailCount >= 3 && board.status !== "offline") {
            // Mark offline after 3 consecutive failures
            db.update(boards)
              .set({ status: "offline" })
              .where(eq(boards.id, board.id))
              .run();
            console.warn(`[Health Alert] Board ${board.name} (${board.id}) marked OFFLINE due to 3 consecutive failures`);
          }
        }
      }
    } catch (err: any) {
      console.error("[Health] Health monitor tick error:", err.message);
    }
  }
}

export const boardHealthMonitor = new BoardHealthMonitor();
