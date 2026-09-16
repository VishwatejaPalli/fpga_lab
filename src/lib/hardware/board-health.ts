import fs from "fs";
import db from "@/lib/db";
import { boards, hardwareDevices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PynqHealthService } from "./connection-manager";
import { syncHardwareRegistry } from "./device-registry";

import { ConnectionStatus } from "./connection-manager";
export type { ConnectionStatus };

class BoardHealthMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private failCounts = new Map<string, number>();

  start() {
    if (this.interval) return;
    console.log("[Health] Advanced Board & Hardware Registry monitor started");
    this.interval = setInterval(() => this.checkAllBoards(), 30000); // Check every 30s
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Evaluates network, SSH, hardware mapping, and PYNQ telemetry health for a given board
   */
  public async checkBoard(boardId: string): Promise<ConnectionStatus> {
    const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
    if (!board) return "OFFLINE";

    const now = new Date().toISOString();



    // ── Check Assigned Hardware Mapping (Camera & UART) ────────────────
    let hardwareMappingHealthy = true;
    let mappingWarning: string | null = null;

    if (board.cameraDeviceId) {
      const [cam] = await db.select().from(hardwareDevices).where(eq(hardwareDevices.id, board.cameraDeviceId));
      if (!cam || cam.status === "OFFLINE" || (!fs.existsSync(cam.preferredPath) && !fs.existsSync(cam.deviceNode))) {
        hardwareMappingHealthy = false;
        mappingWarning = `Assigned camera (${cam?.model || board.cameraDeviceId}) is disconnected`;
      }
    } else if (board.cameraDevice && !fs.existsSync(board.cameraDevice)) {
      hardwareMappingHealthy = false;
      mappingWarning = `Assigned camera path (${board.cameraDevice}) is missing`;
    }

    if (board.uartDeviceId) {
      const [uart] = await db.select().from(hardwareDevices).where(eq(hardwareDevices.id, board.uartDeviceId));
      if (!uart || uart.status === "OFFLINE" || (!fs.existsSync(uart.preferredPath) && !fs.existsSync(uart.deviceNode))) {
        hardwareMappingHealthy = false;
        mappingWarning = `Assigned UART (${uart?.model || board.uartDeviceId}) is disconnected`;
      }
    } else if (board.serialPort && !fs.existsSync(board.serialPort)) {
      hardwareMappingHealthy = false;
      mappingWarning = `Assigned serial port (${board.serialPort}) is missing`;
    }

    if (!hardwareMappingHealthy && board.mappingStatus === "VERIFIED") {
      await db
        .update(boards)
        .set({
          mappingStatus: "DEGRADED",
          lastError: mappingWarning,
        })
        .where(eq(boards.id, boardId));
    }

    // ── Local JTAG/USB vs Network PYNQ ─────────────────────────────────
    if (board.connectionType !== "network") {
      const isOnline = board.devicePath ? fs.existsSync(board.devicePath) : board.status !== "offline";
      const connStatus: ConnectionStatus = isOnline && hardwareMappingHealthy ? "ONLINE" : (isOnline ? "DEGRADED" : "OFFLINE");
      
      await db
        .update(boards)
        .set({
          connectionStatus: connStatus,
          status: isOnline ? (board.status === "offline" ? "free" : board.status) : "offline",
          lastSeen: isOnline ? now : board.lastSeen,
          lastHeartbeat: isOnline ? now : board.lastHeartbeat,
          lastError: mappingWarning || board.lastError,
        })
        .where(eq(boards.id, boardId));
      return connStatus;
    }

    // ── Network Board (PYNQ) Evaluation ──────────────────────────────────
    const diag = await PynqHealthService.diagnoseBoard(boardId);
    const connStatus: ConnectionStatus = diag.status;
    const lastError: string | null = diag.lastError || mappingWarning;
    const targetIp = diag.ipUsed || board.ipAddress;

    // Retries & Fallback management
    const prevFails = this.failCounts.get(boardId) || 0;
    if (connStatus === "ONLINE" || connStatus === "DEGRADED") {
      this.failCounts.set(boardId, 0);
      const newBoardStatus = board.currentSessionId ? "allocated" : "free";

      await db
        .update(boards)
        .set({
          connectionStatus: connStatus,
          status: board.status === "offline" ? newBoardStatus : board.status,
          ipAddress: targetIp || board.ipAddress,
          lastSeen: now,
          lastHeartbeat: now,
          lastIp: targetIp || board.lastIp,
          lastError: null,
        })
        .where(eq(boards.id, boardId));
    } else {
      const newFails = prevFails + 1;
      this.failCounts.set(boardId, newFails);

      const shouldMarkOffline = newFails >= 3;
      await db
        .update(boards)
        .set({
          connectionStatus: connStatus,
          status: shouldMarkOffline ? "offline" : board.status,
          lastError: lastError,
        })
        .where(eq(boards.id, boardId));

      if (newFails <= 3 || newFails % 20 === 0) {
        console.warn(
          `[Health Alert] Board ${board.name} (${boardId}) connection status: ${connStatus} (fail count: ${newFails}/3). Error: ${lastError}`
        );
      }
    }

    return connStatus;
  }

  private async checkAllBoards() {
    try {
      // Sync hardware devices periodically
      await syncHardwareRegistry();

      const allBoards = await db.select().from(boards);
      for (const board of allBoards) {
        await this.checkBoard(board.id);
      }
    } catch (err: any) {
      console.error("[Health] Health monitor tick error:", err.message);
    }
  }
}

export const boardHealthMonitor = new BoardHealthMonitor();

