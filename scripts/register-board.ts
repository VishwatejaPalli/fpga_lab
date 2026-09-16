#!/usr/bin/env npx tsx
/**
 * Register or update an FPGA board (e.g. PYNQ-Z2) in the FPGA Remote Lab database.
 * 
 * Usage:
 *   npx tsx scripts/register-board.ts --ip 192.168.171.108 --name "PYNQ-Z2 Lab #1" --hostname "pynq-01" --mac "00:0a:35:00:01:02"
 *   npx tsx scripts/register-board.ts --help
 */

import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { boards } from "../src/lib/db/schema";
import { encrypt } from "../src/lib/auth/crypto";
import { PynqConnectionManager } from "../src/lib/hardware/connection-manager";

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {
    name: "PYNQ-Z2 Board",
    ip: "192.168.171.108",
    hostname: "pynq-01",
    mac: "",
    boardType: "pynq-z2",
    fpgaFamily: "Xilinx Zynq-7000",
    connectionType: "network",
    sshUsername: "xilinx",
    sshPassword: "xilinx",
    capabilities: "led,uart,camera,switches,ethernet",
    sessionTimeoutMinutes: "30",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(`
FPGA Board Registration Utility
-------------------------------
Usage: npx tsx scripts/register-board.ts [options]

Options:
  --name <string>               Display name of the board (default: "${options.name}")
  --ip <string>                 IP address of the board (default: "${options.ip}")
  --hostname <string>           Network hostname e.g. pynq-01 (default: "${options.hostname}")
  --mac <string>                MAC Address e.g. 00:0a:35:00:01:02
  --board-type <string>         boardType identifier (default: "${options.boardType}")
  --fpga-family <string>        FPGA family string (default: "${options.fpgaFamily}")
  --connection-type <type>      jtag | network | usb (default: "${options.connectionType}")
  --ssh-username <username>     SSH login username (default: "${options.sshUsername}")
  --ssh-password <password>     SSH login password (default: "${options.sshPassword}")
  --capabilities <csv>          Comma-separated list (default: "${options.capabilities}")
  --session-timeout <minutes>   Session timeout in minutes (default: ${options.sessionTimeoutMinutes})
      `);
      process.exit(0);
    }

    if (arg === "--name" && args[i + 1]) options.name = args[++i];
    else if (arg === "--ip" && args[i + 1]) options.ip = args[++i];
    else if (arg === "--hostname" && args[i + 1]) options.hostname = args[++i];
    else if (arg === "--mac" && args[i + 1]) options.mac = args[++i];
    else if (arg === "--board-type" && args[i + 1]) options.boardType = args[++i];
    else if (arg === "--fpga-family" && args[i + 1]) options.fpgaFamily = args[++i];
    else if (arg === "--connection-type" && args[i + 1]) options.connectionType = args[++i];
    else if (arg === "--ssh-username" && args[i + 1]) options.sshUsername = args[++i];
    else if (arg === "--ssh-password" && args[i + 1]) options.sshPassword = args[++i];
    else if (arg === "--capabilities" && args[i + 1]) options.capabilities = args[++i];
    else if (arg === "--session-timeout" && args[i + 1]) options.sessionTimeoutMinutes = args[++i];
  }

  return options;
}

