import { describe, it, expect } from "vitest";

function sanitizeMac(mac: string): string {
  return mac.toLowerCase().replace(/[:-]/g, "");
}

function parseCapabilities(jsonStr: string | null): string[] {
  try {
    return JSON.parse(jsonStr || "[]");
  } catch {
    return [];
  }
}

describe("Board Identity & Registration Unit Tests", () => {
  it("should normalize MAC addresses cleanly for ARP table lookup", () => {
    expect(sanitizeMac("00:0A:35:00:01:02")).toBe("000a35000102");
    expect(sanitizeMac("00-0a-35-00-01-02")).toBe("000a35000102");
  });

  it("should parse board capability JSON lists accurately", () => {
    const raw = '["led", "uart", "camera", "switches"]';
    const caps = parseCapabilities(raw);
    expect(caps).toContain("led");
    expect(caps).toContain("camera");
    expect(caps.length).toBe(4);
  });
});
