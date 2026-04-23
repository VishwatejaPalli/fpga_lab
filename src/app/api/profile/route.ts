import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import db from "@/lib/db";
import { users, jobs, hwSessions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      verified: users.verified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get usage stats
  const [jobStats] = await db
    .select({
      totalJobs: sql<number>`count(*)`,
      successJobs: sql<number>`sum(case when ${jobs.status} = 'success' then 1 else 0 end)`,
      failedJobs: sql<number>`sum(case when ${jobs.status} = 'failed' then 1 else 0 end)`,
    })
    .from(jobs)
    .where(eq(jobs.userId, session.userId));

  const [sessionStats] = await db
    .select({
      totalSessions: sql<number>`count(*)`,
    })
    .from(hwSessions)
    .where(eq(hwSessions.userId, session.userId));

  return NextResponse.json({
    user,
    stats: {
      totalJobs: jobStats?.totalJobs ?? 0,
      successJobs: jobStats?.successJobs ?? 0,
      failedJobs: jobStats?.failedJobs ?? 0,
      totalSessions: sessionStats?.totalSessions ?? 0,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, currentPassword, newPassword } = body;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Update name if provided
  if (name && typeof name === "string" && name.trim().length > 0) {
    await db
      .update(users)
      .set({ name: name.trim() })
      .where(eq(users.id, session.userId));
  }

  // Update password if provided
  if (currentPassword && newPassword) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash: hash })
      .where(eq(users.id, session.userId));
  }

  return NextResponse.json({ ok: true });
}
