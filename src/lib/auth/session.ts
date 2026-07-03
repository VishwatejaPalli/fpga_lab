import { cookies, headers } from "next/headers";
import { verifyToken, type JWTPayload } from "./jwt";
import { sqlite } from "@/lib/db";
import { createHash } from "crypto";

interface ApiKeyRow {
  id: string;
  user_id: string;
  expires_at: string | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "guest" | "student" | "researcher" | "admin";
}

/**
 * Get the current authenticated user from the request cookies or Authorization header.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  // Fallback: Check Authorization header for API Keys (e.g. Bearer fpga_xxxx)
  try {
    const headerList = await headers();
    const authHeader = headerList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const apiKey = authHeader.substring(7).trim();
      const hash = createHash("sha256").update(apiKey).digest("hex");

      const keyRow = sqlite
        .prepare("SELECT id, user_id, expires_at FROM api_keys WHERE key_hash = ?")
        .get(hash) as ApiKeyRow | undefined;

      if (keyRow) {
        // Verify expiration
        if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
          return null;
        }

        // Update last_used_at timestamp asynchronously/non-blocking
        try {
          sqlite
            .prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
            .run(keyRow.id);
        } catch (e) {
          console.error("[Auth] Failed to update api key last_used_at:", e);
        }

        // Fetch user details
        const userRow = sqlite
          .prepare("SELECT id, email, name, role FROM users WHERE id = ?")
          .get(keyRow.user_id) as UserRow | undefined;

        if (userRow) {
          return {
            userId: userRow.id,
            email: userRow.email,
            role: userRow.role,
          };
        }
      }
    }
  } catch (err) {
    console.error("[Auth] Error reading authorization header:", err);
  }

  return null;
}

/**
 * Require authentication — throws if not logged in.
 */
export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Require admin role.
 */
export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

/**
 * Require researcher or admin role.
 */
export async function requireResearcher(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== "researcher" && session.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

/**
 * Check if user has at least the given role level.
 * Hierarchy: admin > researcher > student
 */
export function hasMinRole(role: string, minRole: "guest" | "student" | "researcher" | "admin"): boolean {
  const levels: Record<string, number> = { guest: -1, student: 0, researcher: 1, admin: 2 };
  return (levels[role] ?? -1) >= (levels[minRole] ?? -1);
}
