import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";

/**
 * Camera Service — manages ffmpeg MJPEG streams for monitoring FPGA boards.
 */
class CameraService extends EventEmitter {
  private streams = new Map<
    string,
    {
      process: ChildProcess;
      clients: Set<(chunk: Buffer) => void>;
    }
  >();

  /**
   * Start a camera stream for a board.
   */
  start(boardId: string, cameraDevice: string) {
    if (this.streams.has(boardId)) {
      console.log(`[Camera] Stream already active for board ${boardId}`);
      return;
    }

    const ffmpeg = spawn("ffmpeg", [
      "-f",
      "v4l2",
      "-i",
      cameraDevice,
      "-f",
      "mjpeg",
      "-q:v",
      "5",
      "-r",
      "15",
      "-s",
      "640x480",
      "pipe:1",
    ]);

    const clients = new Set<(chunk: Buffer) => void>();

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      for (const client of clients) {
        try {
          client(chunk);
        } catch {
          clients.delete(client);
        }
      }
    });

    ffmpeg.stderr.on("data", (_data: Buffer) => {
      // ffmpeg logs to stderr, ignore in production
    });

    ffmpeg.on("close", () => {
      console.log(`[Camera] Stream ended for board ${boardId}`);
      this.streams.delete(boardId);
    });

    ffmpeg.on("error", (err) => {
      console.error(`[Camera] Stream error for board ${boardId}:`, err.message);
      this.streams.delete(boardId);
    });

    this.streams.set(boardId, { process: ffmpeg, clients });
    console.log(`[Camera] Started stream for board ${boardId} (${cameraDevice})`);
  }

  /**
   * Subscribe to a board's camera stream.
   */
  subscribe(boardId: string, callback: (chunk: Buffer) => void): () => void {
    const stream = this.streams.get(boardId);
    if (!stream) return () => {};

    stream.clients.add(callback);
    return () => {
      stream.clients.delete(callback);
    };
  }

  /**
   * Stop a camera stream for a board.
   */
  stop(boardId: string) {
    const stream = this.streams.get(boardId);
    if (!stream) return;

    stream.process.kill("SIGTERM");
    stream.clients.clear();
    this.streams.delete(boardId);
    console.log(`[Camera] Stopped stream for board ${boardId}`);
  }

  /**
   * Check if a stream is active for a board.
   */
  isActive(boardId: string): boolean {
    return this.streams.has(boardId);
  }

  /**
   * Stop all camera streams.
   */
  stopAll() {
    for (const [boardId] of this.streams) {
      this.stop(boardId);
    }
  }
}

export const cameraService = new CameraService();
