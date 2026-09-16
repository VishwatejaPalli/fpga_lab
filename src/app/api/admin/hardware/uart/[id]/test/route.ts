import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import db from "@/lib/db";
import { hardwareDevices, hwSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { SerialPort } from "serialport";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const [device] = await db
    .select()
    .from(hardwareDevices)
    .where(eq(hardwareDevices.id, id));

  if (!device || device.type !== "uart") {
    return NextResponse.json({ error: "UART device not found in registry" }, { status: 404 });
  }

  // 1. EBUSY Resource Locking Protection
  // If the device is assigned to a board that currently has an active session, skip invasive open()
  if (device.assignedBoardId) {
    const activeSessions = await db
      .select()
      .from(hwSessions)
      .where(and(eq(hwSessions.boardId, device.assignedBoardId), eq(hwSessions.status, "active")));

    if (activeSessions.length > 0 || device.status === "IN_USE") {
      return NextResponse.json({
        success: true,
        inUse: true,
        status: "ACTIVE_IN_USE",
        message: "UART port is currently in use by an active user session. Connection is alive.",
        device: {
          id: device.id,
          model: device.model,
          path: device.preferredPath,
        },
      });
    }
  }

  const targetPath = device.preferredPath || device.deviceNode;

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json(
      {
        success: false,
        status: "OFFLINE",
        error: `Physical serial device node not found at ${targetPath}. Please check USB connection.`,
      },
      { status: 404 }
    );
  }

  // 2. Physical Port Diagnostic Test using SerialPort
  try {
    const startTime = Date.now();
    const port = new SerialPort({
      path: targetPath,
      baudRate: 115200,
      autoOpen: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { port.close(); } catch {}
        reject(new Error("Serial port open timed out after 2000ms"));
      }, 2000);

      port.open((err: Error | null) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else {
          port.close(() => resolve());
        }
      });
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      inUse: false,
      status: "VERIFIED_ONLINE",
      testedBaudRate: 115200,
      latencyMs,
      message: `UART port test passed successfully (${latencyMs}ms)`,
      device: {
        id: device.id,
        model: device.model,
        path: targetPath,
        serialNumber: device.serialNumber,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[UARTTest] Error opening port ${targetPath}:`, message);
    return NextResponse.json(
      {
        success: false,
        status: "FAILED",
        error: `UART diagnostic failed: ${message}`,
        device: {
          id: device.id,
          model: device.model,
          path: targetPath,
        },
      },
      { status: 500 }
    );
  }
}
