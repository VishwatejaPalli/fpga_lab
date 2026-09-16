import jwt from "jsonwebtoken";
import db from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { hwSessions, jobs } from "@/lib/db/schema";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((res, c) => {
    const parts = c.trim().split("=");
    if (parts.length < 2) return res;
    const key = parts[0];
    const val = parts.slice(1).join("=");
    try {
      res[key] = decodeURIComponent(val);
    } catch {
      res[key] = val;
    }
    return res;
  }, {} as Record<string, string>);
}

export function authenticateRequest(req: { headers: { cookie?: string } }): AuthenticatedUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.token;
  if (!token) return null;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
    return jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export async function verifyUserSession(
  userOrId: string | AuthenticatedUser,
  boardId: string,
  role?: string
): Promise<boolean> {
  try {
    const userId = typeof userOrId === "string" ? userOrId : userOrId.userId;
    const userRole = typeof userOrId === "string" ? role : userOrId.role;

    if (userRole === "admin") {
      return true;
    }

    const active = await db
      .select({ id: hwSessions.id })
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.userId, userId),
          eq(hwSessions.status, "active"),
          sql`${hwSessions.expiresAt}::timestamptz > NOW()`
        )
      );
    return active.length > 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Auth] Error verifying user session:", message);
    return false;
  }
}

export async function verifyUserJob(user: AuthenticatedUser, jobId: string): Promise<boolean> {
  try {
    if (user.role === "admin" || user.role === "researcher") return true;
    const [job] = await db.select({ userId: jobs.userId }).from(jobs).where(eq(jobs.id, jobId));
    return job ? job.userId === user.userId : false;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Auth] Error verifying user job:", message);
    return false;
  }
}
