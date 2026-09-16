import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";
import db from "@/lib/db";
import { hardwareDevices, boards } from "@/lib/db/schema";
import { syncHardwareRegistry } from "@/lib/hardware/device-registry";
import { eq } from "drizzle-orm";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const devices = await db.select().from(hardwareDevices);
  const allBoards = await db.select({ id: boards.id, name: boards.name }).from(boards);
  const boardNameMap = new Map(allBoards.map((b) => [b.id, b.name]));

  const enriched = devices.map((d) => ({
    ...d,
    capabilities: d.capabilities ? JSON.parse(d.capabilities) : [],
    assignedBoardName: d.assignedBoardId ? boardNameMap.get(d.assignedBoardId) || null : null,
  }));

  return NextResponse.json({ devices: enriched });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updatedDevices = await syncHardwareRegistry();
  const allBoards = await db.select({ id: boards.id, name: boards.name }).from(boards);
  const boardNameMap = new Map(allBoards.map((b) => [b.id, b.name]));

  const enriched = updatedDevices.map((d) => ({
    ...d,
    capabilities: d.capabilities ? JSON.parse(d.capabilities) : [],
    assignedBoardName: d.assignedBoardId ? boardNameMap.get(d.assignedBoardId) || null : null,
  }));

  return NextResponse.json({
    message: "Hardware registry synchronized successfully",
    devices: enriched,
  });
});
