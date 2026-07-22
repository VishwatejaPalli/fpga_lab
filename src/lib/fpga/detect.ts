import { spawn } from "child_process";
import { networkInterfaces } from "os";
import { connect } from "net";

export interface DetectedDevice {
  index: number;
  idcode: string;
  description: string;
}

export interface DetectedNetworkDevice {
  ip: string;
  type: "pynq_ssh" | "xvc" | "ssh_only" | "unknown";
  ports: number[];
  name: string;
  boardType: string;
}

export interface DetectionResult {
  devices: DetectedDevice[];
  networkDevices: DetectedNetworkDevice[];
  rawOutput: string;
}

/**
 * Detect connected FPGA devices using openFPGALoader.
 */
export async function detectDevices(): Promise<{ devices: DetectedDevice[]; rawOutput: string }> {
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
        console.warn("[FPGA] Local JTAG detection returned code:", code);
        resolve({ devices: [], rawOutput: fullOutput });
        return;
      }

      const devices: DetectedDevice[] = [];
      const lines = fullOutput.split("\n");
      let index = 0;

      for (const line of lines) {
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

/**
 * Retrieve current server IPv4 interfaces to resolve local subnet sub-ranges
 */
export function getLocalSubnets(): string[] {
  const subnets: string[] = [];
  const interfaces = networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const infoList = interfaces[name];
    if (!infoList) continue;
    for (const info of infoList) {
      if (info.family === "IPv4" && !info.internal) {
        const parts = info.address.split(".");
        if (parts.length === 4) {
          // Return the subnet prefix (e.g. "192.168.1")
          subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }

  // Deduplicate results
  const unique = Array.from(new Set(subnets));
  if (unique.length === 0) {
    // Standard default subnets fallback
    unique.push("192.168.1");
    unique.push("192.168.2");
  }
  return unique;
}

/**
 * Check if specific ports are open on a host
 */
function checkHostPorts(ip: string, ports: number[], timeout = 250): Promise<{ ip: string; openPorts: number[] }> {
  return new Promise((resolve) => {
    const openPorts: number[] = [];
    let pending = ports.length;

    if (pending === 0) {
      resolve({ ip, openPorts });
      return;
    }

    ports.forEach((port) => {
      const socket = connect({ host: ip, port, timeout });
      
      socket.on("connect", () => {
        openPorts.push(port);
        socket.destroy();
        done();
      });

      socket.on("timeout", () => {
        socket.destroy();
        done();
      });

      socket.on("error", () => {
        socket.destroy();
        done();
      });
    });

    function done() {
      pending--;
      if (pending === 0) {
        resolve({ ip, openPorts });
      }
    }
  });
}

/**
 * Perform a dynamic fast TCP port scan on local subnets to find network-connected boards
 */
export async function detectNetworkDevices(): Promise<DetectedNetworkDevice[]> {
  const subnets = getLocalSubnets();
  const targets: string[] = [];

  for (const subnet of subnets) {
    for (let i = 1; i <= 254; i++) {
      targets.push(`${subnet}.${i}`);
    }
  }

  const results: DetectedNetworkDevice[] = [];
  const portsToCheck = [22, 9090, 2542]; // SSH, PYNQ Jupyter, Xilinx XVC
  const batchSize = 50; // Batch TCP queries to avoid event loop block/fd leak

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const promises = batch.map(ip => checkHostPorts(ip, portsToCheck, 250));
    const batchRes = await Promise.all(promises);

    for (const r of batchRes) {
      if (r.openPorts.length > 0) {
        let type: "pynq_ssh" | "xvc" | "ssh_only" | "unknown" = "unknown";
        let boardType = "generic";
        let name = `Network Board (${r.ip})`;

        if (r.openPorts.includes(9090)) {
          type = "pynq_ssh";
          boardType = "pynq-z2";
          name = `PYNQ Jupyter Board (${r.ip})`;
        } else if (r.openPorts.includes(2542)) {
          type = "xvc";
          boardType = "xvc-gateway";
          name = `Xilinx XVC JTAG Gateway (${r.ip})`;
        } else if (r.openPorts.includes(22)) {
          type = "ssh_only";
          boardType = "linux-board";
          name = `SSH Linux Board (${r.ip})`;
        }

        results.push({
          ip: r.ip,
          type,
          ports: r.openPorts,
          name,
          boardType
        });
      }
    }
  }

  return results;
}
