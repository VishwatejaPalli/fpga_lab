import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";

interface RateLimitOptions {
  email: string;
  ipAddress: string;
  maxAttempts: number;
  windowMs: number;
}

export function checkRateLimit(options: RateLimitOptions): { allowed: boolean; remaining: number; resetAt: Date } {
  const { email, ipAddress, maxAttempts, windowMs } = options;
  const now = Date.now();
  const resetAtTime = now + windowMs;
  
  try {
    // Clean up expired records
    sqlite.prepare("DELETE FROM login_attempts WHERE datetime(reset_at) < datetime('now')").run();
  } catch (err) {
    console.error("[RateLimit] Clean error:", err);
  }
  
  try {
    // Find attempt record by email and IP
    let record = sqlite
      .prepare("SELECT id, count, reset_at FROM login_attempts WHERE email = ? AND ip_address = ?")
      .get(email, ipAddress) as { id: string; count: number; reset_at: string } | undefined;
      
    if (!record) {
      const id = uuid();
      const resetAtStr = new Date(resetAtTime).toISOString();
      sqlite
        .prepare("INSERT INTO login_attempts (id, email, ip_address, count, reset_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, email, ipAddress, 1, resetAtStr);
        
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetAt: new Date(resetAtTime),
      };
    }
    
    const recordResetAt = new Date(record.reset_at).getTime();
    
    if (now > recordResetAt) {
      // Window expired, reset count
      const resetAtStr = new Date(resetAtTime).toISOString();
      sqlite
        .prepare("UPDATE login_attempts SET count = 1, reset_at = ? WHERE id = ?")
        .run(resetAtStr, record.id);
        
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetAt: new Date(resetAtTime),
      };
    }
    
    if (record.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(recordResetAt),
      };
    }
    
    // Increment count
    sqlite
      .prepare("UPDATE login_attempts SET count = count + 1 WHERE id = ?")
      .run(record.id);
      
    return {
      allowed: true,
      remaining: maxAttempts - (record.count + 1),
      resetAt: new Date(recordResetAt),
    };
  } catch (err) {
    console.error("[RateLimit] DB error:", err);
    // If DB has an issue, fail open to avoid locked login screens, but log it
    return {
      allowed: true,
      remaining: 1,
      resetAt: new Date(resetAtTime),
    };
  }
}

export function clearRateLimit(email: string, ipAddress: string) {
  try {
    sqlite
      .prepare("DELETE FROM login_attempts WHERE email = ? AND ip_address = ?")
      .run(email, ipAddress);
  } catch (err) {
    console.error("[RateLimit] Clear error:", err);
  }
}
