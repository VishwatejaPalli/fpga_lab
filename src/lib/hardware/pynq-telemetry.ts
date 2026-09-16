/**
 * PYNQ-Z2 Real-Time Telemetry Service
 *
 * SSHes into the PYNQ board and reads actual hardware sensors:
 *  - Zynq XADC: die temperature, VCCINT, VCCAUX, VCCBRAM, VCCPINT, VCCPAUX
 *  - Linux sysfs: memory, CPU load, uptime, disk, network counters
 *
 * Results are cached for a short TTL so the 3-second polling from the
 * front-end doesn't hammer the board with SSH connections.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PynqTelemetry {
  cpu: {
    temp: string;       // Zynq die temperature from XADC (°C)
    load: string[];     // 1-min, 5-min load averages
    freq: string;       // Processor description
  };
  memory: {
    total: string;
    used: string;
    available: string;
    percent: string;
  };
  fpga: {
    overlay: string;    // Currently loaded overlay bitfile
    vccint: string;     // FPGA core voltage (V)
    vccaux: string;     // Auxiliary voltage (V)
    vccbram: string;    // Block RAM voltage (V)
    clock: string;      // PL clock (from overlay or default)
  };
  power: {
    vccpint: string;    // PS core voltage (V)
    vccpaux: string;    // PS auxiliary voltage (V)
  };
  network: {
    ip: string;
    uptime: string;
    rxBytes: string;
    txBytes: string;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    percent: string;
  };
  timestamp: string;    // ISO timestamp of when telemetry was collected
}

// ─── SSH command that collects everything in a single round-trip ────────────

const TELEMETRY_CMD = [
  // XADC temperature
  "cat /sys/bus/iio/devices/iio:device0/in_temp0_raw 2>/dev/null || echo NA",
  "cat /sys/bus/iio/devices/iio:device0/in_temp0_offset 2>/dev/null || echo 0",
  "cat /sys/bus/iio/devices/iio:device0/in_temp0_scale 2>/dev/null || echo 0",
  // XADC voltages
  "cat /sys/bus/iio/devices/iio:device0/in_voltage0_vccint_raw 2>/dev/null || echo NA",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage0_vccint_scale 2>/dev/null || echo 0",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage1_vccaux_raw 2>/dev/null || echo NA",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage1_vccaux_scale 2>/dev/null || echo 0",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage2_vccbram_raw 2>/dev/null || echo NA",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage2_vccbram_scale 2>/dev/null || echo 0",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage3_vccpint_raw 2>/dev/null || echo NA",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage3_vccpint_scale 2>/dev/null || echo 0",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage4_vccpaux_raw 2>/dev/null || echo NA",
  "cat /sys/bus/iio/devices/iio:device0/in_voltage4_vccpaux_scale 2>/dev/null || echo 0",
  // Memory
  "grep MemTotal /proc/meminfo | awk '{print $2}'",
  "grep MemAvailable /proc/meminfo | awk '{print $2}'",
  // CPU load
  "cat /proc/loadavg",
  // Uptime
  "cat /proc/uptime | awk '{print $1}'",
  // Network
  "hostname -I | awk '{print $1}'",
  "cat /proc/net/dev | grep eth0 | awk '{print $2, $10}'",
  // Disk
  "df / | tail -1",
  // Overlay — try the PYNQ Python API, fall back gracefully
  "python3 -c \"from pynq import PL; print(PL.bitfile_name)\" 2>/dev/null || echo none",
  // CPU frequency (kHz)
  "cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null || cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_cur_freq 2>/dev/null || grep -m1 'cpu MHz' /proc/cpuinfo 2>/dev/null | awk '{print $4 * 1000}' || echo 0",
  // PL fabric clock (Hz) — try multiple sysfs paths and python api
  "cat /sys/class/fclk/fclk0/set_rate 2>/dev/null || cat /sys/kernel/debug/clk/fclk0/clk_rate 2>/dev/null || python3 -c \"from pynq import Clocks; print(int(Clocks.fclk0_mhz * 1000000))\" 2>/dev/null || echo 0",
].join('; echo "|||"; ');

// ─── Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: PynqTelemetry;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000; // 5 seconds (prevents SSH connection spamming from front-end polling)

/**
 * Get cached telemetry without attempting SSH connection if missing or stale
 */
