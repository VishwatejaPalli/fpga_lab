import { spawn } from "child_process";

export interface DetectedDevice {
  index: number;
  idcode: string;
  description: string;
}

/**
 * Detect connected FPGA devices using openFPGALoader.
 */
export async function detectDevices(): Promise<DetectedDevice[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn("openFPGALoader", ["--detect"], {
      timeout: 10000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        // openFPGALoader may not be installed or no devices found
        console.warn("[FPGA] Detection failed:", stderr);
        resolve([]);
        return;
      }

      const devices: DetectedDevice[] = [];
      const lines = stdout.split("\n");
      let index = 0;

      for (const line of lines) {
        // Parse detection output — format varies but typically contains IDCODE
        const match = line.match(/idcode\s+0x([0-9a-fA-F]+)/i);
        if (match) {
          devices.push({
            index: index++,
            idcode: `0x${match[1]}`,
            description: line.trim(),
          });
        }
      }

      resolve(devices);
    });

    proc.on("error", (err) => {
      console.error("[FPGA] Detection spawn error:", err.message);
      resolve([]); // Don't crash, just return empty
    });
  });
}
