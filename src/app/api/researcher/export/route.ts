import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoleConfig } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canExportData)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";
  const type = searchParams.get("type") || "jobs";

  let data: any[];
  let filename: string;

  switch (type) {
    case "jobs":
      data = sqlite
        .prepare(
          `SELECT j.id, j.bitstream_name, j.status, j.logs, j.created_at, j.started_at, j.completed_at,
            b.name as board_name, b.fpga_family, b.board_type
          FROM jobs j LEFT JOIN boards b ON j.board_id = b.id
          WHERE j.user_id = ? ORDER BY j.created_at DESC`
        )
        .all(session.userId);
      filename = `fpga-jobs-${new Date().toISOString().split("T")[0]}`;
      break;

    case "sessions":
      data = sqlite
        .prepare(
          `SELECT hs.id, hs.started_at, hs.expires_at, hs.status,
            b.name as board_name, b.fpga_family
          FROM hw_sessions hs LEFT JOIN boards b ON hs.board_id = b.id
          WHERE hs.user_id = ? ORDER BY hs.started_at DESC`
        )
        .all(session.userId);
      filename = `fpga-sessions-${new Date().toISOString().split("T")[0]}`;
      break;

    case "notes":
      data = sqlite
        .prepare(
          `SELECT id, title, content, tags, job_id, board_id, pinned, created_at, updated_at
          FROM experiment_notes WHERE user_id = ? ORDER BY updated_at DESC`
        )
        .all(session.userId);
      filename = `fpga-notes-${new Date().toISOString().split("T")[0]}`;
      break;

    default:
      return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  if (format === "csv") {
    if (data.length === 0) {
      return new NextResponse("No data to export", {
        headers: { "Content-Type": "text/plain" },
      });
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h] ?? "");
            return val.includes(",") || val.includes('"') || val.includes("\n")
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(",")
      ),
    ];
    return new NextResponse(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
    },
  });
}
