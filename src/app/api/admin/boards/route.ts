import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const boardSchema = z.object({
  name: z.string().min(1),
  fpgaFamily: z.string().min(1),
  boardType: z.string().min(1),
  connectionType: z.enum(["jtag", "network", "usb"]).default("jtag"),
  devicePath: z.string().optional(),
  serialPort: z.string().optional(),
  cameraDevice: z.string().optional(),
  programmingTool: z.string().default("openFPGALoader"),
  capabilities: z.array(z.string()).default([]),
  sessionTimeoutMinutes: z.number().min(5).max(480).default(30),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allBoards = db.select().from(boards).all();
  const parsed = allBoards.map((b) => ({
    ...b,
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

    db.insert(boards)
      .values({
        id,
        name: data.name,
        fpgaFamily: data.fpgaFamily,
        boardType: data.boardType,
        connectionType: data.connectionType,
        devicePath: data.devicePath || null,
        serialPort: data.serialPort || null,
        cameraDevice: data.cameraDevice || null,
        programmingTool: data.programmingTool,
        capabilities: JSON.stringify(data.capabilities),
        sessionTimeoutMinutes: data.sessionTimeoutMinutes,
        status: "free",
      })
      .run();

    return NextResponse.json({ id, message: "Board created" }, { status: 201 });
  } catch (error) {
    console.error("[Admin] Create board error:", error);
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

  db.delete(boards).where(eq(boards.id, id)).run();
  return NextResponse.json({ message: "Board deleted" });
}