export function getTelemetryCached(boardId: string): PynqTelemetry | null {
  const cached = cache.get(boardId);
  if (cached) {
    return cached.data;
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBytes(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNetBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function parseTelemetryOutput(raw: string): PynqTelemetry {
  const parts = raw.split("|||").map((s) => s.trim());

  // Index mapping matches the TELEMETRY_CMD order
  const tempRaw = parseFloat(parts[0]) || 0;
  const tempOffset = parseFloat(parts[1]) || 0;
  const tempScale = parseFloat(parts[2]) || 0;

  const vccintRaw = parseFloat(parts[3]) || 0;
  const vccintScale = parseFloat(parts[4]) || 0;
  const vccauxRaw = parseFloat(parts[5]) || 0;
  const vccauxScale = parseFloat(parts[6]) || 0;
  const vccbramRaw = parseFloat(parts[7]) || 0;
  const vccbramScale = parseFloat(parts[8]) || 0;
  const vccpintRaw = parseFloat(parts[9]) || 0;
  const vccpintScale = parseFloat(parts[10]) || 0;
  const vccpauxRaw = parseFloat(parts[11]) || 0;
  const vccpauxScale = parseFloat(parts[12]) || 0;

  const memTotalKb = parseInt(parts[13]) || 0;
  const memAvailKb = parseInt(parts[14]) || 0;
  const memUsedKb = memTotalKb - memAvailKb;
  const memPercent = memTotalKb > 0 ? ((memUsedKb / memTotalKb) * 100).toFixed(1) : "0";

  const loadParts = (parts[15] || "0 0 0").split(/\s+/);
  const uptimeSec = parseFloat(parts[16]) || 0;
  const ip = (parts[17] || "").trim() || "N/A";

  // Network: rxBytes txBytes
  const netParts = (parts[18] || "0 0").trim().split(/\s+/);
  const rxBytes = parseInt(netParts[0]) || 0;
  const txBytes = parseInt(netParts[1]) || 0;

  // Disk: /dev/root  14G  6.9G  6.9G  51% /
  const diskLine = (parts[19] || "").trim();
  const diskParts = diskLine.split(/\s+/);
  const diskTotal = diskParts[1] || "N/A";
  const diskUsed = diskParts[2] || "N/A";
  const diskAvail = diskParts[3] || "N/A";
  const diskPercent = diskParts[4] || "N/A";

  // Overlay
  const overlay = (parts[20] || "none").trim();
  const overlayName = overlay === "none" ? "No overlay loaded" : overlay.split("/").pop() || overlay;

  // CPU frequency (from sysfs, in kHz)
  const cpuFreqKhz = parseInt(parts[21]) || 0;
  const cpuFreqMhz = cpuFreqKhz > 0 ? (cpuFreqKhz / 1000).toFixed(0) : "650";
  const cpuFreqStr = `Dual Cortex-A9 @ ${cpuFreqMhz} MHz`;

  // PL clock (from sysfs, in Hz)
  const plClockHz = parseInt(parts[22]) || 0;
  const plClockMhz = plClockHz > 0 ? (plClockHz / 1000000).toFixed(1) : "N/A";
  const plClockStr = plClockHz > 0 ? `${plClockMhz} MHz` : "N/A";

  // XADC temperature: T(°C) = (raw + offset) × scale / 1000
  const tempC = ((tempRaw + tempOffset) * tempScale) / 1000;

  // XADC voltages: V = raw × scale / 1000
  const vccint = (vccintRaw * vccintScale) / 1000;
  const vccaux = (vccauxRaw * vccauxScale) / 1000;
  const vccbram = (vccbramRaw * vccbramScale) / 1000;
  const vccpint = (vccpintRaw * vccpintScale) / 1000;
  const vccpaux = (vccpauxRaw * vccpauxScale) / 1000;

  return {
    cpu: {
      temp: `${tempC.toFixed(1)}°C`,
      load: [loadParts[0] || "0", loadParts[1] || "0"],
      freq: cpuFreqStr,
    },
    memory: {
      total: formatBytes(memTotalKb),
      used: formatBytes(memUsedKb),
      available: formatBytes(memAvailKb),
      percent: `${memPercent}%`,
    },
    fpga: {
      overlay: overlayName,
      vccint: `${vccint.toFixed(3)} V`,
      vccaux: `${vccaux.toFixed(3)} V`,
      vccbram: `${vccbram.toFixed(3)} V`,
      clock: plClockStr,
    },
    power: {
      vccpint: `${vccpint.toFixed(3)} V`,
      vccpaux: `${vccpaux.toFixed(3)} V`,
    },
    network: {
      ip,
      uptime: formatUptime(uptimeSec),
      rxBytes: formatNetBytes(rxBytes),
      txBytes: formatNetBytes(txBytes),
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      available: diskAvail,
      percent: diskPercent,
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch real-time telemetry from a PYNQ board by boardId.
 * Returns cached results if within TTL. Uses PynqConnectionManager.
 */
export async function fetchPynqTelemetry(
  boardId: string
): Promise<PynqTelemetry> {
  // Check cache
  const cached = cache.get(boardId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const { PynqConnectionManager } = await import("./connection-manager");
  const execRes = await PynqConnectionManager.executeCommand(boardId, TELEMETRY_CMD, 10000);
  const telemetry = parseTelemetryOutput(execRes.stdout);

  if (telemetry.network.ip === "N/A" && execRes.ipUsed) {
    telemetry.network.ip = execRes.ipUsed;
  }

  cache.set(boardId, { data: telemetry, fetchedAt: Date.now() });
  return telemetry;
}

/**
 * Quick connectivity check — attempts SSH using PynqConnectionManager.
 */
export async function checkPynqOnline(boardId: string): Promise<boolean> {
  try {
    const { PynqConnectionManager } = await import("./connection-manager");
    const res = await PynqConnectionManager.executeCommand(boardId, "hostname -I", 5000);
    return res.exitCode === 0;
  } catch {
    return false;
  }
}
