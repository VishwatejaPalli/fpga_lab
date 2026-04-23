import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { sqlite } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoleConfig } from "@/lib/roles";

// GET — list reservations
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canReserveBoards)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "mine";

  let rows;
  if (scope === "all") {
    rows = sqlite
      .prepare(
        `SELECT r.*, b.name as board_name, u.name as user_name
         FROM board_reservations r
         JOIN boards b ON r.board_id = b.id
         JOIN users u ON r.user_id = u.id
         WHERE r.ends_at > datetime('now') AND r.status = 'confirmed'
         ORDER BY r.starts_at ASC`
      )
      .all();
  } else {
    rows = sqlite
      .prepare(
        `SELECT r.*, b.name as board_name
         FROM board_reservations r
         JOIN boards b ON r.board_id = b.id
         WHERE r.user_id = ? AND r.status = 'confirmed'
         ORDER BY r.starts_at ASC`
      )
      .all(session.userId);
  }

  return NextResponse.json({ reservations: rows });
}

// POST — create reservation
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canReserveBoards)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const { boardId, startsAt, endsAt, purpose } = await req.json();
  if (!boardId || !startsAt || !endsAt)
    return NextResponse.json({ error: "Board, start, and end time required" }, { status: 400 });

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (start < new Date())
    return NextResponse.json({ error: "Cannot reserve in the past" }, { status: 400 });
  if (end <= start)
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  const hrs = (end.getTime() - start.getTime()) / 3600000;
  if (hrs > 4)
    return NextResponse.json({ error: "Max 4 hours per reservation" }, { status: 400 });

  // Check board exists
  const board = sqlite.prepare("SELECT id FROM boards WHERE id = ?").get(boardId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  // Check overlap
  const conflict = sqlite
    .prepare(
      `SELECT id FROM board_reservations
       WHERE board_id = ? AND status = 'confirmed'
       AND starts_at < ? AND ends_at > ?`
    )
    .get(boardId, endsAt, startsAt);
  if (conflict)
    return NextResponse.json({ error: "Time slot conflicts with existing reservation" }, { status: 409 });

  // Max 5 active reservations
  const count = (sqlite
    .prepare(
      "SELECT COUNT(*) as c FROM board_reservations WHERE user_id = ? AND status = 'confirmed' AND ends_at > datetime('now')"
    )
    .get(session.userId) as any)?.c || 0;
  if (count >= 5)
    return NextResponse.json({ error: "Maximum 5 active reservations" }, { status: 400 });

  const id = uuid();
  sqlite
    .prepare(
      `INSERT INTO board_reservations (id, user_id, board_id, starts_at, ends_at, purpose)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, session.userId, boardId, startsAt, endsAt, purpose || "");

  return NextResponse.json({ success: true, id });
}

// DELETE — cancel reservation
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Reservation ID required" }, { status: 400 });

  sqlite
    .prepare("UPDATE board_reservations SET status = 'cancelled' WHERE id = ? AND user_id = ?")
    .run(id, session.userId);
  return NextResponse.json({ success: true });
}
