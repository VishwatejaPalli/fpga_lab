import { spawn } from "child_process";

export interface ResetOptions {
  boardType: string;
  programmingTool?: string;
  devicePath?: string | null;
}

/**
 * Reset an FPGA board after a session ends.
 * Uses openFPGALoader --reset or vendor-specific reset commands.
 */
export async function resetBoard(options: ResetOptions): Promise<boolean> {
  const { boardType, programmingTool = "openFPGALoader", devicePath } = options;

  return new Promise((resolve) => {
    let args: string[];

    if (programmingTool === "openFPGALoader") {
      args = ["-b", boardType, "--reset"];
      if (devicePath) {
        args.splice(2, 0, "-d", devicePath);
      }
    } else {
      // Generic reset attempt
      args = ["--reset"];
    }

    console.log(`[FPGA] Resetting board: ${programmingTool} ${args.join(" ")}`);

    const proc = spawn(programmingTool, args, { timeout: 30000 });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log("[FPGA] Board reset successfully");
        resolve(true);
      } else {
        console.warn(`[FPGA] Board reset failed (exit code: ${code})`);
        resolve(false);
      }
    });

    proc.on("error", (err) => {
      console.error("[FPGA] Reset spawn error:", err.message);
      resolve(false);
    });
  });
}
