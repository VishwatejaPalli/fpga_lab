import { spawn } from "child_process";

export interface DetectedDevice {
  index: number;
  idcode: string;
  description: string;
}

export interface DetectionResult {
  devices: DetectedDevice[];
  rawOutput: string;
}

/**
 * Detect connected FPGA devices using openFPGALoader.
 */
export async function detectDevices(): Promise<DetectionResult> {
  return new Promise((resolve) => {
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
      const fullOutput = stdout + stderr;
      
      if (code !== 0) {
        // openFPGALoader may not be installed or no devices found
        console.warn("[FPGA] Detection failed:", stderr);
        resolve({ devices: [], rawOutput: fullOutput });
        return;
      }

      const devices: DetectedDevice[] = [];
      const lines = fullOutput.split("\n");
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

      resolve({ devices, rawOutput: fullOutput });
    });

    proc.on("error", (err) => {
      console.error("[FPGA] Detection spawn error:", err.message);
      resolve({ devices: [], rawOutput: `Spawn error: ${err.message}` });
    });
  });
}
