import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitStore>();

/**
 * Basic in-memory rate limiter.
 * In a real production environment with multiple nodes, use Redis.
 */
export function rateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = store.get(ip);

  if (!record) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (now > record.resetAt) {
    // Window expired, reset
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Standardized API Error format
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}

/**
 * Wraps a Next.js App Router API handler to provide centralized error handling and structured logging.
 */
export function withErrorHandler(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error: any) {
      // Structured logging (in production use Pino/Winston)
      console.error(`[API ERROR] ${req.method} ${req.nextUrl.pathname}`, {
        message: error?.message || "Unknown error",
        stack: error?.stack,
      });

      // Avoid leaking internal paths or sensitive DB errors to the client
      const isDev = process.env.NODE_ENV !== "production";
      
      const response: ApiError = {
        error: "Internal server error",
        ...(isDev ? { details: error?.message } : {}),
      };

      return NextResponse.json(response, { status: 500 });
    }
  };
}
