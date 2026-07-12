import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";

interface AuditLogOptions {
  userId?: string | null;
  action: string;
  target?: string | null;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log an event to the security audit trail.
 */
export function logAuditEvent(options: AuditLogOptions) {
  const { userId, action, target, metadata = {}, ipAddress, userAgent } = options;
  const id = uuid();
  const metaStr = typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  
  try {
    sqlite
      .prepare(
        "INSERT INTO audit_logs (id, user_id, action, target, ip_address, user_agent, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        id,
        userId || null,
        action,
        target || null,
        ipAddress || null,
        userAgent || null,
        metaStr
      );
  } catch (err: any) {
    console.error("[AuditLog] Failed to log audit event:", err.message);
  }
}
