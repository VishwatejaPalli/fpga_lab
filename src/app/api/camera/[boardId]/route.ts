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

  // Start the shared MJPEG stream for the board (if not already active)
  cameraService.start(boardId, board.cameraDevice);

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const boundary = "frame";

      // Subscribe to the shared camera service JPEG broadcast
      unsubscribe = cameraService.subscribe(boardId, (frame: Buffer) => {
        try {
          const header = `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
          controller.enqueue(new TextEncoder().encode(header));
          controller.enqueue(frame);
          controller.enqueue(new TextEncoder().encode("\r\n"));
        } catch {
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
          try {
            controller.close();
          } catch {}
        }
      });
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
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
