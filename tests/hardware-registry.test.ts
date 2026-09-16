import { describe, it, expect, beforeAll } from "vitest";
import { scanVideoDevices, scanSerialDevices, syncHardwareRegistry } from "../src/lib/hardware/device-registry";
import { runMigrations } from "../src/lib/db/migrate";

describe("Hardware Registry & Identity Management Tests", () => {
  beforeAll(async () => {
    process.env.ENABLE_MOCK_HARDWARE = "true";
    await runMigrations();
  });
  it("should scan and return video devices with persistent paths and fingerprints", () => {
    const cameras = scanVideoDevices();
    expect(cameras.length).toBeGreaterThan(0);

    for (const cam of cameras) {
      expect(cam.type).toBe("camera");
      expect(cam.preferredPath).toBeDefined();
      expect(cam.fingerprint).toBeDefined();
      expect(cam.capabilities).toContain("video_capture");
      // Check priority resolution
      if (cam.fingerprint.serialNumber && cam.byId) {
        expect(cam.preferredPath).toBe(cam.byId);
        expect(cam.isPersistent).toBe(true);
      }
    }
  });

  it("should scan and return UART devices with valid USB fingerprints and baud capabilities", () => {
    const uarts = scanSerialDevices();
    expect(uarts.length).toBeGreaterThan(0);

    for (const uart of uarts) {
      expect(uart.type).toBe("uart");
      expect(uart.preferredPath).toBeDefined();
      expect(uart.fingerprint).toBeDefined();
      expect(uart.capabilities).toContain("baud_115200");
      if (uart.byId && uart.fingerprint.serialNumber) {
        expect(uart.preferredPath).toBe(uart.byId);
      }
    }
  });

  it("should synchronize discovered hardware into the database registry", async () => {
    const synced = await syncHardwareRegistry();
    expect(synced.length).toBeGreaterThan(0);

    const cam = synced.find((d) => d.type === "camera");
    expect(cam).toBeDefined();
    expect(cam?.preferredPath).toBeDefined();
    expect(cam?.status).toBe("AVAILABLE");

    const uart = synced.find((d) => d.type === "uart");
    expect(uart).toBeDefined();
    expect(uart?.preferredPath).toBeDefined();
    expect(uart?.status).toBe("AVAILABLE");
  });
});
