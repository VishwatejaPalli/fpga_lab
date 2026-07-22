import { NextResponse } from "next/server";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allBoards = await db
    .select({
      id: boards.id,
      name: boards.name,
      fpgaFamily: boards.fpgaFamily,
      boardType: boards.boardType,
      boardImageUrl: boards.boardImageUrl,
      connectionType: boards.connectionType,
      status: boards.status,
      capabilities: boards.capabilities,
      sessionTimeoutMinutes: boards.sessionTimeoutMinutes,
    })
    .from(boards);

  // Parse capabilities JSON
  const parsed = allBoards.map((b) => ({
    ...b,
    capabilities: JSON.parse(b.capabilities || "[]") as string[],
  }));

  return NextResponse.json({ boards: parsed });
});
