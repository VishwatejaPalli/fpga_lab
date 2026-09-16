import { EventEmitter } from "events";
import { Client, type ClientChannel } from "ssh2";

/**
 * SSH Service — manages SSH connections to network-attached FPGA boards.
 * Opens SSH sessions and forwards PTY data to WebSocket clients.
 */
class SSHService extends EventEmitter {
  private clients = new Map<
    string,
    {
      client: Client;
      stream: ClientChannel;
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

    let target;
    try {
      const { PynqConnectionManager } = await import("./connection-manager");
      target = await PynqConnectionManager.resolveTarget(boardId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[SSH] Target resolution failed for board ${boardId}:`, message);
      return;
    }

    const ipAddress = target.ipAddress;
    const username = target.sshUsername;
    const password = target.sshPassword || "xilinx";

    try {
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
          client.shell((err: Error | undefined, stream: ClientChannel) => {
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

    // Defense-in-depth note: Client-side PTY character inspection cannot guarantee 100%
    // prevention against advanced shell escaping, aliases, or binary encoding.
    // Production PYNQ boards should enforce rbash (restricted bash) and strict sudoers.
    // Dangerous binary/command patterns (including full paths and network shells)
    const dangerousPattern = /(?:^|[\s;&|`$()<>])(?:\/(?:usr\/)?(?:s?bin)\/)?(sudo|su|reboot|shutdown|poweroff|halt|init|rm|mkfs|dd|chown|chmod|chroot|systemctl|service|wget|curl|nc|ncat|netcat|socat|python[0-9.]* -c|perl -e|ruby -e|bash -i|sh -i)\b/i;

    for (const char of data) {
      if (char === '\r' || char === '\n') {
        // Strip out common PTY ANSI escape sequences
        const cleanCmd = entry.inputBuffer
          .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
          .replace(/\x1b/g, "")
          .trim();

        if (dangerousPattern.test(cleanCmd)) {
          console.warn(`[SSH] Antigravity Firewall blocked dangerous command on board ${boardId}: ${cleanCmd}`);
          // Send Ctrl+C to cancel the current line on the remote shell
          entry.stream.write("\x03\r\n\x1b[31m[Antigravity SSH Firewall: Command Blocked for Security]\x1b[0m\r\n");
          entry.inputBuffer = "";
          continue; // Block execution of the newline, skip to next char
        }
        
        // Command is safe, write the newline
        entry.inputBuffer = "";
        entry.stream.write(char);
      } else if (char === '\x7f' || char === '\b') {
        // Handle backspace locally for buffer tracking
        entry.inputBuffer = entry.inputBuffer.slice(0, -1);
        entry.stream.write(char);
      } else {
        // Only track printable characters for safety check
        if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) {
          entry.inputBuffer += char;
        }
        // Echo character immediately for interactive feel
        entry.stream.write(char);
      }
    }
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
