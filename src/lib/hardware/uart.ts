import { EventEmitter } from "events";

/**
 * UART Service — manages serial port connections to FPGA boards.
 * Opens serial ports and forwards data to WebSocket clients.
 *
 * Note: The 'serialport' package requires native bindings.
 * This module dynamically imports it so the server can start even if
 * it's not available (e.g., in CI/build environments).
 */
class UARTService extends EventEmitter {
  private ports = new Map<
    string,
    {
      port: unknown;
      parser: unknown;
    }
  >();

  /**
   * Open a serial connection for a board.
   */
  async open(boardId: string, serialPortPath: string, baudRate = 115200) {
    if (this.ports.has(boardId)) {
      console.log(`[UART] Port already open for board ${boardId}`);
      return;
    }

    try {
      // Use eval-require to prevent Turbopack from trying to resolve native modules at build time
      // eslint-disable-next-line no-eval
      const _require = eval("require") as NodeRequire;
      const { SerialPort } = _require("serialport");
      const { ReadlineParser } = _require("@serialport/parser-readline");

      const port = new SerialPort({
        path: serialPortPath,
        baudRate,
        autoOpen: false,
      });

      const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

      // Forward data
      parser.on("data", (line: string) => {
        this.emit("data", { boardId, data: line + "\n" });
      });

      port.on("error", (err: Error) => {
        console.error(`[UART] Error on ${serialPortPath}:`, err.message);
        this.emit("error", { boardId, error: err.message });
      });

      port.on("close", () => {
        console.log(`[UART] Port closed: ${serialPortPath}`);
        this.ports.delete(boardId);
      });

      // Open port
      await new Promise<void>((resolve, reject) => {
        port.open((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.ports.set(boardId, { port, parser });
      console.log(`[UART] Opened ${serialPortPath} for board ${boardId}`);
    } catch (err) {
      console.error(`[UART] Failed to open ${serialPortPath}:`, err);
      throw err;
    }
  }

  /**
   * Write data to the serial port (e.g., from user keyboard input).
   */
  write(boardId: string, data: string) {
    const entry = this.ports.get(boardId);
    if (!entry) return;

    const port = entry.port as { write: (data: string) => void };
    port.write(data);
  }

  /**
   * Close serial connection for a board.
   */
  close(boardId: string) {
    const entry = this.ports.get(boardId);
    if (!entry) return;

    const port = entry.port as { close: () => void };
    try {
      port.close();
    } catch {
      // Ignore close errors
    }
    this.ports.delete(boardId);
    console.log(`[UART] Closed port for board ${boardId}`);
  }

  /**
   * Check if a port is open for a board.
   */
  isOpen(boardId: string): boolean {
    return this.ports.has(boardId);
  }

  /**
   * Close all ports.
   */
  closeAll() {
    for (const [boardId] of this.ports) {
      this.close(boardId);
    }
  }
}

export const uartService = new UARTService();
