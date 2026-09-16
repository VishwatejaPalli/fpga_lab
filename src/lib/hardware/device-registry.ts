import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import db from "@/lib/db";
import { hardwareDevices, boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export interface HardwareFingerprint {
  vendorId?: string | null;
  productId?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  usbBus?: string | null;
  usbPort?: string | null;
}

export interface DiscoveredDevice {
  id?: string;
  type: "camera" | "uart" | "jtag";
  deviceNode: string;
  byId: string | null;
  byPath: string | null;
  preferredPath: string;
  isPersistent: boolean;
  fingerprint: HardwareFingerprint;
  capabilities: string[];
  status: "DISCOVERED" | "AVAILABLE" | "ASSIGNED" | "IN_USE" | "OFFLINE" | "NEEDS_REVALIDATION" | "ERROR";
  assignedBoardId?: string | null;
}

function safeReadSysfs(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8").trim();
    }
  } catch {}
  return null;
}

/**
 * Scan video capture devices via sysfs & /dev/v4l/
 */
export function scanVideoDevices(): DiscoveredDevice[] {
  const devices: DiscoveredDevice[] = [];
  const v4lSysPath = "/sys/class/video4linux";

  // Build lookup maps for /dev/v4l/by-id and /dev/v4l/by-path
  const byIdMap = new Map<string, string>(); // realPath -> byIdSymlink
  const byPathMap = new Map<string, string>(); // realPath -> byPathSymlink

  try {
    if (fs.existsSync("/dev/v4l/by-id")) {
      const files = fs.readdirSync("/dev/v4l/by-id");
      for (const file of files) {
        const fullPath = path.join("/dev/v4l/by-id", file);
        try {
          const real = fs.realpathSync(fullPath);
          byIdMap.set(real, fullPath);
        } catch {}
      }
    }
  } catch {}

  try {
    if (fs.existsSync("/dev/v4l/by-path")) {
      const files = fs.readdirSync("/dev/v4l/by-path");
      for (const file of files) {
        const fullPath = path.join("/dev/v4l/by-path", file);
        try {
          const real = fs.realpathSync(fullPath);
          byPathMap.set(real, fullPath);
        } catch {}
      }
    }
  } catch {}

  if (fs.existsSync(v4lSysPath)) {
    try {
      const nodes = fs.readdirSync(v4lSysPath);
      for (const node of nodes) {
        // e.g. video0, video1
        if (!node.startsWith("video")) continue;
        const nodeDir = path.join(v4lSysPath, node);

        // 1. Ghost Node Filtering: verify the dev node and index are readable
        const devNum = safeReadSysfs(path.join(nodeDir, "dev"));
        if (!devNum) continue;

        // 2. Metadata vs Capture Node: check device index (index 0 is capture, index > 0 is metadata)
        const indexStr = safeReadSysfs(path.join(nodeDir, "index"));
        const index = indexStr ? parseInt(indexStr, 10) : 0;
        if (index > 0) {
          // Skip metadata-only auxiliary streams
          continue;
        }

        const deviceNode = `/dev/${node}`;
        const realNode = fs.existsSync(deviceNode) ? fs.realpathSync(deviceNode) : deviceNode;

        const name = safeReadSysfs(path.join(nodeDir, "name")) || "USB Camera";

        // Read USB hardware properties if connected via USB
        let vendorId: string | null = null;
        let productId: string | null = null;
        let serialNumber: string | null = null;
        let manufacturer: string | null = null;
        let usbBus: string | null = null;
        let usbPort: string | null = null;

        // Traverse up sysfs to locate parent USB device node
        const deviceLink = path.join(nodeDir, "device");
        if (fs.existsSync(deviceLink)) {
          try {
            const resolvedDevice = fs.realpathSync(deviceLink);
            let cur = resolvedDevice;
            for (let i = 0; i < 4; i++) {
              if (fs.existsSync(path.join(cur, "idVendor"))) {
                vendorId = safeReadSysfs(path.join(cur, "idVendor"));
                productId = safeReadSysfs(path.join(cur, "idProduct"));
                serialNumber = safeReadSysfs(path.join(cur, "serial"));
                manufacturer = safeReadSysfs(path.join(cur, "manufacturer"));
                usbBus = safeReadSysfs(path.join(cur, "busnum"));
                usbPort = safeReadSysfs(path.join(cur, "devpath"));
                break;
              }
              cur = path.dirname(cur);
            }
          } catch {}
        }

        const byId = byIdMap.get(realNode) || null;
        const byPath = byPathMap.get(realNode) || null;

        // Determine optimal persistent path
        let preferredPath = deviceNode;
        let isPersistent = false;

        if (byId && serialNumber && serialNumber.length > 3) {
          preferredPath = byId;
          isPersistent = true;
        } else if (byPath) {
          preferredPath = byPath;
          isPersistent = true;
        } else if (byId) {
          preferredPath = byId;
          isPersistent = true;
        }

        // Capabilities: query supported formats if v4l2-ctl is available
        const capabilities = ["video_capture"];
        try {
          const v4lFormats = execSync(`v4l2-ctl --list-formats -d ${deviceNode} 2>/dev/null`, { timeout: 1500 }).toString();
          if (v4lFormats.includes("MJPG") || v4lFormats.includes("Motion-JPEG")) capabilities.push("mjpeg");
          if (v4lFormats.includes("YUYV")) capabilities.push("yuyv");
          if (v4lFormats.includes("H264")) capabilities.push("h264");
        } catch {
          // Default baseline capability set
          capabilities.push("mjpeg", "yuyv");
        }

        devices.push({
          type: "camera",
          deviceNode,
          byId,
          byPath,
          preferredPath,
          isPersistent,
          fingerprint: {
            vendorId,
            productId,
            serialNumber,
            manufacturer,
            model: name,
            usbBus,
            usbPort,
          },
          capabilities,
          status: "AVAILABLE",
        });
      }
    } catch (err: any) {
      console.error("[DeviceRegistry] Error scanning video devices:", err.message);
    }
  }

  // Only generate mock devices if in test runner environment (Vitest)
  if (devices.length === 0 && process.env.NODE_ENV === "test" && process.env.ENABLE_MOCK_HARDWARE === "true") {
    devices.push(
      {
        type: "camera",
        deviceNode: "/dev/video0",
        byId: "/dev/v4l/by-id/usb-Logitech_HD_Pro_Webcam_C920_A1001-video-index0",
        byPath: "/dev/v4l/by-path/pci-0000:00:14.0-usb-0:1.1:1.0-video-index0",
        preferredPath: "/dev/v4l/by-id/usb-Logitech_HD_Pro_Webcam_C920_A1001-video-index0",
        isPersistent: true,
        fingerprint: {
          vendorId: "046d",
          productId: "082d",
          serialNumber: "A1001-LOGI-C920",
          manufacturer: "Logitech",
          model: "HD Pro Webcam C920 (Board 1 Cam)",
          usbBus: "1",
          usbPort: "1.1",
        },
        capabilities: ["video_capture", "mjpeg", "yuyv", "1080p@30"],
        status: "AVAILABLE",
      },
      {
        type: "camera",
        deviceNode: "/dev/video2",
        byId: "/dev/v4l/by-id/usb-Logitech_HD_Pro_Webcam_C920_B2002-video-index0",
        byPath: "/dev/v4l/by-path/pci-0000:00:14.0-usb-0:1.2:1.0-video-index0",
        preferredPath: "/dev/v4l/by-id/usb-Logitech_HD_Pro_Webcam_C920_B2002-video-index0",
        isPersistent: true,
        fingerprint: {
          vendorId: "046d",
          productId: "082d",
          serialNumber: "B2002-LOGI-C920",
          manufacturer: "Logitech",
          model: "HD Pro Webcam C920 (Board 2 Cam)",
          usbBus: "1",
          usbPort: "1.2",
        },
        capabilities: ["video_capture", "mjpeg", "yuyv", "1080p@30"],
        status: "AVAILABLE",
      },
      {
        type: "camera",
        deviceNode: "/dev/video4",
        byId: "/dev/v4l/by-id/usb-Logitech_HD_Pro_Webcam_C920_C3003-video-index0",
        byPath: "/dev/v4l/by-path/pci-0000:00:14.0-usb-0:1.3:1.0-video-index0",
        preferredPath: "/dev/v4l/by-id/usb-Logitech_HD_Pro_Webcam_C920_C3003-video-index0",
        isPersistent: true,
        fingerprint: {
          vendorId: "046d",
          productId: "082d",
          serialNumber: "C3003-LOGI-C920",
          manufacturer: "Logitech",
          model: "HD Pro Webcam C920 (Board 3 Cam)",
          usbBus: "1",
          usbPort: "1.3",
        },
        capabilities: ["video_capture", "mjpeg", "yuyv", "1080p@30"],
        status: "AVAILABLE",
      }
    );
  }

  return devices;
}

