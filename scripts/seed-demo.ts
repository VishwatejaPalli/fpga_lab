#!/usr/bin/env npx tsx
/**
 * Seed demo data: boards, a completed job, and an active session
 * so all pages have content to display.
 *
 * Usage: npx tsx scripts/seed-demo.ts
 */

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || "./data/fpga_lab.db";
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Ensure tables exist ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fpga_family TEXT NOT NULL,
    board_type TEXT NOT NULL,
    connection_type TEXT NOT NULL DEFAULT 'jtag',
    device_path TEXT,
    serial_port TEXT,
    camera_device TEXT,
    programming_tool TEXT DEFAULT 'openFPGALoader',
    status TEXT NOT NULL DEFAULT 'free',
    current_session_id TEXT,
    capabilities TEXT DEFAULT '[]',
    session_timeout_minutes INTEGER DEFAULT 30,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    board_id TEXT NOT NULL,
    bitstream_path TEXT NOT NULL,
    bitstream_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    logs TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS hw_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    board_id TEXT NOT NULL,
    job_id TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );
`);

// ── Clear old demo data ─────────────────────────────────────────────────────
db.exec("DELETE FROM hw_sessions");
db.exec("DELETE FROM jobs");
db.exec("DELETE FROM boards");

// ── Insert demo boards ──────────────────────────────────────────────────────
const boards = [
  {
    id: randomUUID(),
    name: "Basys 3 — Bench #1",
    fpga_family: "Xilinx Artix-7",
    board_type: "basys3",
    connection_type: "jtag",
    device_path: "/dev/ttyUSB0",
    serial_port: "/dev/ttyUSB1",
    camera_device: "/dev/video0",
    programming_tool: "openFPGALoader",
    status: "free",
    capabilities: JSON.stringify(["led", "uart", "camera", "switches"]),
    session_timeout_minutes: 30,
  },
  {
    id: randomUUID(),
    name: "Nexys A7 — Bench #2",
    fpga_family: "Xilinx Artix-7",
    board_type: "nexysA7",
    connection_type: "jtag",
    device_path: "/dev/ttyUSB2",
    serial_port: "/dev/ttyUSB3",
    camera_device: "/dev/video1",
    programming_tool: "openFPGALoader",
    status: "busy",
    capabilities: JSON.stringify(["led", "uart", "camera", "switches", "display"]),
    session_timeout_minutes: 30,
  },
  {
    id: randomUUID(),
    name: "PYNQ-Z2 — Bench #3",
    fpga_family: "Xilinx Zynq-7000",
    board_type: "pynq-z2",
    connection_type: "jtag",
    device_path: "/dev/ttyUSB4",
    serial_port: "/dev/ttyUSB5",
    camera_device: null,
    programming_tool: "openFPGALoader",
    status: "free",
    capabilities: JSON.stringify(["led", "uart", "ethernet"]),
    session_timeout_minutes: 45,
  },
  {
    id: randomUUID(),
    name: "DE10-Lite — Bench #4",
    fpga_family: "Intel MAX 10",
    board_type: "de10lite",
    connection_type: "jtag",
    device_path: "/dev/ttyUSB6",
    serial_port: "/dev/ttyUSB7",
    camera_device: "/dev/video2",
    programming_tool: "quartus_pgm",
    status: "offline",
    capabilities: JSON.stringify(["led", "switches", "camera"]),
    session_timeout_minutes: 30,
  },
  {
    id: randomUUID(),
    name: "iCEBreaker — Bench #5",
    fpga_family: "Lattice iCE40",
    board_type: "icebreaker",
    connection_type: "usb",
    device_path: "/dev/ttyACM0",
    serial_port: "/dev/ttyACM1",
    camera_device: "/dev/video3",
    programming_tool: "openFPGALoader",
    status: "free",
    capabilities: JSON.stringify(["led", "uart", "camera"]),
    session_timeout_minutes: 20,
  },
];

const insertBoard = db.prepare(`
  INSERT INTO boards (id, name, fpga_family, board_type, connection_type,
    device_path, serial_port, camera_device, programming_tool, status,
    capabilities, session_timeout_minutes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const b of boards) {
  insertBoard.run(
    b.id, b.name, b.fpga_family, b.board_type, b.connection_type,
    b.device_path, b.serial_port, b.camera_device, b.programming_tool,
    b.status, b.capabilities, b.session_timeout_minutes
  );
}