async function main() {
  const opts = parseArgs();
  console.log("---------------------------------------------------------");
  console.log("⚡ FPGA Remote Lab Board Registration");
  console.log("---------------------------------------------------------");
  console.log(`Board Name       : ${opts.name}`);
  console.log(`IP Address       : ${opts.ip}`);
  console.log(`Hostname         : ${opts.hostname}`);
  console.log(`MAC Address      : ${opts.mac || "(Auto-probing via SSH...)"}`);
  console.log(`Board Type       : ${opts.boardType}`);
  console.log(`FPGA Family      : ${opts.fpgaFamily}`);
  console.log(`Connection Type  : ${opts.connectionType}`);
  console.log(`SSH Username     : ${opts.sshUsername}`);
  console.log(`Session Timeout  : ${opts.sessionTimeoutMinutes} minutes`);
  console.log("---------------------------------------------------------");

  let finalMac = opts.mac;
  let finalHostname = opts.hostname;

  // Auto-probe MAC address and Hostname if network connection
  if (opts.connectionType === "network" && (!finalMac || !finalHostname)) {
    try {
      console.log("🔍 Probing board identity over SSH...");
      const probeRes = await PynqConnectionManager.executeCommand(
        opts.ip,
        "cat /sys/class/net/eth0/address 2>/dev/null || echo NA; echo '|||'; hostname 2>/dev/null || echo NA",
        5000
      );
      if (probeRes.exitCode === 0 && probeRes.stdout) {
        const parts = probeRes.stdout.split("|||").map((p) => p.trim());
        if (!finalMac && parts[0] && parts[0] !== "NA") finalMac = parts[0];
        if ((!finalHostname || finalHostname === "pynq-01") && parts[1] && parts[1] !== "NA") {
          finalHostname = parts[1];
        }
        console.log(`✨ Probed Hardware Identity -> MAC: ${finalMac}, Hostname: ${finalHostname}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ SSH auto-probe skipped: ${err.message}`);
    }
  }

  const capabilitiesArray = opts.capabilities.split(",").map((c) => c.trim()).filter(Boolean);
  const encryptedSshPassword = opts.sshPassword ? encrypt(opts.sshPassword) : null;
  const timeoutMins = parseInt(opts.sessionTimeoutMinutes, 10) || 30;

  try {
    const existingBoards = await db.select().from(boards);
    const existing = existingBoards.find(
      (b) =>
        (finalMac && b.macAddress === finalMac) ||
        (b.ipAddress && b.ipAddress === opts.ip) ||
        b.name === opts.name
    );

    const now = new Date().toISOString();

    if (existing) {
      console.log(`ℹ️ Board found in database (ID: ${existing.id}). Updating configuration...`);
      await db
        .update(boards)
        .set({
          name: opts.name,
          macAddress: finalMac || existing.macAddress,
          hostname: finalHostname || existing.hostname,
          fpgaFamily: opts.fpgaFamily,
          boardType: opts.boardType,
          connectionType: opts.connectionType as "jtag" | "network" | "usb",
          ipAddress: opts.ip,
          sshUsername: opts.sshUsername,
          sshPassword: encryptedSshPassword,
          capabilities: JSON.stringify(capabilitiesArray),
          sessionTimeoutMinutes: timeoutMins,
          connectionStatus: "ONLINE",
          lastSeen: now,
          status: "free",
        })
        .where(eq(boards.id, existing.id));

      console.log(`✅ Successfully updated board record: ${existing.id}`);
    } else {
      const boardId = uuid();
      console.log(`🆕 Creating new board record (ID: ${boardId})...`);
      await db.insert(boards).values({
        id: boardId,
        name: opts.name,
        macAddress: finalMac,
        hostname: finalHostname,
        fpgaFamily: opts.fpgaFamily,
        boardType: opts.boardType,
        connectionType: opts.connectionType as "jtag" | "network" | "usb",
        ipAddress: opts.ip,
        sshUsername: opts.sshUsername,
        sshPassword: encryptedSshPassword,
        capabilities: JSON.stringify(capabilitiesArray),
        sessionTimeoutMinutes: timeoutMins,
        connectionStatus: "ONLINE",
        lastSeen: now,
        status: "free",
      });

      console.log(`✅ Successfully registered new board: ${boardId}`);
    }

    console.log("---------------------------------------------------------");
    console.log("🎉 Board registration complete!");
    console.log("Users can now select and access this FPGA board from anywhere via the remote web platform.");
    console.log("---------------------------------------------------------");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Failed to register board:", err.message || err);
    process.exit(1);
  }
}

main();
