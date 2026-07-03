import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  fetchPynqTelemetry,
  checkPynqOnline,
} from "@/lib/hardware/pynq-telemetry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await params;

  try {
    const telemetry = await fetchPynqTelemetry(boardId);

    return NextResponse.json({
      status: "online",
      telemetry,
    });
  } catch (err: any) {
    console.error(`[PYNQ] Telemetry fetch failed for ${boardId}:`, err.message);

    // Try a simple connectivity check
    const online = await checkPynqOnline(boardId);

    return NextResponse.json(
      {
        status: online ? "degraded" : "offline",
        error: err.message,
        telemetry: null,
      },
      { status: online ? 200 : 503 }
    );
  }
}