/**
 * Scan UART serial devices via sysfs & /dev/serial/
 */
export function scanSerialDevices(): DiscoveredDevice[] {
  const devices: DiscoveredDevice[] = [];
  const ttySysPath = "/sys/class/tty";

  const byIdMap = new Map<string, string>();
  const byPathMap = new Map<string, string>();

  try {
    if (fs.existsSync("/dev/serial/by-id")) {
      const files = fs.readdirSync("/dev/serial/by-id");
      for (const file of files) {
        const fullPath = path.join("/dev/serial/by-id", file);
        try {
          const real = fs.realpathSync(fullPath);
          byIdMap.set(real, fullPath);
        } catch {}
      }
    }
  } catch {}

  try {
    if (fs.existsSync("/dev/serial/by-path")) {
      const files = fs.readdirSync("/dev/serial/by-path");
      for (const file of files) {
        const fullPath = path.join("/dev/serial/by-path", file);
        try {
          const real = fs.realpathSync(fullPath);
          byPathMap.set(real, fullPath);
        } catch {}
      }
    }
  } catch {}

  if (fs.existsSync(ttySysPath)) {
    try {
      const nodes = fs.readdirSync(ttySysPath);
      for (const node of nodes) {
        // e.g. ttyUSB0, ttyACM0
        if (!node.startsWith("ttyUSB") && !node.startsWith("ttyACM")) continue;
        const nodeDir = path.join(ttySysPath, node);

        const devNum = safeReadSysfs(path.join(nodeDir, "dev"));
        if (!devNum) continue;

        const deviceNode = `/dev/${node}`;
        const realNode = fs.existsSync(deviceNode) ? fs.realpathSync(deviceNode) : deviceNode;

        let vendorId: string | null = null;
        let productId: string | null = null;
        let serialNumber: string | null = null;
        let manufacturer: string | null = null;
        let model: string | null = null;
        let usbBus: string | null = null;
        let usbPort: string | null = null;

        const deviceLink = path.join(nodeDir, "device");
        if (fs.existsSync(deviceLink)) {
          try {
            const resolved = fs.realpathSync(deviceLink);
            let cur = resolved;
            for (let i = 0; i < 5; i++) {
              if (fs.existsSync(path.join(cur, "idVendor"))) {
                vendorId = safeReadSysfs(path.join(cur, "idVendor"));
                productId = safeReadSysfs(path.join(cur, "idProduct"));
                serialNumber = safeReadSysfs(path.join(cur, "serial"));
                manufacturer = safeReadSysfs(path.join(cur, "manufacturer"));
                model = safeReadSysfs(path.join(cur, "product")) || "USB Serial Adapter";
                usbBus = safeReadSysfs(path.join(cur, "busnum"));
                usbPort = safeReadSysfs(path.join(cur, "devpath"));
                break;
              }
              cur = path.dirname(cur);
            }
          } catch {}
        }

        const byId = byIdMap.get(realNode) || null;
        const byPath = byPathMap.get(realNode) || null;

        let preferredPath = deviceNode;
        let isPersistent = false;

        if (byId && serialNumber && serialNumber.length > 2) {
          preferredPath = byId;
          isPersistent = true;
        } else if (byPath) {
          preferredPath = byPath;
          isPersistent = true;
        } else if (byId) {
          preferredPath = byId;
          isPersistent = true;
        }

        devices.push({
          type: "uart",
          deviceNode,
          byId,
          byPath,
          preferredPath,
          isPersistent,
          fingerprint: {
            vendorId,
            productId,
            serialNumber,
            manufacturer: manufacturer || "FTDI/SiliconLabs",
            model: model || (node.startsWith("ttyACM") ? "CDC ACM UART" : "FTDI FT232R UART"),
            usbBus,
            usbPort,
          },
          capabilities: ["baud_9600", "baud_19200", "baud_38400", "baud_57600", "baud_115200", "baud_921600"],
          status: "AVAILABLE",
        });
      }
    } catch (err: any) {
      console.error("[DeviceRegistry] Error scanning serial devices:", err.message);
    }
  }

  // Only generate mock UARTs if in test runner environment (Vitest)
  if (devices.length === 0 && process.env.NODE_ENV === "test" && process.env.ENABLE_MOCK_HARDWARE === "true") {
    devices.push(
      {
        type: "uart",
        deviceNode: "/dev/ttyUSB0",
        byId: "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_FT9876A1-if00-port0",
        byPath: "/dev/serial/by-path/pci-0000:00:14.0-usb-0:1.1:1.0-port0",
        preferredPath: "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_FT9876A1-if00-port0",
        isPersistent: true,
        fingerprint: {
          vendorId: "0403",
          productId: "6001",
          serialNumber: "FT9876A1",
          manufacturer: "FTDI",
          model: "FT232R USB UART (Board 1 UART)",
          usbBus: "1",
          usbPort: "1.1",
        },
        capabilities: ["baud_9600", "baud_115200", "baud_921600"],
        status: "AVAILABLE",
      },
      {
        type: "uart",
        deviceNode: "/dev/ttyUSB1",
        byId: "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_FT9876B2-if00-port0",
        byPath: "/dev/serial/by-path/pci-0000:00:14.0-usb-0:1.2:1.0-port0",
        preferredPath: "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_FT9876B2-if00-port0",
        isPersistent: true,
        fingerprint: {
          vendorId: "0403",
          productId: "6001",
          serialNumber: "FT9876B2",
          manufacturer: "FTDI",
          model: "FT232R USB UART (Board 2 UART)",
          usbBus: "1",
          usbPort: "1.2",
        },
        capabilities: ["baud_9600", "baud_115200", "baud_921600"],
        status: "AVAILABLE",
      },
      {
        type: "uart",
        deviceNode: "/dev/ttyUSB2",
        byId: "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_FT9876C3-if00-port0",
        byPath: "/dev/serial/by-path/pci-0000:00:14.0-usb-0:1.3:1.0-port0",
        preferredPath: "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_FT9876C3-if00-port0",
        isPersistent: true,
        fingerprint: {
          vendorId: "0403",
          productId: "6001",
          serialNumber: "FT9876C3",
          manufacturer: "FTDI",
          model: "FT232R USB UART (Board 3 UART)",
          usbBus: "1",
          usbPort: "1.3",
        },
        capabilities: ["baud_9600", "baud_115200", "baud_921600"],
        status: "AVAILABLE",
      }
    );
  }

  return devices;
}

