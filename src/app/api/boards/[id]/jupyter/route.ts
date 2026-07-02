import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const board = db.select().from(boards).where(eq(boards.id, id)).get();

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // In a real environment, you might encrypt this or use an internal registry.
  // For now, we return the proxy URL if it fits the PYNQ pattern.
  if (board.boardType.toLowerCase().includes("pynq")) {
      const host = board.ipAddress || board.devicePath;
      if (!host) {
        return NextResponse.json({ error: "IP address not configured for this board" }, { status: 400 });
      }
      const proxyUrl = `http://${host}:9090`;
      return NextResponse.json({ url: proxyUrl });
  }

  return NextResponse.json({ error: "Jupyter not supported on this board type" }, { status: 400 });
}
