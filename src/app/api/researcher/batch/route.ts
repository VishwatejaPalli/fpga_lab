import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { sqlite } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoleConfig } from "@/lib/roles";
import { runDemoJob } from "@/lib/fpga/demo-runner";

interface BoardRow {
  id: string;
  status: string;
}

interface CountRow {
  c: number;
}

// GET — list user's batch jobs with constituent sub-jobs
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canBatchProgram)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const batches = await sqlite
    .prepare("SELECT * FROM batch_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(session.userId);

  const batchesWithJobs = await Promise.all(
    batches.map(async (batch: any) => {
      const jobs = await sqlite
        .prepare(`
          SELECT j.id, j.board_id, j.status, j.created_at, j.completed_at, b.name as board_name
          FROM jobs j
          JOIN boards b ON j.board_id = b.id
          WHERE j.batch_id = ?
        `)
        .all(batch.id);
      return { ...batch, jobs };
    })
  );

  return NextResponse.json({ batches: batchesWithJobs });
}

// POST — batch program multiple boards
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canBatchProgram)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const { name, boardIds, bitstreamPath, bitstreamName } = await req.json();

  if (!boardIds || !Array.isArray(boardIds) || boardIds.length === 0)
    return NextResponse.json({ error: "At least one board required" }, { status: 400 });
  if (!bitstreamPath || !bitstreamName)
    return NextResponse.json({ error: "Bitstream required" }, { status: 400 });
  if (boardIds.length > 10)
    return NextResponse.json({ error: "Max 10 boards per batch" }, { status: 400 });

  const batchId = uuid();
  await sqlite
    .prepare("INSERT INTO batch_jobs (id, user_id, name, status, total_boards) VALUES (?, ?, ?, 'running', ?)")
    .run(batchId, session.userId, name || "Batch Programming", boardIds.length);

  const jobIds: string[] = [];
  for (const boardId of boardIds) {
    const board = await sqlite
      .prepare("SELECT id, status FROM boards WHERE id = ?")
      .get(boardId) as BoardRow | undefined;
    if (!board) continue;

    const jobId = uuid();
    jobIds.push(jobId);

    await sqlite
      .prepare(
        "INSERT INTO jobs (id, user_id, board_id, bitstream_path, bitstream_name, status, batch_id) VALUES (?, ?, ?, ?, ?, 'queued', ?)"
      )
      .run(jobId, session.userId, boardId, bitstreamPath, bitstreamName, batchId);

    // Kick off programming in background
    if (board.status === "free") {
      runDemoJob(jobId, boardId, session.userId, bitstreamName).catch((err) => {
        console.error("[Batch] Programming error:", err);
      });
    }
  }

  // Update batch progress in background
  setTimeout(async () => {
    const done = await sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM jobs WHERE batch_id = ? AND status IN ('success','failed')"
      )
      .get(batchId) as CountRow | undefined;
    const completedCount = done?.c ?? 0;
    if (completedCount >= boardIds.length) {
      await sqlite.prepare("UPDATE batch_jobs SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(batchId);
    }
  }, 30000);

  return NextResponse.json({ success: true, batchId, jobIds });
}
