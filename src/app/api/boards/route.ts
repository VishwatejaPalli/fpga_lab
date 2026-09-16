import { NextResponse } from "next/server";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";
import { v4 as uuid } from "uuid";

export const GET = withErrorHandler(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let allBoards = await db
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

  // If no boards exist in DB, seed default virtual & demo boards
  if (allBoards.length === 0) {
    const defaultBoards = [
      {
        id: uuid(),
        name: "Spartan-3E Starter Board",
        fpgaFamily: "Xilinx Spartan-3E",
        boardType: "spartan3e",
        boardImageUrl: "/spartan3e.jpg",
        connectionType: "jtag" as const,
        status: "free" as const,
        programmingTool: "demo",
        capabilities: JSON.stringify(["led", "uart", "switches", "buttons", "display"]),
        sessionTimeoutMinutes: 30,
      },
      {
        id: uuid(),
        name: "Basys 3 Trainer Board",
        fpgaFamily: "Xilinx Artix-7",
        boardType: "basys3",
        connectionType: "jtag" as const,
        status: "free" as const,
        programmingTool: "openFPGALoader",
        capabilities: JSON.stringify(["led", "uart", "switches", "buttons", "display"]),
        sessionTimeoutMinutes: 30,
      },
      {
        id: uuid(),
        name: "PYNQ-Z2 Board",
        fpgaFamily: "Xilinx Zynq-7000",
        boardType: "pynq-z2",
        connectionType: "network" as const,
        status: "free" as const,
        programmingTool: "pynq_ssh",
        capabilities: JSON.stringify(["led", "uart", "ethernet", "python"]),
        sessionTimeoutMinutes: 45,
      },
    ];

    for (const b of defaultBoards) {
      await db.insert(boards).values(b);
    }

    allBoards = await db
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
  }

  // Parse capabilities JSON
  const parsed = allBoards.map((b) => ({
    ...b,
    capabilities: JSON.parse(b.capabilities || "[]") as string[],
  }));

  return NextResponse.json({ boards: parsed });
});
