import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { decryptSafe } from "@/lib/auth/crypto";
import { PynqDiscoveryService } from "./pynq-discovery";
import { logger } from "@/lib/logger";
import { Client, type ConnectConfig, type ClientChannel } from "ssh2";
import fs from "fs";

export type ConnectionErrorType =
  | "NETWORK_UNREACHABLE"
  | "TCP_PORT_UNREACHABLE"
  | "SSH_AUTH_FAILED"
  | "SSH_UNAVAILABLE"
  | "BOARD_SERVICE_ERROR"
  | "UNKNOWN";

export type ConnectionStatus =
  | "ONLINE"
  | "DEGRADED"
  | "CONNECTING"
  | "NETWORK_UNREACHABLE"
  | "TCP_PORT_UNREACHABLE"
  | "SSH_AUTH_FAILED"
  | "SSH_UNAVAILABLE"
  | "BOARD_SERVICE_ERROR"
  | "OFFLINE";

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  ipUsed: string;
}

export interface BoardConnectionTarget {
  id: string;
  ipAddress: string;
  sshUsername: string;
  sshPassword?: string;
  sshAuthType?: "password" | "ssh_key";
  sshKeyPath?: string;
  hostname?: string;
  macAddress?: string;
}

interface PooledClient {
  client: Client;
  boardId: string;
  ipAddress: string;
  lastUsed: number;
  idleTimer?: NodeJS.Timeout;
}

/**
 * Connection Pool for SSH clients
 * Maintains per-board SSH client instances with idle timeout and error auto-invalidation.
 */
class PynqConnectionPool {
  private pool = new Map<string, PooledClient>();
  private inFlight = new Map<string, Promise<Client>>();
  private readonly IDLE_TIMEOUT_MS = 30000; // 30s idle disconnect

  /**
   * Acquire or establish a pooled SSH client connection for a target board
   */
  async acquire(target: BoardConnectionTarget, timeoutMs = 10000): Promise<Client> {
    const existing = this.pool.get(target.id);

    // Reuse existing client if open and target IP matches
    if (existing && existing.ipAddress === target.ipAddress) {
      if (existing.idleTimer) {
        clearTimeout(existing.idleTimer);
        existing.idleTimer = undefined;
      }
      existing.lastUsed = Date.now();
      return existing.client;
    }

    // Check if an in-flight connection attempt is already underway for this board
    const pending = this.inFlight.get(target.id);
    if (pending) {
      return pending;
    }

    // Invalidate stale connection if IP changed
    if (existing) {
      this.invalidate(target.id);
    }

    const connectPromise = new Promise<Client>((resolve, reject) => {
      const client = new Client();
      const timer: NodeJS.Timeout = setTimeout(() => {
        try {
          client.destroy();
        } catch {}
        this.invalidate(target.id);
        const timeoutErr = Object.assign(
          new Error(`SSH Connection attempt timed out after ${timeoutMs}ms`),
          { errorType: "SSH_UNAVAILABLE" as ConnectionErrorType }
        );
        reject(timeoutErr);
      }, timeoutMs);

      client.on("error", (err: Error) => {
        clearTimeout(timer);
        this.invalidate(target.id);
        const classified = PynqConnectionManager.classifyError(err);
        const classifiedErr = Object.assign(
          new Error(`SSH Connection error to ${target.ipAddress}: ${err.message}`),
          { errorType: classified }
        );
        reject(classifiedErr);
      });

      client.on("close", () => {
        this.invalidate(target.id);
      });

      client.on("ready", () => {
        clearTimeout(timer);
        const pooled: PooledClient = {
          client,
          boardId: target.id,
          ipAddress: target.ipAddress,
          lastUsed: Date.now(),
        };
        this.pool.set(target.id, pooled);
        this.resetIdleTimer(target.id);
        resolve(client);
      });

      const connectOpts: ConnectConfig = {
        host: target.ipAddress,
        port: 22,
        username: target.sshUsername,
        readyTimeout: timeoutMs,
        keepaliveInterval: 10000,
      };

      if (target.sshAuthType === "ssh_key") {
        if (!target.sshKeyPath || !fs.existsSync(target.sshKeyPath)) {
          if (timer) clearTimeout(timer);
          const err = Object.assign(
            new Error(`Configured SSH private key not found at path: ${target.sshKeyPath || "unspecified"}`),
            { errorType: "SSH_AUTH_FAILED" as ConnectionErrorType }
          );
          return reject(err);
        }
        try {
          connectOpts.privateKey = fs.readFileSync(target.sshKeyPath);
        } catch (readErr: unknown) {
          if (timer) clearTimeout(timer);
          const err = Object.assign(
            new Error(`Failed to read SSH private key file (${target.sshKeyPath}): ${readErr instanceof Error ? readErr.message : String(readErr)}`),
            { errorType: "SSH_AUTH_FAILED" as ConnectionErrorType }
          );
          return reject(err);
        }
      } else {
        connectOpts.password = target.sshPassword || "xilinx";
      }

      client.connect(connectOpts);
    }).finally(() => {
      this.inFlight.delete(target.id);
    });

    this.inFlight.set(target.id, connectPromise);
    return connectPromise;
  }

