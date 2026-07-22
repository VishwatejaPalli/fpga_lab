import { pool } from "./index";

/**
 * Run all table creation statements.
 * Called once on server startup from server.init.
 */
export async function runMigrations() {
  console.log("[DB] Running migrations for PostgreSQL...");
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        verified BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'active',
        last_login TEXT,
        token_version INTEGER NOT NULL DEFAULT 1,
        locked_until TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL
      );
    `);

    await client.query(`
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        bitstream_path TEXT NOT NULL,
        bitstream_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        logs TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
        started_at TEXT,
        completed_at TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hw_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        job_id TEXT REFERENCES jobs(id),
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS experiment_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id TEXT,
        board_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        tags TEXT DEFAULT '[]',
        pinned BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS board_reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        purpose TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        prefix TEXT NOT NULL,
        last_used_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Untitled Batch',
        status TEXT NOT NULL DEFAULT 'pending',
        total_boards INTEGER NOT NULL DEFAULT 0,
        completed_boards INTEGER NOT NULL DEFAULT 0,
        failed_boards INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
        completed_at TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        reset_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        target TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS synthesis_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'queued',
        top_module TEXT NOT NULL DEFAULT 'main',
        work_dir TEXT NOT NULL,
        logs TEXT DEFAULT '',
        schematic TEXT DEFAULT '',
        timing_report TEXT DEFAULT '',
        power_report TEXT DEFAULT '',
        area_report TEXT DEFAULT '',
        waveform_data TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
        completed_at TEXT
      );
    `);

    // Safe column adds for backward compatibility
    const safeAlter = async (sqlStr: string) => {
      try {
        await client.query(sqlStr);
      } catch (err: any) {
        if (!err.message.includes("already exists") && err.code !== "42701") {
          console.error(`[DB] Migration error on alter: ${err.message}`);
          throw err;
        }
      }
    };

    await safeAlter("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0");
    await safeAlter("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS batch_id TEXT");
    await safeAlter("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0");
    await safeAlter("ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_image_url TEXT");
    await safeAlter("ALTER TABLE boards ADD COLUMN IF NOT EXISTS blank_bitstream_path TEXT");
    await safeAlter("ALTER TABLE boards ADD COLUMN IF NOT EXISTS ip_address TEXT");
    await safeAlter("ALTER TABLE boards ADD COLUMN IF NOT EXISTS ssh_username TEXT");
    await safeAlter("ALTER TABLE boards ADD COLUMN IF NOT EXISTS ssh_password TEXT");
    await safeAlter("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
    await safeAlter("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT");
    await safeAlter("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1");
    await safeAlter("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TEXT");

    // Create missing indexes
    await client.query("CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status)");
    await client.query("CREATE INDEX IF NOT EXISTS hw_sessions_status_idx ON hw_sessions(status)");

    await client.query("COMMIT");
    console.log("[DB] PostgreSQL Migrations complete successfully");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[DB] PostgreSQL Migration failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
