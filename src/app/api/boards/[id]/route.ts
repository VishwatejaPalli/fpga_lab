import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [board] = await db.select().from(boards).where(eq(boards.id, id));

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({
    board: {
      ...board,
      sshUsername: undefined,
      sshPassword: undefined,
      capabilities: JSON.parse(board.capabilities || "[]"),
    },
  });
}
