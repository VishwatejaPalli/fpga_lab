import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import db from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const logs = db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json({ logs });
});
