import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface ProgramOptions {
  boardType: string; // openFPGALoader board name e.g. "basys3"
  bitstreamPath: string;
  programmingTool?: string; // defaults to "openFPGALoader"
  devicePath?: string | null;
  timeout?: number; // ms, default 120000
}

export interface ProgramResult {
  success: boolean;
  exitCode: number | null;
  logs: string;
  duration: number;
}

/**
 * FPGA Programmer abstraction.
 * Supports openFPGALoader (universal) and can be extended for vendor tools.
 */
export class FPGAProgrammer extends EventEmitter {
  private process: ChildProcess | null = null;

  /**
   * Program an FPGA board. Emits 'log' events for real-time output.
   */
  async program(options: ProgramOptions): Promise<ProgramResult> {
    const {
      boardType,
      bitstreamPath,
      programmingTool = "openFPGALoader",
      devicePath,
      timeout = 120000,
    } = options;

    const startTime = Date.now();
    let logs = "";

    return new Promise((resolve) => {
      const args = this.buildArgs(programmingTool, boardType, bitstreamPath, devicePath);

      this.emit("log", `[FPGA] Starting: ${programmingTool} ${args.join(" ")}\n`);

      this.process = spawn(programmingTool, args, {
        timeout,
        env: { ...process.env },
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        logs += text;
        this.emit("log", text);
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        logs += text;
        this.emit("log", text);
      });

      const timer = setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGTERM");
          this.emit("log", "\n[FPGA] Programming timed out!\n");
        }
      }, timeout);

      this.process.on("close", (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        const success = code === 0;

        this.emit(
          "log",
          `\n[FPGA] Programming ${success ? "succeeded" : "failed"} (exit code: ${code}, ${duration}ms)\n`
        );

        this.process = null;
        resolve({ success, exitCode: code, logs, duration });
      });

      this.process.on("error", (err) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        const errorMsg = `\n[FPGA] Error: ${err.message}\n`;
        logs += errorMsg;
        this.emit("log", errorMsg);
        this.process = null;
        resolve({ success: false, exitCode: null, logs, duration });
      });
    });
  }

  /**
   * Kill the running programming process.
   */
  kill() {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  /**
   * Build command-line arguments based on the programming tool.
   */
  private buildArgs(
    tool: string,
    boardType: string,
    bitstreamPath: string,
    devicePath?: string | null
  ): string[] {
    switch (tool) {
      case "openFPGALoader":
        const args = ["-b", boardType];
        if (devicePath) {
          args.push("-d", devicePath);
        }
        args.push(bitstreamPath);
        return args;

      case "xsct":
        // Xilinx Software Command-line Tool
        // Expects a Tcl script typically
        return ["-eval", `connect; targets; fpga ${bitstreamPath}`];

      case "quartus_pgm":
        // Intel/Altera Programmer
        return ["-m", "jtag", "-o", `P;${bitstreamPath}`];

      default:
        // Generic: just pass the bitstream as argument
        return [bitstreamPath];
    }
  }
}

// Singleton instance
export const programmer = new FPGAProgrammer();
