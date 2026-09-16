import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import net from "net";
import db from "@/lib/db";
import { boards, hardwareDevices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

/**
 * Fast TCP check for network-connected SoC boards (e.g. PYNQ on port 22)
 */
async function checkTcpReachability(ip: string, port = 22, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on("timeout", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, ip);
    } catch {
      resolve(false);
    }
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  // 1. Fetch Board
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, id));

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // 2. Resolve Hardware Device Records or String Paths
  let cameraDevice: typeof hardwareDevices.$inferSelect | undefined;
  let uartDevice: typeof hardwareDevices.$inferSelect | undefined;

  if (board.cameraDeviceId) {
    const [cd] = await db.select().from(hardwareDevices).where(eq(hardwareDevices.id, board.cameraDeviceId));
    cameraDevice = cd;
  }
  if (board.uartDeviceId) {
    const [ud] = await db.select().from(hardwareDevices).where(eq(hardwareDevices.id, board.uartDeviceId));
    uartDevice = ud;
  }

  const cameraPath = cameraDevice?.preferredPath || board.cameraDevice;
  const uartPath = uartDevice?.preferredPath || board.serialPort;
  const jtagPath = board.devicePath;
  const ipAddress = board.ipAddress;



  // 3. Strict Check: Does this board have ANY hardware assigned?
  const hasConfiguredHardware = !!(cameraPath || uartPath || jtagPath || (board.connectionType === "network" && ipAddress));

  if (!hasConfiguredHardware) {
    await db
      .update(boards)
      .set({
        mappingStatus: "UNMAPPED",
        mappingVerifiedAt: null,
        hardwareFingerprint: null,
        lastError: "Cannot verify: No hardware devices (Camera, UART, or JTAG/IP) are assigned to this board.",
      })
      .where(eq(boards.id, board.id));

    return NextResponse.json(
      {
        error: "Cannot verify board: No physical hardware is assigned. Please bind a Camera, UART port, or JTAG cable in the Hardware Studio first.",
        mappingStatus: "UNMAPPED",
      },
      { status: 400 }
    );
  }

  const verificationItems: Array<{
    type: "camera" | "uart" | "jtag" | "network";
    target: string;
    status: "PASSED" | "FAILED" | "SKIPPED";
    details: string;
    isPersistent?: boolean;
  }> = [];

  // 4. Physical Camera Verification
  if (cameraPath) {
    const exists = fs.existsSync(cameraPath) || !!(cameraDevice?.deviceNode && fs.existsSync(cameraDevice.deviceNode));
    verificationItems.push({
      type: "camera",
      target: cameraPath,
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? `Camera online and accessible at ${cameraPath}`
        : `Physical video node missing or disconnected at ${cameraPath}`,
      isPersistent: cameraDevice?.isPersistent ?? false,
    });
  }

  // 5. Physical UART Serial Verification
  if (uartPath) {
    const exists = fs.existsSync(uartPath) || !!(uartDevice?.deviceNode && fs.existsSync(uartDevice.deviceNode));
    verificationItems.push({
      type: "uart",
      target: uartPath,
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? `Serial UART port online and accessible at ${uartPath}`
        : `Physical serial device missing or disconnected at ${uartPath}`,
      isPersistent: uartDevice?.isPersistent ?? false,
    });
  }

  // 6. Physical JTAG Cable Verification (for USB/JTAG boards)
  if (board.connectionType !== "network" && jtagPath) {
    const exists = fs.existsSync(jtagPath);
    verificationItems.push({
      type: "jtag",
      target: jtagPath,
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? `JTAG device node online at ${jtagPath}`
        : `JTAG cable node missing at ${jtagPath}`,
    });
  }

  // 7. Network Connectivity Check (for SoC boards e.g. PYNQ)
  if (board.connectionType === "network" && ipAddress) {
    const reachable = await checkTcpReachability(ipAddress, 22, 2000);
    verificationItems.push({
      type: "network",
      target: `${ipAddress}:22`,
      status: reachable ? "PASSED" : "FAILED",
      details: reachable
        ? `SoC board SSH port 22 reachable at ${ipAddress}`
        : `Cannot reach TCP port 22 on ${ipAddress} (timed out or offline)`,
    });
  }

  // 8. Evaluation: All configured items must be PASSED
  const failedItems = verificationItems.filter((i) => i.status === "FAILED");
  const passedItems = verificationItems.filter((i) => i.status === "PASSED");
  const allPassed = failedItems.length === 0 && passedItems.length > 0;

  const newMappingStatus: "VERIFIED" | "DEGRADED" = allPassed ? "VERIFIED" : "DEGRADED";
  const now = new Date().toISOString();

  // 9. Hardware Fingerprint Snapshot
  const fingerprintSnapshot = {
    verifiedAt: now,
    camera: cameraDevice ? {
      id: cameraDevice.id,
      model: cameraDevice.model,
      serialNumber: cameraDevice.serialNumber,
      preferredPath: cameraDevice.preferredPath,
      isPersistent: cameraDevice.isPersistent,
    } : cameraPath ? { preferredPath: cameraPath } : null,
    uart: uartDevice ? {
      id: uartDevice.id,
      model: uartDevice.model,
      serialNumber: uartDevice.serialNumber,
      preferredPath: uartDevice.preferredPath,
      isPersistent: uartDevice.isPersistent,
    } : uartPath ? { preferredPath: uartPath } : null,
    jtag: jtagPath || null,
    ipAddress: ipAddress || null,
    testResults: verificationItems,
  };

  const errorMessage = failedItems.length > 0
    ? `Hardware verification failed: ${failedItems.map((f) => `${f.type} (${f.target})`).join(", ")} disconnected`
    : null;

  // 10. Update Board in DB
  await db
    .update(boards)
    .set({
      mappingStatus: newMappingStatus,
      mappingVerifiedAt: allPassed ? now : null,
      hardwareFingerprint: JSON.stringify(fingerprintSnapshot),
      lastError: errorMessage,
    })
    .where(eq(boards.id, board.id));

  // 11. Update hardware_devices table
  if (cameraDevice && allPassed) {
    await db
      .update(hardwareDevices)
      .set({ assignedBoardId: board.id, status: "ASSIGNED" })
      .where(eq(hardwareDevices.id, cameraDevice.id));
  }
  if (uartDevice && allPassed) {
    await db
      .update(hardwareDevices)
      .set({ assignedBoardId: board.id, status: "ASSIGNED" })
      .where(eq(hardwareDevices.id, uartDevice.id));
  }

  if (!allPassed) {
    return NextResponse.json(
      {
        error: errorMessage,
        mappingStatus: "DEGRADED",
        items: verificationItems,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "Physical hardware verified and bound successfully!",
    mappingStatus: "VERIFIED",
    verifiedAt: now,
    items: verificationItems,
  });
}

