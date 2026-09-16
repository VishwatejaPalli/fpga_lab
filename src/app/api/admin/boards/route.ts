import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { encrypt, decryptSafe } from "@/lib/auth/crypto";

const boardSchema = z.object({
  name: z.string().min(1),
  macAddress: z.string().optional(),
  hostname: z.string().optional(),
  fpgaFamily: z.string().min(1),
  boardType: z.string().min(1),
  connectionType: z.enum(["jtag", "network", "usb"]).default("jtag"),
  devicePath: z.string().optional(),
  ipAddress: z.string().optional(),
  serialPort: z.string().optional(),
  cameraDevice: z.string().optional(),
  cameraDeviceId: z.string().optional(),
  uartDeviceId: z.string().optional(),
  jtagDeviceId: z.string().optional(),
  mappingStatus: z.enum(["UNMAPPED", "PENDING_VERIFICATION", "VERIFIED", "DEGRADED", "NEEDS_REVALIDATION"]).optional(),
  boardImageUrl: z.string().optional(),
  blankBitstreamPath: z.string().optional(),
  programmingTool: z.string().default("openFPGALoader"),
  sshUsername: z.string().optional(),
  sshPassword: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  sessionTimeoutMinutes: z.number().min(5).max(480).default(30),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allBoards = await db.select().from(boards);
  const parsed = allBoards.map((b) => ({
    ...b,
    sshPassword: b.sshPassword ? decryptSafe(b.sshPassword) : null,
    capabilities: JSON.parse(b.capabilities || "[]"),
  }));

  return NextResponse.json({ boards: parsed });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = boardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const id = uuid();
    const encryptedPassword = data.sshPassword ? encrypt(data.sshPassword) : null;

    await db.insert(boards)
      .values({
        id,
        name: data.name,
        macAddress: data.macAddress || null,
        hostname: data.hostname || null,
        fpgaFamily: data.fpgaFamily,
        boardType: data.boardType,
        connectionType: data.connectionType,
        devicePath: data.devicePath || null,
        ipAddress: data.ipAddress || null,
        serialPort: data.serialPort || null,
        cameraDevice: data.cameraDevice || null,
        cameraDeviceId: data.cameraDeviceId || null,
        uartDeviceId: data.uartDeviceId || null,
        jtagDeviceId: data.jtagDeviceId || null,
        mappingStatus: data.mappingStatus || "UNMAPPED",
        boardImageUrl: data.boardImageUrl || null,
        blankBitstreamPath: data.blankBitstreamPath || null,
        programmingTool: data.programmingTool,
        sshUsername: data.sshUsername || null,
        sshPassword: encryptedPassword,
        capabilities: JSON.stringify(data.capabilities),
        sessionTimeoutMinutes: data.sessionTimeoutMinutes,
        status: "free",
        connectionStatus: "ONLINE",
      });

    return NextResponse.json({ id, message: "Board created" }, { status: 201 });
  } catch (error) {
    console.error("[Admin] Create board error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: "Board ID is required" }, { status: 400 });
    }

    const parsed = boardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const encryptedPassword = data.sshPassword ? encrypt(data.sshPassword) : null;

    await db.update(boards)
      .set({
        name: data.name,
        macAddress: data.macAddress || null,
        hostname: data.hostname || null,
        fpgaFamily: data.fpgaFamily,
        boardType: data.boardType,
        connectionType: data.connectionType,
        devicePath: data.devicePath || null,
        ipAddress: data.ipAddress || null,
        serialPort: data.serialPort || null,
        cameraDevice: data.cameraDevice || null,
        cameraDeviceId: data.cameraDeviceId || null,
        uartDeviceId: data.uartDeviceId || null,
        jtagDeviceId: data.jtagDeviceId || null,
        mappingStatus: data.mappingStatus || undefined,
        boardImageUrl: data.boardImageUrl || null,
        blankBitstreamPath: data.blankBitstreamPath || null,
        programmingTool: data.programmingTool,
        sshUsername: data.sshUsername || null,
        sshPassword: encryptedPassword,
        capabilities: JSON.stringify(data.capabilities),
        sessionTimeoutMinutes: data.sessionTimeoutMinutes,
      })
      .where(eq(boards.id, id));

    return NextResponse.json({ id, message: "Board updated" });
  } catch (error) {
    console.error("[Admin] Update board error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json(
      { error: "Board ID is required" },
      { status: 400 }
    );
  }

  await db.delete(boards).where(eq(boards.id, id));
  return NextResponse.json({ message: "Board deleted" });
}
