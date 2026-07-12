import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (
  process.env.NODE_ENV === "production" &&
  JWT_SECRET === "dev-secret-change-me" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  console.error("FATAL: JWT_SECRET must be configured in production environment!");
  process.exit(1);
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  version?: number;
}

export function signToken(payload: JWTPayload, expiresInSeconds = 15 * 60): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