  /**
   * Reset idle timeout timer for a pooled client
   */
  private resetIdleTimer(boardId: string) {
    const pooled = this.pool.get(boardId);
    if (!pooled) return;

    if (pooled.idleTimer) {
      clearTimeout(pooled.idleTimer);
    }

    pooled.idleTimer = setTimeout(() => {
      logger.info(`Closing idle SSH connection for board ${boardId}`, { component: "SSH Pool", boardId });
      this.invalidate(boardId);
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Invalidate & close a pooled connection for a board
   */
  invalidate(boardId: string) {
    this.inFlight.delete(boardId);
    const pooled = this.pool.get(boardId);
    if (pooled) {
      if (pooled.idleTimer) clearTimeout(pooled.idleTimer);
      try {
        pooled.client.end();
        pooled.client.destroy();
      } catch {}
      this.pool.delete(boardId);
    }
  }

  /**
   * Invalidate all pooled connections
   */
  clearAll() {
    for (const boardId of this.pool.keys()) {
      this.invalidate(boardId);
    }
  }
}

const connectionPool = new PynqConnectionPool();

/**
 * Health Service for performing fine-grained network & hardware diagnostic chains
 */
export class PynqHealthService {
  /**
   * Diagnostic chain:
   * 1. Discovery / IP resolution -> NETWORK_UNREACHABLE
   * 2. TCP Port 22 check -> TCP_PORT_UNREACHABLE
   * 3. SSH Auth & handshake -> SSH_AUTH_FAILED / SSH_UNAVAILABLE
   * 4. PYNQ execution check -> BOARD_SERVICE_ERROR
   * 5. Hardware thermal telemetry check -> DEGRADED or ONLINE
   */
  static async diagnoseBoard(boardId: string): Promise<{ status: ConnectionStatus; lastError: string | null; ipUsed?: string }> {
    // 1. IP Discovery
    const discovery = await PynqDiscoveryService.discoverBoardIp(boardId);
    if (!discovery || !discovery.ip) {
      return {
        status: "NETWORK_UNREACHABLE",
        lastError: "No valid IP address discovered via stored record, mDNS, or ARP",
      };
    }

    const targetIp = discovery.ip;

    // 2. TCP Port 22 reachability check
    const isPortOpen = await PynqDiscoveryService.checkPort(targetIp, 22, 2500);
    if (!isPortOpen) {
      return {
        status: "TCP_PORT_UNREACHABLE",
        lastError: `Network reachable, but TCP port 22 is closed/unreachable at ${targetIp}`,
        ipUsed: targetIp,
      };
    }

    // 3 & 4. SSH Handshake + Command Execution
    try {
      const execRes = await PynqConnectionManager.executeCommand(boardId, "hostname -I", 6000);
      if (execRes.exitCode !== 0) {
        return {
          status: "BOARD_SERVICE_ERROR",
          lastError: `SSH connected but remote command exited with code ${execRes.exitCode}`,
          ipUsed: targetIp,
        };
      }

      // Healthy! Check thermal telemetry for DEGRADED state
      try {
        const { fetchPynqTelemetry } = await import("./pynq-telemetry");
        const tel = await fetchPynqTelemetry(boardId);
        if (tel && tel.cpu && tel.cpu.temp) {
          const temp = parseFloat(tel.cpu.temp);
          if (!isNaN(temp) && temp > 80) {
            return {
              status: "DEGRADED",
              lastError: `High die temperature alert: ${temp}°C`,
              ipUsed: targetIp,
            };
          }
        }
      } catch (_telErr: unknown) {
        // Non-fatal telemetry parsing error
      }

      return {
        status: "ONLINE",
        lastError: null,
        ipUsed: targetIp,
      };
    } catch (err: unknown) {
      const classified = PynqConnectionManager.classifyError(err);
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: classified as ConnectionStatus,
        lastError: message || "SSH Connection failed",
        ipUsed: targetIp,
      };
    }
  }
}

/**
 * PYNQ Connection Manager — Facade for all PYNQ connectivity, SSH pooling, and diagnostics.
 */
export class PynqConnectionManager {
  /**
   * Resolves target board credentials & verified current IP address.
   */
  static async resolveTarget(boardId: string): Promise<BoardConnectionTarget> {
    const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
    if (!board) {
      throw new Error(`Board ${boardId} not found in database`);
    }

    let targetIp = board.ipAddress;
    const discovery = await PynqDiscoveryService.discoverBoardIp(boardId);
    if (discovery && discovery.ip) {
      targetIp = discovery.ip;
    }

    if (!targetIp) {
      throw new Error(`No IP address available or discovered for board ${board.name} (${boardId})`);
    }

    const username = board.sshUsername || "xilinx";
    const password = decryptSafe(board.sshPassword) || "xilinx";

    return {
      id: board.id,
      ipAddress: targetIp,
      sshUsername: username,
      sshPassword: password,
      sshAuthType: board.sshAuthType || "password",
      sshKeyPath: board.sshKeyPath || undefined,
      hostname: board.hostname || undefined,
      macAddress: board.macAddress || undefined,
    };
  }

  /**
   * Get verified current Board IP address
   */
  static async getBoardIp(boardId: string): Promise<string | null> {
    try {
      const target = await this.resolveTarget(boardId);
      return target.ipAddress;
    } catch {
      return null;
    }
  }

  /**
   * Execute a remote command on the board over SSH using pooled connection or short-lived fallback
   */
  static async executeCommand(
    boardId: string,
    command: string,
    timeoutMs = 15000
  ): Promise<SshExecResult> {
    const target = await this.resolveTarget(boardId);

    // Quick port check
    const isPortOpen = await PynqDiscoveryService.checkPort(target.ipAddress, 22, 2500);
    if (!isPortOpen) {
      const err = Object.assign(
        new Error(`TCP Port 22 unreachable for board at ${target.ipAddress}`),
        { errorType: "TCP_PORT_UNREACHABLE" as ConnectionErrorType }
      );
      throw err;
    }

    try {
      const client = await connectionPool.acquire(target, timeoutMs);

      return await new Promise<SshExecResult>((resolve, reject) => {
        let stdoutData = "";
        let stderrData = "";
        const timer: NodeJS.Timeout = setTimeout(() => {
          connectionPool.invalidate(boardId);
          const timeoutErr = Object.assign(
            new Error(`SSH Command execution timed out after ${timeoutMs}ms`),
            { errorType: "SSH_UNAVAILABLE" as ConnectionErrorType }
          );
          reject(timeoutErr);
        }, timeoutMs);

        client.exec(command, (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            if (timer) clearTimeout(timer);
            connectionPool.invalidate(boardId);
            const classifiedError = Object.assign(
              new Error(`SSH Exec error: ${err.message}`),
              { errorType: "BOARD_SERVICE_ERROR" as ConnectionErrorType }
            );
            return reject(classifiedError);
          }

          stream.on("error", (streamErr: Error) => {
            if (timer) clearTimeout(timer);
            connectionPool.invalidate(boardId);
            const classifiedError = Object.assign(
              new Error(`SSH Stream error: ${streamErr.message}`),
              { errorType: "BOARD_SERVICE_ERROR" as ConnectionErrorType }
            );
            reject(classifiedError);
          });

          stream.on("close", (code: number) => {
            if (timer) clearTimeout(timer);
            resolve({
              stdout: stdoutData,
              stderr: stderrData,
              exitCode: code || 0,
              ipUsed: target.ipAddress,
            });
          });

          stream.on("data", (data: Buffer) => {
            stdoutData += data.toString("utf-8");
          });

          stream.stderr.on("data", (data: Buffer) => {
            stderrData += data.toString("utf-8");
          });
        });
      });
    } catch (err: unknown) {
      const errObj = err as { errorType?: ConnectionErrorType; message?: string };
      if (!errObj.errorType) {
        errObj.errorType = this.classifyError(err);
      }
      throw err;
    }
  }

  /**
   * Invalidate pooled connection for a board
   */
  static disconnect(boardId: string) {
    connectionPool.invalidate(boardId);
  }

  /**
   * Classify an error into detailed system connection status
   */
  static classifyError(err: unknown): ConnectionErrorType {
    if (err && typeof err === "object" && "errorType" in err && err.errorType) {
      return err.errorType as ConnectionErrorType;
    }
    const msg = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
    if (msg.includes("all configured authentication methods failed") || msg.includes("authentication failed") || msg.includes("bad password")) {
      return "SSH_AUTH_FAILED";
    }
    if (msg.includes("tcp port 22") || msg.includes("econnrefused")) {
      return "TCP_PORT_UNREACHABLE";
    }
    if (msg.includes("network unreachable") || msg.includes("etimedout") || msg.includes("no route to host")) {
      return "NETWORK_UNREACHABLE";
    }
    if (msg.includes("ssh") || msg.includes("handshake")) {
      return "SSH_UNAVAILABLE";
    }
    return "BOARD_SERVICE_ERROR";
  }
}
