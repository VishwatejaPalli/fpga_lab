import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { synthesisJobs } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Job ID required" }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(synthesisJobs)
    .where(eq(synthesisJobs.id, jobId));

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Allow only the owner or admins to read the job status
  if (job.userId !== session.userId && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if a compiled bitstream exists in the uploads directory
  let bitstreamPath = null;
  let bitstreamName = null;
  try {
    const bitstreamDir = path.join(process.cwd(), "uploads", job.userId, job.id);
    if (fs.existsSync(bitstreamDir)) {
      const files = fs.readdirSync(bitstreamDir);
      const bitFile = files.find((f: string) => f.endsWith(".bit") || f.endsWith(".bin"));
      if (bitFile) {
        bitstreamPath = path.join("uploads", job.userId, job.id, bitFile);
        bitstreamName = bitFile;
      }
    }
  } catch (err) {}

  let placement = null;
  if (job.areaReport && job.areaReport.includes("JSON_PLACEMENT_DATA:")) {
    try {
      const parts = job.areaReport.split("JSON_PLACEMENT_DATA:");
      if (parts[1]) {
        placement = JSON.parse(parts[1].trim());
      }
    } catch (e) {}
  }

  return NextResponse.json({
    success: true,
    jobId: job.id,
    status: job.status,
    logs: job.logs,
    bitstreamPath,
    bitstreamName,
    reports: {
      schematic: job.schematic,
      timing: job.timingReport,
      power: job.powerReport,
      area: job.areaReport,
      waveform: job.waveformData,
      placement,
    },
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}
