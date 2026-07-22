import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fpga_lab";

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export default db;

// Compatibility adapter for raw SQLite queries to run on PostgreSQL pool
export const sqlite = {
  prepare(queryStr: string) {
    let pgQuery = queryStr;
    let index = 1;
    while (pgQuery.includes("?")) {
      pgQuery = pgQuery.replace("?", `$${index++}`);
    }
    // Convert common SQLite syntax to Postgres equivalents
    pgQuery = pgQuery.replace(/datetime\('now'\)/g, "NOW()");
    pgQuery = pgQuery.replace(/datetime\(reset_at\)/g, "reset_at::timestamp");

    return {
      async get(...params: any[]) {
        const flattened = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await pool.query(pgQuery, flattened);
        return res.rows[0];
      },
      async all(...params: any[]) {
        const flattened = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await pool.query(pgQuery, flattened);
        return res.rows;
      },
      async run(...params: any[]) {
        const flattened = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await pool.query(pgQuery, flattened);
        return {
          changes: res.rowCount,
          lastInsertRowid: null
        };
      }
    };
  }
};

// Guarantee initialization runs automatically when database is imported
if (typeof window === "undefined") {
  import("../init").then(({ ensureInit }) => {
    ensureInit();
  }).catch((err) => {
    console.error("[DB] Failed to auto-initialize server:", err);
  });
}


