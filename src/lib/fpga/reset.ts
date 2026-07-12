import { spawn } from "child_process";

export interface ResetOptions {
  boardType: string;
  programmingTool?: string;
  devicePath?: string | null;
  ipAddress?: string | null;
}

/**
 * Reset an FPGA board after a session ends.
 * Uses openFPGALoader --reset or vendor-specific reset/SSH commands.
 */
export async function resetBoard(options: ResetOptions): Promise<boolean> {
  const { boardType, programmingTool = "openFPGALoader", devicePath, ipAddress } = options;

  return new Promise((resolve) => {
    if (programmingTool === "pynq_ssh") {
      if (!ipAddress) {
        console.warn("[FPGA] Error: IP Address is required to reset a PYNQ board over SSH");
        resolve(false);
        return;
      }

      const safeIpAddress = ipAddress.replace(/[^a-zA-Z0-9.-]/g, "");

      // Cleanup user files, terminate user kernels, and reset the PL
      const remoteCmd = "rm -f /home/xilinx/lab_bitstream.bit && pkill -f ipykernel_launcher; python3 -c \"from pynq import PL; PL.reset()\"";
      const bashCmd = `ssh -o StrictHostKeyChecking=no xilinx@${safeIpAddress} '${remoteCmd}'`;

      console.log(`[FPGA] Resetting PYNQ board via SSH: ssh xilinx@${safeIpAddress}`);

      const proc = spawn("bash", ["-c", bashCmd], { timeout: 30000 });

      proc.on("close", (code) => {
        if (code === 0) {
          console.log("[FPGA] PYNQ Board cleaned up and reset successfully");
          resolve(true);
        } else {
          console.warn(`[FPGA] PYNQ Board reset failed (exit code: ${code})`);
          resolve(false);
        }
      });

      proc.on("error", (err) => {
        console.error("[FPGA] PYNQ Board reset spawn error:", err.message);
        resolve(false);
      });
      return;
    }

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
