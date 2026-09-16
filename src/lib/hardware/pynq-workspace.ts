import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { PynqConnectionManager } from "./connection-manager";
import crypto from "crypto";

export const CLOUDLAB_ROOT = "/home/xilinx/cloudlab";
export const USER_ROOT = "/home/xilinx/cloudlab/users";
export const TEMPLATE_ROOT = "/home/xilinx/cloudlab/templates";
export const MIN_FREE_DISK_MB = 500;

export interface PynqSessionResult {
  success: boolean;
  stage?: "BOARD_RESERVATION" | "SSH_CONNECT" | "DISK_SPACE" | "JUPYTER_API" | "WORKSPACE_PROVISION";
  message?: string;
  relativeUrl?: string;
  sanitizedUserId?: string;
}

export function sanitizeUserId(userId: string): string {
  const hash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 12);
  return `usr_${hash}`;
}

/**
 * Ensures user workspace folder (/home/xilinx/cloudlab/users/<sanitizedUserId>)
 * exists on the target PYNQ board and sets up Jupyter symlinks.
 */
export async function ensurePynqUserWorkspace(
  boardId: string,
  userId: string
): Promise<PynqSessionResult> {
  const safeUserId = sanitizeUserId(userId);

  // 1. Board lookup & status verification
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
  if (!board) {
    return {
      success: false,
      stage: "BOARD_RESERVATION",
      message: "Target FPGA board not found in database.",
    };
  }

  if (board.status === "offline") {
    return {
      success: false,
      stage: "BOARD_RESERVATION",
      message: "Target FPGA board is currently offline.",
    };
  }

  // 2. SSH Connectivity & Health Check via Connection Manager
  const healthCheckCmd = [
    // Free disk space in MB on /
    "df -m / | tail -1 | awk '{print $4}'",
    // Test Jupyter HTTP REST API on port 9090
    "curl -s -f http://localhost:9090/api/status >/dev/null && echo JUPYTER_OK || echo JUPYTER_ERR",
  ].join('; echo "|||"; ');

  let rawHealth = "";
  let targetIp = board.ipAddress || "board";

  try {
    const healthResult = await PynqConnectionManager.executeCommand(boardId, healthCheckCmd, 10000);
    rawHealth = healthResult.stdout;
    targetIp = healthResult.ipUsed;
  } catch (err: any) {
    console.error(`[pynq-workspace] SSH health check failed for ${boardId}:`, err.message);
    return {
      success: false,
      stage: "SSH_CONNECT",
      message: `Failed to connect via SSH to board (${targetIp}): ${err.message}`,
    };
  }

  const healthParts = rawHealth.split("|||").map((s) => s.trim());
  const freeDiskMb = parseInt(healthParts[0], 10) || 0;
  const jupyterStatus = healthParts[1] || "JUPYTER_ERR";

  // 3. Disk Space Threshold Check
  if (freeDiskMb > 0 && freeDiskMb < MIN_FREE_DISK_MB) {
    return {
      success: false,
      stage: "DISK_SPACE",
      message: `PYNQ board disk space is low (${freeDiskMb} MB available, minimum required: ${MIN_FREE_DISK_MB} MB). Please contact administrator.`,
    };
  }

  // 4. Jupyter API Check
  if (jupyterStatus !== "JUPYTER_OK") {
    return {
      success: false,
      stage: "JUPYTER_API",
      message: `Jupyter service on board (${targetIp}:9090) is not responding to REST API health check.`,
    };
  }

  // 5. Compound Provisioning SSH Command
  const userDir = `${USER_ROOT}/${safeUserId}`;
  const provisioningCmd = [
    `mkdir -p "${userDir}"`,
    `mkdir -p "${TEMPLATE_ROOT}"`,
    `mkdir -p "/home/xilinx/jupyter_notebooks"`,
    `ln -sfn "${CLOUDLAB_ROOT}" "/home/xilinx/jupyter_notebooks/cloudlab"`,
    `if [ ! -f "${userDir}/.initialized" ]; then cp -rn "${TEMPLATE_ROOT}"/* "${userDir}/" 2>/dev/null || true; touch "${userDir}/.initialized"; fi`,
    `chmod 700 "${userDir}"`,
    `echo PROVISION_OK`,
  ].join(" && ");

  try {
    const provResult = await PynqConnectionManager.executeCommand(boardId, provisioningCmd, 12000);
    if (!provResult.stdout.includes("PROVISION_OK")) {
      return {
        success: false,
        stage: "WORKSPACE_PROVISION",
        message: `Failed to provision user workspace directory on PYNQ board (${userDir}).`,
      };
    }
  } catch (err: any) {
    console.error(`[pynq-workspace] Provisioning failed for ${safeUserId}:`, err.message);
    return {
      success: false,
      stage: "WORKSPACE_PROVISION",
      message: `Workspace provisioning failed: ${err.message}`,
    };
  }

  const relativeUrl = `/pynq-proxy/${boardId}/tree/cloudlab/users/${safeUserId}`;

  return {
    success: true,
    relativeUrl,
    sanitizedUserId: safeUserId,
  };
}

export { ensurePynqUserWorkspace as preparePynqSession };