/**
 * Scan all hardware and synchronize with the database `hardware_devices` table.
 */
export async function syncHardwareRegistry() {
  const discovered = [...scanVideoDevices(), ...scanSerialDevices()];
  const now = new Date().toISOString();

  // Fetch all existing hardware device records
  const existingDevices = await db.select().from(hardwareDevices);
  const existingMap = new Map<string, typeof hardwareDevices.$inferSelect>();
  
  // Index by preferredPath and by serial number if present
  for (const ed of existingDevices) {
    existingMap.set(ed.preferredPath, ed);
    if (ed.serialNumber) {
      existingMap.set(`sn:${ed.type}:${ed.serialNumber}`, ed);
    }
  }

  const seenIds = new Set<string>();

  for (const dev of discovered) {
    // Check if we already have this device by serial number or preferredPath
    const snKey = dev.fingerprint.serialNumber ? `sn:${dev.type}:${dev.fingerprint.serialNumber}` : null;
    const existing = (snKey && existingMap.get(snKey)) || existingMap.get(dev.preferredPath);

    const deviceId = existing ? existing.id : `dev_${dev.type}_${uuid().substring(0, 8)}`;
    seenIds.add(deviceId);

    // Keep ASSIGNED / IN_USE status if already assigned to a board
    let targetStatus = dev.status;
    if (existing && (existing.status === "ASSIGNED" || existing.status === "IN_USE")) {
      targetStatus = existing.status;
    }

    if (existing) {
      // Update device record
      await db
        .update(hardwareDevices)
        .set({
          deviceNode: dev.deviceNode,
          byId: dev.byId,
          byPath: dev.byPath,
          preferredPath: dev.preferredPath,
          isPersistent: dev.isPersistent,
          vendorId: dev.fingerprint.vendorId,
          productId: dev.fingerprint.productId,
          serialNumber: dev.fingerprint.serialNumber,
          manufacturer: dev.fingerprint.manufacturer,
          model: dev.fingerprint.model,
          usbBus: dev.fingerprint.usbBus,
          usbPort: dev.fingerprint.usbPort,
          capabilities: JSON.stringify(dev.capabilities),
          status: targetStatus,
          lastSeen: now,
        })
        .where(eq(hardwareDevices.id, deviceId));
    } else {
      // Insert new device
      await db.insert(hardwareDevices).values({
        id: deviceId,
        type: dev.type,
        deviceNode: dev.deviceNode,
        byId: dev.byId,
        byPath: dev.byPath,
        preferredPath: dev.preferredPath,
        isPersistent: dev.isPersistent,
        vendorId: dev.fingerprint.vendorId,
        productId: dev.fingerprint.productId,
        serialNumber: dev.fingerprint.serialNumber,
        manufacturer: dev.fingerprint.manufacturer,
        model: dev.fingerprint.model,
        usbBus: dev.fingerprint.usbBus,
        usbPort: dev.fingerprint.usbPort,
        capabilities: JSON.stringify(dev.capabilities),
        status: targetStatus,
        firstSeen: now,
        lastSeen: now,
      });
    }
  }

  // Mark disconnected devices as OFFLINE (or prune unassigned mock devices)
  for (const ed of existingDevices) {
    if (!seenIds.has(ed.id)) {
      if (process.env.NODE_ENV !== "test" && !ed.assignedBoardId) {
        // Prune unassigned stale device
        await db.delete(hardwareDevices).where(eq(hardwareDevices.id, ed.id));
      } else {
        await db
          .update(hardwareDevices)
          .set({ status: "OFFLINE" })
          .where(eq(hardwareDevices.id, ed.id));

        // If this device was mapped to a board, mark board as DEGRADED
        if (ed.assignedBoardId) {
          await db
            .update(boards)
            .set({
              mappingStatus: "DEGRADED",
              lastError: `Hardware device ${ed.type} (${ed.model || ed.preferredPath}) went OFFLINE`,
            })
            .where(eq(boards.id, ed.assignedBoardId));
        }
      }
    }
  }

  return await db.select().from(hardwareDevices).where(eq(hardwareDevices.status, "AVAILABLE"));
}
