import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { spawn } from "child_process";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { boardId } = await params;

  const board = db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .get();

  if (!board || !board.cameraDevice) {
    return new NextResponse("Camera not available", { status: 404 });
  }

  // Start MJPEG stream using ffmpeg
  const ffmpeg = spawn("ffmpeg", [
    "-f", "v4l2",
    "-i", board.cameraDevice,
    "-f", "mjpeg",
    "-q:v", "5",
    "-r", "15",
    "-s", "640x480",
    "pipe:1",
  ]);

  const stream = new ReadableStream({
    start(controller) {
      const boundary = "frame";

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        try {
          const header = `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${chunk.length}\r\n\r\n`;
          controller.enqueue(new TextEncoder().encode(header));
          controller.enqueue(chunk);
          controller.enqueue(new TextEncoder().encode("\r\n"));
        } catch {
          // Stream closed
        }
      });

      ffmpeg.stderr.on("data", (_data: Buffer) => {
        // ffmpeg logs to stderr, ignore
      });

      ffmpeg.on("close", () => {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      ffmpeg.on("error", () => {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      ffmpeg.kill("SIGTERM");
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
