import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { sqlite } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoleConfig } from "@/lib/roles";

interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
  job_id?: string | null;
  board_id?: string | null;
}

// GET — list notes
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canUseNotebooks)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");

  let query = "SELECT * FROM experiment_notes WHERE user_id = ?";
  const params: string[] = [session.userId];

  if (tag) {
    query += " AND tags LIKE ?";
    params.push(`%${tag}%`);
  }
  query += " ORDER BY pinned DESC, updated_at DESC";

  const notes = sqlite.prepare(query).all(...params) as NoteRow[];
  const parsed = notes.map((n) => ({
    ...n,
    tags: (() => {
      try { return JSON.parse(n.tags || "[]"); } catch { return []; }
    })(),
  }));

  return NextResponse.json({ notes: parsed });
}

// POST — create note
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canUseNotebooks)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const body = await req.json();
  const { title, content, jobId, boardId, tags } = body;
  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const id = uuid();
  sqlite
    .prepare(
      `INSERT INTO experiment_notes (id, user_id, job_id, board_id, title, content, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, session.userId, jobId || null, boardId || null, title.trim(), content || "", JSON.stringify(tags || []));

  return NextResponse.json({ success: true, id });
}

// PUT — update note
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canUseNotebooks)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const body = await req.json();
  const { id, title, content, tags, pinned } = body;
  if (!id) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

  // Verify ownership
  const note = sqlite.prepare("SELECT id FROM experiment_notes WHERE id = ? AND user_id = ?").get(id, session.userId);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: string[] = ["updated_at = datetime('now')"];
  const params: (string | number)[] = [];

  if (title !== undefined) { updates.push("title = ?"); params.push(title); }
  if (content !== undefined) { updates.push("content = ?"); params.push(content); }
  if (tags !== undefined) { updates.push("tags = ?"); params.push(JSON.stringify(tags)); }
  if (pinned !== undefined) { updates.push("pinned = ?"); params.push(pinned ? 1 : 0); }

  params.push(id, session.userId);
  sqlite.prepare(`UPDATE experiment_notes SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).run(...params);

  return NextResponse.json({ success: true });
}

// DELETE — delete note
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

  sqlite.prepare("DELETE FROM experiment_notes WHERE id = ? AND user_id = ?").run(id, session.userId);
  return NextResponse.json({ success: true });
}
