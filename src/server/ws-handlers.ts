import { WebSocket } from "ws";
import { EventEmitter } from "events";

interface GlobalUARTService extends EventEmitter {
  open(boardId: string): Promise<void>;
  write(boardId: string, data: string): void;
}

interface GlobalSSHService extends EventEmitter {
  open(boardId: string): Promise<void>;
  write(boardId: string, data: string): void;
  resize(boardId: string, cols: number, rows: number): void;
}

interface GlobalJobQueue extends EventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): this;
}

interface GlobalCameraService {
  subscribe?: (boardId: string, callback: (frame: Buffer) => void) => () => void;
}

export function handleUartConnection(ws: WebSocket, boardId: string): void {
  const uartService = (globalThis as unknown as { __uartService?: GlobalUARTService }).__uartService;
  if (uartService) {
    uartService.open(boardId).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[WS] Could not open UART for ${boardId}:`, message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "uart-error", error: message }));
      }
    });

    const onData = ({ boardId: bId, data }: { boardId: string; data: string }) => {
      if (bId === boardId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "uart-data", data }));
      }
    };
    uartService.on("data", onData as (...args: unknown[]) => void);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "uart-input" && msg.data) {
          uartService.write(boardId, msg.data);
        }
      } catch {
        uartService.write(boardId, raw.toString());
      }
    });

    ws.on("close", () => {
      uartService.removeListener("data", onData as (...args: unknown[]) => void);
    });
  } else {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "uart-error", error: "UART service unavailable" }));
    }
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }, 500);
  }
}

export function handleSshConnection(ws: WebSocket, boardId: string): void {
  const sshService = (globalThis as unknown as { __sshService?: GlobalSSHService }).__sshService;
  if (sshService) {
    sshService.open(boardId).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[WS] Could not open SSH for ${boardId}:`, message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ssh-error", error: message }));
      }
    });

    const onData = ({ boardId: bId, data }: { boardId: string; data: string }) => {
      if (bId === boardId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ssh-data", data }));
      }
    };
    sshService.on("data", onData as (...args: unknown[]) => void);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ssh-input" && msg.data) {
          sshService.write(boardId, msg.data);
        } else if (msg.type === "ssh-resize" && msg.cols && msg.rows) {
          sshService.resize(boardId, msg.cols, msg.rows);
        }
      } catch {
        sshService.write(boardId, raw.toString());
      }
    });

    ws.on("close", () => {
      sshService.removeListener("data", onData as (...args: unknown[]) => void);
    });
  } else {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ssh-error", error: "SSH service unavailable" }));
    }
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }, 500);
  }
}

export function handleLogsConnection(ws: WebSocket, jobId: string): void {
  const jobQueue = (globalThis as unknown as { __jobQueue?: GlobalJobQueue }).__jobQueue;
  if (jobQueue) {
    const onLog = (data: { jobId: string; text: string }) => {
      if (data.jobId === jobId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "job-log", data: data.text }));
      }
    };

    const onComplete = (data: { jobId: string; success: boolean; sessionId?: string }) => {
      if (data.jobId === jobId && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "job-complete",
            success: data.success,
            sessionId: data.sessionId || null,
          })
        );
      }
    };

    jobQueue.on("job-log", onLog as (...args: unknown[]) => void);
    jobQueue.on("job-complete", onComplete as (...args: unknown[]) => void);

    ws.on("close", () => {
      jobQueue.removeListener("job-log", onLog as (...args: unknown[]) => void);
      jobQueue.removeListener("job-complete", onComplete as (...args: unknown[]) => void);
    });
  }
}

export function handleCameraConnection(ws: WebSocket, boardId: string): void {
  const cameraService = (globalThis as unknown as { __cameraService?: GlobalCameraService }).__cameraService;
  let unsubscribe: (() => void) | undefined;

  if (cameraService && typeof cameraService.subscribe === "function") {
    try {
      unsubscribe = cameraService.subscribe(boardId, (frame: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(frame, { binary: true });
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[WS] Could not subscribe to camera for ${boardId}:`, message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "camera-error", error: message }));
      }
    }
  } else {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "camera-info", message: "RTSP/WebRTC stream active on MediaMTX" }));
    }
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close(1000, "Camera stream served via WebRTC");
    }, 500);
  }

  ws.on("close", () => {
    if (unsubscribe) unsubscribe();
  });
}
