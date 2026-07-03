import { sqlite } from "./index";

/**
 * Run all table creation statements.
 * Called once on server startup from server.js.
 */
export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fpga_family TEXT NOT NULL,
      board_type TEXT NOT NULL,
      connection_type TEXT NOT NULL DEFAULT 'jtag',
      device_path TEXT,
      ip_address TEXT,
      serial_port TEXT,
      camera_device TEXT,
      board_image_url TEXT,
      blank_bitstream_path TEXT,
      programming_tool TEXT DEFAULT 'openFPGALoader',
      ssh_username TEXT,
      ssh_password TEXT,
      status TEXT NOT NULL DEFAULT 'free',
      current_session_id TEXT,
      capabilities TEXT DEFAULT '[]',
      session_timeout_minutes INTEGER DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
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
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      job_id TEXT REFERENCES jobs(id),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    -- ── Researcher features ──────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS experiment_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id TEXT,
      board_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS board_reservations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      purpose TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      prefix TEXT NOT NULL,
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Untitled Batch',
      status TEXT NOT NULL DEFAULT 'pending',
      total_boards INTEGER NOT NULL DEFAULT 0,
      completed_boards INTEGER NOT NULL DEFAULT 0,
      failed_boards INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  // Safe column adds for backwards compat
  const safeAlter = (sql: string) => {
    try { sqlite.exec(sql); } catch { /* column already exists */ }
  };
  safeAlter("ALTER TABLE jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 0");
  safeAlter("ALTER TABLE jobs ADD COLUMN batch_id TEXT");
  safeAlter("ALTER TABLE jobs ADD COLUMN file_size INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE boards ADD COLUMN board_image_url TEXT");
  safeAlter("ALTER TABLE boards ADD COLUMN blank_bitstream_path TEXT");
  safeAlter("ALTER TABLE boards ADD COLUMN ip_address TEXT");
  safeAlter("ALTER TABLE boards ADD COLUMN ssh_username TEXT");
  safeAlter("ALTER TABLE boards ADD COLUMN ssh_password TEXT");

  console.log("[DB] Migrations complete");
}
