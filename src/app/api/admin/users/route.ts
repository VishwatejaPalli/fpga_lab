import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

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
