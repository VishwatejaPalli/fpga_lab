import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";

/**
 * Camera Service — manages ffmpeg processes for WebRTC streaming via MediaMTX.
 */
class CameraService extends EventEmitter {
  private streams = new Map<string, { process: ChildProcess; isStoppedExplicitly: boolean; retryCount: number }>();

  /**
   * Start a camera stream for a board, pushing RTSP to local MediaMTX.
   */
  start(boardId: string, cameraDevice: string, retryCount = 0) {
    const existing = this.streams.get(boardId);
    if (existing && !existing.isStoppedExplicitly) {
      if (retryCount === 0) {
        console.log(`[Camera] Stream already active for board ${boardId}`);
        return;
      }
    }

    const isWindows = process.platform === "win32";
    const isMock = cameraDevice === "mock" || cameraDevice === "test" || !cameraDevice;
    
    const inputFormat = isMock ? "lavfi" : (isWindows ? "dshow" : "v4l2");
    const inputDevice = isMock 
      ? "testsrc=size=640x480:rate=30" 
      : (isWindows && !cameraDevice.startsWith("video=") ? `video=${cameraDevice}` : cameraDevice);

    // Push H.264 encoded RTSP to MediaMTX
    const ffmpeg = spawn("ffmpeg", [
      "-f", inputFormat,
      "-i", inputDevice,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-b:v", "1000k",
      "-maxrate", "1000k",
      "-bufsize", "2000k",
      "-pix_fmt", "yuv420p",
      "-g", "30",
      "-f", "rtsp",
      "-rtsp_transport", "tcp",
      `rtsp://localhost:8554/${boardId}`
    ]);

    ffmpeg.stderr.on("data", () => {
      // ffmpeg logs to stderr, ignore in production
    });

    ffmpeg.on("close", () => {
      console.log(`[Camera] Stream ended for board ${boardId}`);
      const stream = this.streams.get(boardId);
      if (stream && stream.process === ffmpeg) {
        if (!stream.isStoppedExplicitly && stream.retryCount < 5) {
          console.log(`[Camera] Auto-restarting stream for board ${boardId} (Attempt ${stream.retryCount + 1})`);
          setTimeout(() => this.start(boardId, cameraDevice, stream.retryCount + 1), 3000);
        } else {
          this.streams.delete(boardId);
        }
      }
    });

    ffmpeg.on("error", (err) => {
      console.error(`[Camera] Stream error for board ${boardId}:`, err.message);
    });

    this.streams.set(boardId, { process: ffmpeg, isStoppedExplicitly: false, retryCount });
    console.log(`[Camera] Started WebRTC/RTSP stream for board ${boardId} to MediaMTX`);
  }

  /**
   * Stop a camera stream for a board.
   */
  stop(boardId: string) {
    const stream = this.streams.get(boardId);
    if (!stream) return;

    stream.isStoppedExplicitly = true;
    stream.process.kill("SIGTERM");
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
