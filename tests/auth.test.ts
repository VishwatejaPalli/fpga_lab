import { describe, it, expect } from "vitest";
import { signToken, verifyToken, type JWTPayload } from "../src/lib/auth/jwt";

describe("Authentication & JWT Security Unit Tests", () => {
  it("should successfully sign and verify a valid user token", () => {
    const payload: JWTPayload = {
      userId: "usr_test123",
      email: "student@vce.edu",
      role: "student",
      version: 1,
    };

    const token = signToken(payload, 3600);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("usr_test123");
    expect(decoded?.email).toBe("student@vce.edu");
    expect(decoded?.role).toBe("student");
  });

  it("should reject malformed or tampered JWT tokens", () => {
    const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
    const result = verifyToken(fakeToken);
    expect(result).toBeNull();
  });
});
