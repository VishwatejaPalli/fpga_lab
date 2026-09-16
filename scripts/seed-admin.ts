#!/usr/bin/env npx tsx
/**
 * Seed script to create or upgrade the first admin user in PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Arguments:
 *   npx tsx scripts/seed-admin.ts --email admin@college.org --password admin123 --name "Lab Admin"
 */

import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { parseArgs } from "util";

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

async function main() {
  try {
    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    const existing = existingUsers[0];

    if (existing) {
      if (existing.role === "admin") {
        console.log(`✓ Admin user already exists: ${existing.email}`);
      } else {
        await db.update(users).set({ role: "admin", verified: true }).where(eq(users.id, existing.id));
        console.log(`✓ Upgraded existing user to admin: ${existing.email}`);
      }
    } else {
      const id = uuid();
      const passwordHash = bcrypt.hashSync(password, 12);
      await db.insert(users).values({
        id,
        email,
        passwordHash,
        name,
        role: "admin",
        verified: true,
      });
      console.log(`✓ Created admin user:`);
      console.log(`  Email:    ${email}`);
      console.log(`  Password: ${password}`);
      console.log(`  Name:     ${name}`);
      console.log(`\n  ⚠️  Change the default password after first login!`);
    }
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Failed to seed admin:", err.message || err);
    process.exit(1);
  }
}

main();
