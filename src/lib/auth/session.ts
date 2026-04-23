import { cookies } from "next/headers";
import { verifyToken, type JWTPayload } from "./jwt";

/**
 * Get the current authenticated user from the request cookies.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
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
export function hasMinRole(role: string, minRole: "student" | "researcher" | "admin"): boolean {
  const levels: Record<string, number> = { student: 0, researcher: 1, admin: 2 };
  return (levels[role] ?? 0) >= (levels[minRole] ?? 0);
}
