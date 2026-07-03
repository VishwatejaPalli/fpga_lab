import Database from "better-sqlite3";
const db = new Database("./data/fpga_lab.db");

try {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
} catch(e) { console.log(e.message); }

try {
  db.exec("ALTER TABLE users ADD COLUMN last_login TEXT;");
} catch(e) { console.log(e.message); }

console.log("Migration complete");
