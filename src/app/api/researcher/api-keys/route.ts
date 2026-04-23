import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { randomBytes, createHash } from "crypto";
import { sqlite } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoleConfig } from "@/lib/roles";

// GET — list API keys (without secrets)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canGenerateApiKeys)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const keys = sqlite
    .prepare(
      "SELECT id, name, prefix, last_used_at, expires_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(session.userId);

  return NextResponse.json({ keys });
}

// POST — create new key
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = getRoleConfig(session.role);
  if (!cfg.canGenerateApiKeys)
    return NextResponse.json({ error: "Researcher account required" }, { status: 403 });

  const { name, expiresInDays } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Key name required" }, { status: 400 });

  // Max 5 keys per user
  const count = (sqlite.prepare("SELECT COUNT(*) as c FROM api_keys WHERE user_id = ?").get(session.userId) as any)?.c || 0;
  if (count >= 5)
    return NextResponse.json({ error: "Maximum 5 API keys" }, { status: 400 });

  const id = uuid();
  const rawKey = `fpga_${randomBytes(32).toString("hex")}`;
  const prefix = rawKey.substring(0, 12) + "...";
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  sqlite
    .prepare("INSERT INTO api_keys (id, user_id, name, key_hash, prefix, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, session.userId, name.trim(), keyHash, prefix, expiresAt);

  return NextResponse.json({
    success: true,
    key: rawKey,
    id,
    prefix,
    warning: "Save this key now — it cannot be shown again.",
  });
}

// DELETE — revoke key
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

  sqlite.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(id, session.userId);
  return NextResponse.json({ success: true });
}
