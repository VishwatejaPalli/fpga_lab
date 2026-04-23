#!/usr/bin/env npx tsx
/**
 * Seed script to create the first admin user.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * You can also pass arguments:
 *   npx tsx scripts/seed-admin.ts --email admin@college.org --password secret123 --name "Lab Admin"
 *
 * Or set environment variables:
 *   ADMIN_EMAIL=admin@college.org ADMIN_PASSWORD=secret123 ADMIN_NAME="Lab Admin" npx tsx scripts/seed-admin.ts
 */

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { parseArgs } from "util";

// Parse CLI args
const { values } = parseArgs({
  options: {
    email: { type: "string", short: "e" },
    password: { type: "string", short: "p" },
    name: { type: "string", short: "n" },
  },
  strict: false,
});

const email = (typeof values.email === "string" ? values.email : null) || process.env.ADMIN_EMAIL || "admin@college.org";
const password = (typeof values.password === "string" ? values.password : null) || process.env.ADMIN_PASSWORD || "admin123";
const name = (typeof values.name === "string" ? values.name : null) || process.env.ADMIN_NAME || "Lab Administrator";

const DB_PATH = process.env.DB_PATH || "./data/fpga_lab.db";

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure users table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Check if admin already exists
const existing = db
  .prepare("SELECT id, email, role FROM users WHERE email = ?")
  .get(email) as { id: string; email: string; role: string } | undefined;

if (existing) {
  if (existing.role === "admin") {
    console.log(`✓ Admin user already exists: ${existing.email}`);
  } else {
    // Upgrade to admin
    db.prepare("UPDATE users SET role = 'admin', verified = 1 WHERE id = ?").run(
      existing.id
    );
    console.log(`✓ Upgraded existing user to admin: ${existing.email}`);
  }
} else {
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 12);

  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, verified) VALUES (?, ?, ?, ?, 'admin', 1)"
  ).run(id, email, passwordHash, name);

  console.log(`✓ Created admin user:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name:     ${name}`);
  console.log(`\n  ⚠️  Change the default password after first login!`);
}

db.close();
