import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || "./data/fpga_lab.db";

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
export default db;

// Guarantee initialization runs automatically when database is imported
if (typeof window === "undefined") {
  import("../init").then(({ ensureInit }) => {
    ensureInit();
  }).catch((err) => {
    console.error("[DB] Failed to auto-initialize server:", err);
  });
}

