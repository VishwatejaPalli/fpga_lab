import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

const version = "1.0.0";
const startupTime = Date.now();

export async function GET() {
  try {
    const uptime = Math.floor((Date.now() - startupTime) / 1000);
    
    // Get board counts
    const boards = sqlite
      .prepare("SELECT status, COUNT(*) as count FROM boards GROUP BY status")
      .all() as { status: string; count: number }[];
      
    const boardCounts = {
      total: 0,
      free: 0,
      busy: 0,
      allocated: 0,
      programming: 0,
      offline: 0,
    };
    
    for (const b of boards) {
      const status = b.status as keyof typeof boardCounts;
      if (status in boardCounts) {
        boardCounts[status] = b.count;
      }
      boardCounts.total += b.count;
    }
    
    // Fetch detailed boards list
    const boardList = sqlite
      .prepare("SELECT id, name, board_type, fpga_family, status, connection_type FROM boards")
      .all() as any[];
      
    const formattedBoards = boardList.map((b) => ({
      id: b.id,
      name: b.name,
      boardType: b.board_type,
      fpgaFamily: b.fpga_family,
      status: b.status,
      connectionType: b.connection_type
    }));

    // Fetch detailed recent jobs list
    const recentJobsList = sqlite
      .prepare("SELECT id, bitstream_name, status, board_id, created_at FROM jobs ORDER BY created_at DESC LIMIT 10")
      .all() as any[];
      
    const formattedJobs = recentJobsList.map((j) => ({
      id: j.id,
      bitstreamName: j.bitstream_name,
      status: j.status,
      boardId: j.board_id,
      createdAt: j.created_at
    }));

    // Get active sessions
    const activeSessionsRow = sqlite
      .prepare("SELECT COUNT(*) as count FROM hw_sessions WHERE status = 'active'")
      .get() as { count: number } | undefined;
      
    // Get queue depth
    const queueDepthRow = sqlite
      .prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'")
      .get() as { count: number } | undefined;

    return NextResponse.json({
      status: "healthy",
      version,
      uptime,
      boards: {
        ...boardCounts,
        list: formattedBoards
      },
      activeSessions: activeSessionsRow?.count || 0,
      queueDepth: queueDepthRow?.count || 0,
      recentJobs: formattedJobs
    });
  } catch (err: any) {
    console.error("[Health API] Status check failed:", err.message);
    return NextResponse.json(
      { status: "unhealthy", error: err.message },
      { status: 500 }
    );
  }
}
