import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import db from "@/lib/db";
import { sql } from "drizzle-orm";
import { jobs, hwSessions, boards } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Weekly FPGA Sessions by Day of Week (Last 7 Days)
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const recentSessionsRes = await db.execute(sql`
      SELECT 
        to_char(started_at::timestamptz, 'Dy') as day_name,
        EXTRACT(DOW FROM started_at::timestamptz) as dow,
        count(*)::int as count
      FROM hw_sessions
      WHERE started_at::timestamptz >= NOW() - INTERVAL '7 days'
      GROUP BY day_name, dow
      ORDER BY dow ASC
    `);

    const dayMap = new Map<string, number>();
    for (const row of recentSessionsRes.rows as any[]) {
      if (row.day_name) {
        dayMap.set(row.day_name.trim(), row.count);
      }
    }

    // Default last 7 days window
    const fpgaUsageData = daysOfWeek.map((d) => ({
      day: d,
      sessions: dayMap.get(d) || 0,
    }));

    // 2. Board Utilization (Jobs run per board)
    const boardUtilRes = await db.execute(sql`
      SELECT 
        b.name as board_name,
        count(j.id)::int as run_count
      FROM boards b
      LEFT JOIN jobs j ON j.board_id = b.id
      GROUP BY b.id, b.name
      ORDER BY run_count DESC
      LIMIT 10
    `);

    const boardUtilizationData = (boardUtilRes.rows as any[]).map((r) => ({
      board: r.board_name || "Unknown",
      runs: r.run_count || 0,
    }));

    // 3. User Activity by Time of Day (Hourly distribution)
    const hourlyRes = await db.execute(sql`
      SELECT 
        to_char(date_trunc('hour', started_at::timestamptz), 'HH24:00') as hour_block,
        count(*)::int as active_count
      FROM hw_sessions
      WHERE started_at::timestamptz >= NOW() - INTERVAL '30 days'
      GROUP BY hour_block
      ORDER BY hour_block ASC
    `);

    const standardHours = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
    const hourMap = new Map<string, number>();
    for (const row of hourlyRes.rows as any[]) {
      if (row.hour_block) hourMap.set(row.hour_block.trim(), row.active_count);
    }
    const userActivityData = standardHours.map((h) => ({
      time: h,
      active: hourMap.get(h) || 0,
    }));

    // 4. Session Duration Distribution (<10m, 10-30m, 30-60m, 1-2h, >2h)
    const durationRes = await db.execute(sql`
      SELECT 
        CASE 
          WHEN EXTRACT(EPOCH FROM (expires_at::timestamptz - started_at::timestamptz)) / 60 < 10 THEN '< 10m'
          WHEN EXTRACT(EPOCH FROM (expires_at::timestamptz - started_at::timestamptz)) / 60 BETWEEN 10 AND 30 THEN '10-30m'
          WHEN EXTRACT(EPOCH FROM (expires_at::timestamptz - started_at::timestamptz)) / 60 BETWEEN 31 AND 60 THEN '30-60m'
          WHEN EXTRACT(EPOCH FROM (expires_at::timestamptz - started_at::timestamptz)) / 60 BETWEEN 61 AND 120 THEN '1-2h'
          ELSE '> 2h'
        END as duration_bucket,
        count(*)::int as count
      FROM hw_sessions
      GROUP BY duration_bucket
    `);

    const durationBuckets = ["< 10m", "10-30m", "30-60m", "1-2h", "> 2h"];
    const durationMap = new Map<string, number>();
    for (const row of durationRes.rows as any[]) {
      if (row.duration_bucket) durationMap.set(row.duration_bucket, row.count);
    }
    const sessionDurationData = durationBuckets.map((b) => ({
      duration: b,
      count: durationMap.get(b) || 0,
    }));

    // 5. Job Execution Status Distribution
    const jobStatsRes = await db.execute(sql`
      SELECT 
        status,
        count(*)::int as count
      FROM jobs
      GROUP BY status
    `);

    const statusMap = new Map<string, number>();
    for (const row of jobStatsRes.rows as any[]) {
      if (row.status) statusMap.set(row.status, row.count);
    }

    const reservationStatsData = [
      { status: "Completed", count: statusMap.get("success") || 0 },
      { status: "Queued / Active", count: (statusMap.get("queued") || 0) + (statusMap.get("programming") || 0) },
      { status: "Failed", count: statusMap.get("failed") || 0 },
    ];

    return NextResponse.json({
      fpgaUsageData,
      boardUtilizationData,
      userActivityData,
      sessionDurationData,
      reservationStatsData,
    });
  } catch (error: any) {
    console.error("[Admin Analytics API] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}
