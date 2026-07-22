import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoleConfig } from "@/lib/roles";

interface SessionStatsRow {
  total_sessions: number;
  avg_minutes: number | null;
  total_hours: number | null;
}

interface SummaryRow {
  total_jobs: number;
  success_jobs: number;
  failed_jobs: number;
  boards_used: number;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getRoleConfig(session.role);
  if (!cfg.canViewAnalytics) {
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  // Jobs per day
  const jobsPerDay = await sqlite
    .prepare(
      `SELECT created_at::timestamp::date as day, COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM jobs
      WHERE user_id = ? AND created_at::timestamp > NOW() + CAST(? AS INTERVAL)
      GROUP BY created_at::timestamp::date ORDER BY day ASC`
    )
    .all(session.userId, `-${days} days`);

  // Board usage
  const boardUsage = await sqlite
    .prepare(
      `SELECT b.name as board_name, b.board_type, COUNT(j.id) as job_count,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as success_count,
        AVG(CASE WHEN j.completed_at IS NOT NULL AND j.started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (j.completed_at::timestamp - j.started_at::timestamp))
          ELSE NULL END) as avg_duration_seconds
      FROM jobs j JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ? AND j.created_at::timestamp > NOW() + CAST(? AS INTERVAL)
      GROUP BY j.board_id, b.name, b.board_type ORDER BY job_count DESC`
    )
    .all(session.userId, `-${days} days`);

  // Session stats
  const sessions = await sqlite
    .prepare(
      `SELECT COUNT(*) as total_sessions,
        AVG(EXTRACT(EPOCH FROM (COALESCE(
          CASE WHEN status = 'ended' THEN expires_at::timestamp ELSE NOW() END,
          NOW()
        ) - started_at::timestamp)) / 60) as avg_minutes,
        SUM(EXTRACT(EPOCH FROM (COALESCE(
          CASE WHEN status = 'ended' THEN expires_at::timestamp ELSE NOW() END,
          NOW()
        ) - started_at::timestamp)) / 3600) as total_hours
      FROM hw_sessions
      WHERE user_id = ? AND started_at::timestamp > NOW() + CAST(? AS INTERVAL)`
    )
    .get(session.userId, `-${days} days`) as SessionStatsRow | undefined;

  // Weekly success rate
  const weeklyRate = await sqlite
    .prepare(
      `SELECT to_char(created_at::timestamp, 'YYYY-"W"IW') as week,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        ROUND(CAST(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*) AS numeric), 1) as rate
      FROM jobs
      WHERE user_id = ? AND created_at::timestamp > NOW() + CAST(? AS INTERVAL)
      GROUP BY to_char(created_at::timestamp, 'YYYY-"W"IW') ORDER BY week ASC`
    )
    .all(session.userId, `-${days} days`);

  // Peak hours
  const peakHours = await sqlite
    .prepare(
      `SELECT EXTRACT(HOUR FROM created_at::timestamp)::integer as hour, COUNT(*) as count
      FROM jobs WHERE user_id = ? AND created_at::timestamp > NOW() + CAST(? AS INTERVAL)
      GROUP BY EXTRACT(HOUR FROM created_at::timestamp)::integer ORDER BY hour ASC`
    )
    .all(session.userId, `-${days} days`);

  // Summary
  const summary = await sqlite
    .prepare(
      `SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        COUNT(DISTINCT board_id) as boards_used
      FROM jobs WHERE user_id = ? AND created_at::timestamp > NOW() + CAST(? AS INTERVAL)`
    )
    .get(session.userId, `-${days} days`) as SummaryRow | undefined;

  const totalJobs = summary?.total_jobs ?? 0;
  const successJobs = summary?.success_jobs ?? 0;
  const failedJobs = summary?.failed_jobs ?? 0;
  const boardsUsed = summary?.boards_used ?? 0;

  return NextResponse.json({
    period: { days },
    summary: {
      totalJobs,
      successJobs,
      failedJobs,
      boardsUsed,
      successRate:
        totalJobs > 0
          ? Math.round((successJobs / totalJobs) * 1000) / 10
          : 0,
      totalSessions: sessions?.total_sessions || 0,
      avgSessionMinutes: Math.round(sessions?.avg_minutes || 0),
      totalLabHours: Math.round((sessions?.total_hours || 0) * 10) / 10,
    },
    jobsPerDay,
    boardUsage,
    weeklyRate,
    peakHours,
  });
}
