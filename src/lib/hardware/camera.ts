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

    const isWindows = process.platform === "win32";
    const inputFormat = isWindows ? "dshow" : "v4l2";
    // DirectShow requires video= prefix on Windows
    const inputDevice = isWindows && !cameraDevice.startsWith("video=")
      ? `video=${cameraDevice}`
      : cameraDevice;

    const ffmpeg = spawn("ffmpeg", [
      "-f",
      inputFormat,
      "-i",
      inputDevice,
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

    // Buffer to reconstruct full JPEG frames (SOI 0xFFD8 to EOI 0xFFD9)
    let buffer = Buffer.alloc(0);

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (true) {
        const startIndex = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        if (startIndex === -1) {
          // If no SOI is found, discard the buffer except the last byte (in case it is part of 0xffd8)
          if (buffer.length > 1) {
            buffer = buffer.subarray(buffer.length - 1);
          }
          break;
        }

        // Align buffer to the start of the JPEG image
        if (startIndex > 0) {
          buffer = buffer.subarray(startIndex);
        }

        const endIndex = buffer.indexOf(Buffer.from([0xff, 0xd9]), 2);
        if (endIndex === -1) {
          // Waiting for more chunks to finish the frame
          break;
        }

        // Extract complete frame
        const frame = buffer.subarray(0, endIndex + 2);
        buffer = buffer.subarray(endIndex + 2);

        // Broadcast the frame to all subscribed clients
        for (const client of clients) {
          try {
            client(frame);
          } catch {
            clients.delete(client);
          }
        }
      }
    });

    ffmpeg.stderr.on("data", () => {
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
      // Auto-stop the stream if no subscribers left
      if (stream.clients.size === 0) {
        this.stop(boardId);
      }
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
