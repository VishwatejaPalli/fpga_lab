import { exec } from "child_process";
import dns from "dns";
import fs from "fs";
import net from "net";
import { promisify } from "util";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);
const dnsLookupAsync = promisify(dns.lookup);

export interface DiscoveryResult {
  ip: string;
  source: "stored" | "dns" | "mdns" | "arp" | "fallback";
  verified: boolean;
}

/**
 * PYNQ Discovery Service
 * Finds current IP address of a PYNQ board using MAC Address, Hostname, and ARP/DNS.
 */
export class PynqDiscoveryService {
  /**
   * Quick TCP port check to verify if SSH (port 22) is listening at an IP
   */
  static async checkPort(ip: string, port = 22, timeoutMs = 2000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let status = false;

      socket.setTimeout(timeoutMs);
      socket.on("connect", () => {
        status = true;
        socket.destroy();
      });
      socket.on("timeout", () => {
        socket.destroy();
      });
      socket.on("error", () => {
        socket.destroy();
      });
      socket.on("close", () => {
        resolve(status);
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Read system ARP table to map MAC address -> IP address
   */
  static async findIpByMacInArp(macAddress: string): Promise<string | null> {
    if (!macAddress) return null;
    const cleanMac = macAddress.toLowerCase().replace(/[:-]/g, "");

    // 1. Try reading /proc/net/arp directly (Linux)
    try {
      if (fs.existsSync("/proc/net/arp")) {
        const arpContent = fs.readFileSync("/proc/net/arp", "utf-8");
        const lines = arpContent.split("\n").slice(1);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const ip = parts[0];
            const mac = parts[3].toLowerCase().replace(/[:-]/g, "");
            if (mac === cleanMac && parts[2] !== "0x0") {
              return ip;
            }
          }
        }
      }
    } catch (err: any) {
      // Fall through to arp command
    }

    // 2. Try arp command
    try {
      const { stdout } = await execAsync("arp -an");
      const lines = stdout.split("\n");
      for (const line of lines) {
        // e.g. ? (192.168.171.108) at 00:0a:35:00:01:02 [ether] on eth0
        const ipMatch = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
        const macMatch = line.match(/([0-9a-fa-f]{2}[:-][0-9a-fa-f]{2}[:-][0-9a-fa-f]{2}[:-][0-9a-fa-f]{2}[:-][0-9a-fa-f]{2}[:-][0-9a-fa-f]{2})/);
        if (ipMatch && macMatch) {
          const foundIp = ipMatch[1];
          const foundMac = macMatch[1].toLowerCase().replace(/[:-]/g, "");
          if (foundMac === cleanMac) {
            return foundIp;
          }
        }
      }
    } catch (err: any) {
      // Ignore ARP command failures
    }

    return null;
  }

  /**
   * Resolve hostname using mDNS / local DNS
   */
  static async resolveHostname(hostname: string): Promise<string | null> {
    if (!hostname) return null;
    const targets = [hostname, `${hostname}.local`, `${hostname}.lan`];

    for (const target of targets) {
      try {
        const res = await dnsLookupAsync(target);
        if (res && res.address) {
          return res.address;
        }
      } catch (err: any) {
        // Continue to next target
      }
    }

    return null;
  }

  /**
   * Main discovery entry point for a board
   */
  static async discoverBoardIp(boardId: string): Promise<DiscoveryResult | null> {
    const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
    if (!board) return null;

    // 1. Tier 1: Check currently stored IP
    if (board.ipAddress) {
      const isReachable = await this.checkPort(board.ipAddress, 22, 1500);
      if (isReachable) {
        return { ip: board.ipAddress, source: "stored", verified: true };
      }
    }

    // 2. Tier 2: Check DNS/mDNS by hostname
    if (board.hostname) {
      const resolvedIp = await this.resolveHostname(board.hostname);
      if (resolvedIp) {
        const isReachable = await this.checkPort(resolvedIp, 22, 1500);
        if (isReachable) {
          await this.updateBoardIp(boardId, resolvedIp, board.ipAddress);
          return { ip: resolvedIp, source: "mdns", verified: true };
        }
      }
    }

    // 3. Tier 3: Check local ARP table by MAC address
    if (board.macAddress) {
      const arpIp = await this.findIpByMacInArp(board.macAddress);
      if (arpIp) {
        const isReachable = await this.checkPort(arpIp, 22, 1500);
        if (isReachable) {
          await this.updateBoardIp(boardId, arpIp, board.ipAddress);
          return { ip: arpIp, source: "arp", verified: true };
        }
      }
    }

    // 4. Tier 4: Fallback to last known stored IP even if unverified
    if (board.ipAddress) {
      return { ip: board.ipAddress, source: "fallback", verified: false };
    }

    return null;
  }

  /**
   * Update database when IP change is discovered
   */
  private static async updateBoardIp(boardId: string, newIp: string, oldIp: string | null) {
    if (newIp === oldIp) return;
    console.log(`[Discovery] Board ${boardId} IP changed: ${oldIp || "none"} -> ${newIp}`);
    await db
      .update(boards)
      .set({
        ipAddress: newIp,
        lastIp: oldIp || newIp,
      })
      .where(eq(boards.id, boardId));
  }
}
