import { spawn } from "child_process";
import { PynqConnectionManager } from "@/lib/hardware/connection-manager";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptSafe } from "@/lib/auth/crypto";

export interface ResetOptions {
  boardId?: string;
  boardType: string;
  programmingTool?: string;
  devicePath?: string | null;
  ipAddress?: string | null;
  sshUsername?: string | null;
  sshPassword?: string | null;
}

/**
 * Reset an FPGA board after a session ends.
 * Uses openFPGALoader --reset or PynqConnectionManager over SSH.
 */
export async function resetBoard(options: ResetOptions): Promise<boolean> {
  const { boardId, boardType, programmingTool = "openFPGALoader", devicePath, ipAddress, sshUsername, sshPassword } = options;

  if (programmingTool === "pynq_ssh") {
    const remoteCmd = 'rm -f /home/xilinx/lab_bitstream.bit && pkill -f ipykernel_launcher; python3 -c "from pynq import PL; PL.reset()"';

    console.log(`[FPGA] Resetting PYNQ board via Connection Manager: board ${boardId || ipAddress}`);

    try {
      let resolvedBoardId = boardId;
      if (!resolvedBoardId && ipAddress) {
        const boardRow = await db.query.boards.findFirst({
          where: eq(boards.ipAddress, ipAddress),
        });
        if (boardRow) {
          resolvedBoardId = boardRow.id;
        }
      }

      if (resolvedBoardId) {
        const res = await PynqConnectionManager.executeCommand(resolvedBoardId, remoteCmd, 15000);
        if (res.exitCode === 0) {
          console.log(`[FPGA] PYNQ Board (${resolvedBoardId}) cleaned up and reset successfully`);
          return true;
        } else {
          console.warn(`[FPGA] PYNQ Board (${resolvedBoardId}) reset failed with exit code ${res.exitCode}`);
          return false;
        }
      } else if (ipAddress) {
        // Fallback SSH execution if boardId cannot be resolved
        const safeIpAddress = ipAddress.replace(/[^a-zA-Z0-9.-]/g, "");
        const username = (sshUsername || "xilinx").replace(/[^a-zA-Z0-9_-]/g, "");
        const password = sshPassword ? decryptSafe(sshPassword) : null;

        let bashCmd = `ssh -o StrictHostKeyChecking=accept-new ${username}@${safeIpAddress} '${remoteCmd}'`;
        const envVars = { ...process.env };
        if (password) {
          bashCmd = `sshpass -e ${bashCmd}`;
          envVars.SSHPASS = password;
        }

        return new Promise<boolean>((resolve) => {
          const proc = spawn("bash", ["-c", bashCmd], { timeout: 30000, env: envVars });
          proc.on("close", (code) => resolve(code === 0));
          proc.on("error", () => resolve(false));
        });
      } else {
        console.warn("[FPGA] Error: Neither boardId nor ipAddress provided for PYNQ SSH reset");
        return false;
      }
    } catch (err: any) {
      console.error(`[FPGA] PYNQ reset error:`, err.message);
      return false;
    }
  }

  return new Promise((resolve) => {
    let args: string[];

    if (programmingTool === "openFPGALoader") {
      args = ["-b", boardType, "--reset"];
      if (devicePath) {
        args.splice(2, 0, "-d", devicePath);
      }
    } else {
      args = ["--reset"];
    }

    console.log(`[FPGA] Resetting board: ${programmingTool} ${args.join(" ")}`);

    const proc = spawn(programmingTool, args, { timeout: 30000 });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log("[FPGA] Board reset successfully");
        resolve(true);
      } else {
        console.warn(`[FPGA] Board reset failed (exit code: ${code})`);
        resolve(false);
      }
    });

    proc.on("error", (err) => {
      console.error("[FPGA] Reset spawn error:", err.message);
      resolve(false);
    });
  });
}
