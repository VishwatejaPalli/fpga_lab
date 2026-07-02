import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { v4 as uuid } from "uuid";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allUsers = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      verified: users.verified,
      createdAt: users.createdAt,
    })
    .from(users)
    .all();

  return NextResponse.json({ users: allUsers });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role } = await req.json();

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }

  const validRoles = ["student", "researcher", "admin"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent admin from demoting themselves
  if (userId === session.userId && role !== "admin") {
    return NextResponse.json(
      { error: "Cannot change your own admin role" },
      { status: 400 }
    );
  }

  db.update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .run();

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["student", "researcher", "admin"]).default("student"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, email, password, role } = parsed.data;

  // No server-side domain enforcement here (use ALLOWED_EMAIL_DOMAINS env if configured elsewhere)

  // Check if user exists
  const existing = db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();
  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const userId = uuid();
  const passwordHash = await hashPassword(password);

  db.insert(users)
    .values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      verified: true,
    })
    .run();

  return NextResponse.json({ ok: true, id: userId }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Prevent admin from deleting themselves
  if (userId === session.userId) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  db.delete(users).where(eq(users.id, userId)).run();

  return NextResponse.json({ ok: true });
}
