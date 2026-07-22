const Database = require("better-sqlite3");
const { Client } = require("pg");
const path = require("path");

const sqlitePath = process.env.DB_PATH || path.join(__dirname, "..", "data", "fpga_lab.db");
const pgUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fpga_lab";

console.log(`[Migration] Starting data transfer...`);
console.log(`[Migration] SQLite path: ${sqlitePath}`);
console.log(`[Migration] PostgreSQL URL: ${pgUrl}`);

async function run() {
  let sqliteDb;
  try {
    sqliteDb = new Database(sqlitePath, { fileMustExist: true });
  } catch (e) {
    console.error(`[Migration] Error: Could not find or open SQLite database at ${sqlitePath}`);
    process.exit(1);
  }

  const pgClient = new Client({ connectionString: pgUrl });
  await pgClient.connect();

  // 1. Fetch tables from SQLite
  const tables = sqliteDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'drizzle_%'")
    .all()
    .map(t => t.name);

  console.log(`[Migration] Found tables in SQLite: ${tables.join(", ")}`);

  // 2. Fetch boolean columns from PostgreSQL to dynamically map types (0/1 -> true/false)
  const boolColsRes = await pgClient.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND data_type = 'boolean'
  `);
  
  const boolCols = {};
  for (const r of boolColsRes.rows) {
    if (!boolCols[r.table_name]) boolCols[r.table_name] = new Set();
    boolCols[r.table_name].add(r.column_name);
  }

  // 3. Define import order to respect foreign key constraints
  const importOrder = [
    "users",
    "boards",
    "batch_jobs",
    "jobs",
    "hw_sessions",
    "board_reservations",
    "experiment_notes",
    "api_keys",
    "audit_logs",
    "verification_tokens",
    "password_reset_tokens",
    "refresh_tokens"
  ];

  // Include any other tables not in the hardcoded list
  for (const t of tables) {
    if (!importOrder.includes(t)) {
      importOrder.push(t);
    }
  }

  // Disable triggers/constraints temporarily to avoid order issues during transaction
  await pgClient.query("BEGIN");
  await pgClient.query("SET CONSTRAINTS ALL DEFERRED");

  try {
    for (const table of importOrder) {
      // Check if table exists in SQLite
      const checkTable = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
      if (!checkTable) {
        console.log(`[Migration] Table '${table}' does not exist in SQLite, skipping.`);
        continue;
      }

      // Fetch all rows
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      console.log(`[Migration] Table '${table}': migrating ${rows.length} rows...`);

      if (rows.length === 0) continue;

      // Clear existing records in PG to avoid duplicates
      await pgClient.query(`TRUNCATE TABLE ${table} CASCADE`);

      // Prepare insert statement
      const keys = Object.keys(rows[0]);
      
      // PostgreSQL snake_case mapping helper for fields
      const pgFields = keys.map(k => {
        // Map camelCase to snake_case if schema differences exist (drizzle translates camelCase fields to snake_case in pg)
        return k.replace(/([A-Z])/g, "_$1").toLowerCase();
      });

      const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
      const query = `INSERT INTO ${table} (${pgFields.join(", ")}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = keys.map(key => {
          let val = row[key];
          
          // Map boolean values dynamically based on information schema
          if (boolCols[table] && boolCols[table].has(key.replace(/([A-Z])/g, "_$1").toLowerCase())) {
            val = val === 1 || val === true;
          }
          
          return val;
        });

        await pgClient.query(query, values);
      }
    }

    await pgClient.query("COMMIT");
    console.log(`[Migration] Data migration completed successfully!`);
  } catch (err) {
    await pgClient.query("ROLLBACK");
    console.error(`[Migration] Fatal error, transaction rolled back:`, err);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

run().catch(console.error);
