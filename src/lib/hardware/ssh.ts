import { EventEmitter } from "events";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";

/**
 * SSH Service — manages SSH connections to network-attached FPGA boards.
 * Opens SSH sessions and forwards PTY data to WebSocket clients.
 *
 * Note: The 'ssh2' package requires native bindings.
 * This module dynamically imports it so the server can start even if
 * it's not available (e.g., in CI/build environments).
 */
class SSHService extends EventEmitter {
  private clients = new Map<
    string,
    {
      client: any;
      stream: any;
      inputBuffer: string;
    }
  >();

  /**
   * Open an SSH connection for a board.
   */
  async open(boardId: string) {
    if (this.clients.has(boardId)) {
      console.log(`[SSH] Connection already open for board ${boardId}`);
      return;
    }

    const board = db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId))
      .get();

    if (!board || !board.ipAddress) {
      console.warn(`[SSH] IP address not configured for board ${boardId}`);
      return;
    }

    const ipAddress = board.ipAddress;
    const username = board.sshUsername || "xilinx";
    const password = board.sshPassword || "xilinx";

    try {
      // Use eval-require to prevent Turbopack from trying to resolve native modules at build time
      const _require = eval("require") as NodeRequire;
      const { Client } = _require("ssh2");

      const client = new Client();

      client.on("error", (err: Error) => {
        console.error(`[SSH] Error on ${ipAddress}:`, err.message);
        this.emit("error", { boardId, error: err.message });
        this.close(boardId);
      });

      client.on("end", () => {
        console.log(`[SSH] Connection ended: ${ipAddress}`);
        this.close(boardId);
      });

      await new Promise<void>((resolve, reject) => {
        client.on("ready", () => {
          console.log(`[SSH] Client ready for ${ipAddress}`);
          client.shell((err: Error | null, stream: any) => {
            if (err) return reject(err);

            stream.on("data", (data: Buffer) => {
              this.emit("data", { boardId, data: data.toString("utf-8") });
            });

            stream.on("close", () => {
              console.log(`[SSH] Stream closed: ${ipAddress}`);
              this.close(boardId);
            });

            this.clients.set(boardId, { client, stream, inputBuffer: "" });
            resolve();
          });
        });

        client.connect({
          host: ipAddress,
          port: 22,
          username: username,
          password: password,
          readyTimeout: 10000,
        });
      });

      console.log(`[SSH] Opened connection for board ${boardId}`);
    } catch (err) {
      console.error(`[SSH] Failed to open ${ipAddress}:`, err);
      throw err;
    }
  }

  /**
   * Write data to the SSH stream (e.g., from user keyboard input).
   */
  write(boardId: string, data: string) {
    const entry = this.clients.get(boardId);
    if (!entry) return;

    // Buffer accumulation for basic security filter
    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const cmd = entry.inputBuffer.toLowerCase().trim();
        if (
          cmd.includes("reboot") ||
          cmd.includes("shutdown") ||
          cmd.includes("poweroff") ||
          cmd.includes("rm -rf") ||
          cmd.includes("mkfs")
        ) {
          console.warn(`[SSH] Blocked dangerous command on board ${boardId}: ${cmd}`);
          entry.stream.write("\x03\r\n\x1b[31m[Blocked] Dangerous command not allowed.\x1b[0m\r\n");
          entry.inputBuffer = "";
          return; // Skip writing the newline to prevent execution
        }
        entry.inputBuffer = "";
      } else if (char === '\x7f' || char === '\b') {
        entry.inputBuffer = entry.inputBuffer.slice(0, -1);
      } else if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) {
        entry.inputBuffer += char;
      }
    }

    entry.stream.write(data);
  }

  /**
   * Resize the remote PTY window.
   */
  resize(boardId: string, cols: number, rows: number) {
    const entry = this.clients.get(boardId);
    if (!entry) return;

    if (typeof entry.stream.setWindow === "function") {
      entry.stream.setWindow(rows, cols, 0, 0);
    }
  }

  /**
   * Close SSH connection for a board.
   */
  close(boardId: string) {
    const entry = this.clients.get(boardId);
    if (!entry) return;

    try {
      entry.client.end();
    } catch {
      // Ignore close errors
    }
    this.clients.delete(boardId);
    console.log(`[SSH] Closed connection for board ${boardId}`);
  }

  /**
   * Check if a connection is open for a board.
   */
  isOpen(boardId: string): boolean {
    return this.clients.has(boardId);
  }

  /**
   * Close all SSH connections.
   */
  closeAll() {
    for (const [boardId] of this.clients) {
      this.close(boardId);
    }
  }
}

export const sshService = new SSHService();
