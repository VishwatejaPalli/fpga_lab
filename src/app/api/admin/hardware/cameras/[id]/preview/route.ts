import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import db from "@/lib/db";
import { hardwareDevices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";



export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  // 1. Look up device from hardware_devices table
  const [device] = await db
    .select()
    .from(hardwareDevices)
    .where(eq(hardwareDevices.id, id));

  if (!device || device.type !== "camera") {
    return NextResponse.json({ error: "Camera device not found in registry" }, { status: 404 });
  }

  const targetPath = device.preferredPath || device.deviceNode;

  // 2. Strict Whitelist & Path Verification
  if (!targetPath.startsWith("/dev/video") && !targetPath.startsWith("/dev/v4l/")) {
    return NextResponse.json({ error: "Invalid camera device path" }, { status: 400 });
  }

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json(
      { error: `Camera device node not found at ${targetPath}. Please verify USB cable connection.` },
      { status: 404 }
    );
  }

  // 3. Spawn FFmpeg with 4-second hard timeout
  return new Promise<NextResponse>((resolve) => {
    let hasReturned = false;
    const stderrChunks: string[] = [];
    const stdoutChunks: Buffer[] = [];

    const ffmpeg = spawn("ffmpeg", [
      "-f", "v4l2",
      "-i", targetPath,
      "-vframes", "1",
      "-s", "640x360",
      "-f", "image2",
      "pipe:1",
    ]);

    const timeout = setTimeout(() => {
      if (!hasReturned) {
        hasReturned = true;
        ffmpeg.kill("SIGKILL");
        console.error(`[CameraSnapshot] Timeout capturing snapshot from ${targetPath}`);
        resolve(
          NextResponse.json(
            { error: "Camera snapshot timed out (device may be busy or disconnected)" },
            { status: 504 }
          )
        );
      }
    }, 4000);

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    ffmpeg.on("close", (code) => {
      clearTimeout(timeout);
      if (hasReturned) return;
      hasReturned = true;

      if (code === 0 && stdoutChunks.length > 0) {
        const jpegBuffer = Buffer.concat(stdoutChunks);
        resolve(
          new NextResponse(new Uint8Array(jpegBuffer), {
            status: 200,
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "X-Camera-Identity": device.id,
            },
          })
        );
      } else {
        const errLog = stderrChunks.join("\n");
        console.error(`[CameraSnapshot] FFmpeg exit code ${code} for ${targetPath}:`, errLog);
        resolve(
          NextResponse.json(
            {
              error: "Failed to capture camera snapshot",
              details: errLog.slice(-300),
            },
            { status: 500 }
          )
        );
      }
    });

    ffmpeg.on("error", (err) => {
      clearTimeout(timeout);
      if (hasReturned) return;
      hasReturned = true;
      console.error(`[CameraSnapshot] Spawn error for ${targetPath}:`, err.message);
      resolve(
        NextResponse.json(
          { error: `Camera process error: ${err.message}` },
          { status: 500 }
        )
      );
    });
  });
}
