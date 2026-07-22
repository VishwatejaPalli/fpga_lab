import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { cameraService } from "@/lib/hardware/camera";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await params;

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId));

  if (!board || !board.cameraDevice) {
    return NextResponse.json({ error: "Camera not available" }, { status: 404 });
  }

  // Start the ffmpeg process to push RTSP to MediaMTX
  cameraService.start(boardId, board.cameraDevice);

  // Return the WebRTC endpoint that the frontend player should connect to
  const baseUrl = process.env.MEDIAMTX_PUBLIC_URL || "http://localhost:8889";
  const webrtcUrl = `${baseUrl}/${boardId}/`;

  return NextResponse.json({ 
    success: true, 
    webrtcUrl,
    message: "WebRTC stream initiated via MediaMTX"
  });
}