// ── Get user IDs ────────────────────────────────────────────────────────────
const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
const user = db.prepare("SELECT id FROM users WHERE role = 'user' LIMIT 1").get() as { id: string } | undefined;

if (user || admin) {
  const userId = (user || admin)!.id;

  // Create a "completed" job for Basys3
  const jobId = randomUUID();
  const board0 = boards[0];
  db.prepare(`
    INSERT INTO jobs (id, user_id, board_id, bitstream_path, bitstream_name, status, logs, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, 'success', ?, datetime('now', '-5 minutes'), datetime('now', '-4 minutes'), datetime('now', '-3 minutes'))
  `).run(
    jobId, userId, board0.id,
    "./uploads/demo/counter_top.bit", "counter_top.bit",
    [
      "[openFPGALoader] Detecting board...",
      "[openFPGALoader] Board: basys3 (Artix-7 XC7A35T)",
      "[openFPGALoader] Loading bitstream: counter_top.bit (45.2 KB)",
      "[openFPGALoader] Erasing...",
      "[openFPGALoader] Programming... ████████████████████ 100%",
      "[openFPGALoader] Verifying...",
      "[openFPGALoader] Done. FPGA configured successfully.",
      "",
      "✅ Board programmed in 8.3s",
    ].join("\n")
  );

  // Create an active hardware session on Basys3
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 25 * 60 * 1000).toISOString(); // 25 min from now
  db.prepare(`
    INSERT INTO hw_sessions (id, user_id, board_id, job_id, started_at, expires_at, status)
    VALUES (?, ?, ?, ?, datetime('now'), ?, 'active')
  `).run(sessionId, userId, board0.id, jobId, expiresAt);

  // Mark the board as busy with this session
  db.prepare("UPDATE boards SET status = 'busy', current_session_id = ? WHERE id = ?").run(sessionId, board0.id);

  console.log(`✓ Created active session on "${board0.name}" for user ${userId.slice(0, 8)}`);
  console.log(`  Session expires: ${expiresAt}`);

  // Create a second completed job (failed) for history
  const failedJobId = randomUUID();
  db.prepare(`
    INSERT INTO jobs (id, user_id, board_id, bitstream_path, bitstream_name, status, logs, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, 'failed', ?, datetime('now', '-20 minutes'), datetime('now', '-19 minutes'), datetime('now', '-18 minutes'))
  `).run(
    failedJobId, userId, boards[2].id,
    "./uploads/demo/alu_top.bit", "alu_top.bit",
    [
      "[openFPGALoader] Detecting board...",
      "[openFPGALoader] Board: pynq-z2 (Zynq XC7Z020)",
      "[openFPGALoader] Loading bitstream: alu_top.bit (128.7 KB)",
      "[openFPGALoader] ERROR: Bitstream is for wrong device (expected Zynq, got Artix-7)",
      "",
      "❌ Programming failed: device mismatch",
    ].join("\n")
  );
}

console.log("");
console.log(`✓ Seeded ${boards.length} demo boards:`);
boards.forEach((b, i) => {
  console.log(`  ${i + 1}. ${b.name} [${b.status}] — ${b.fpga_family}`);
});
console.log("");
console.log("✓ Created demo jobs (1 success, 1 failed)");
console.log("✓ Created active hardware session on Basys3");
console.log("");
console.log("  Open http://localhost:3000 to see the demo!");

db.close();
