import { NextRequest, NextResponse } from "next/server";
import { detectDevices, detectNetworkDevices } from "@/lib/fpga/detect";
import { getSession } from "@/lib/auth/session";
import { syncHardwareRegistry } from "@/lib/hardware/device-registry";

/**
 * Mapping of IDCODE prefixes to board metadata
 */
const BOARD_TEMPLATES: Record<string, { name: string; fpgaFamily: string; boardType: string; capabilities: string[] }> = {
  "0362d093": {
    name: "Basys 3",
    fpgaFamily: "Xilinx Artix-7",
    boardType: "basys3",
    capabilities: ["led", "uart", "switches", "buttons", "display"],
  },
  "13631093": {
    name: "Nexys A7",
    fpgaFamily: "Xilinx Artix-7",
    boardType: "nexysA7",
    capabilities: ["led", "uart", "switches", "buttons", "display", "ethernet"],
  },
  "03727093": {
    name: "PYNQ-Z2",
    fpgaFamily: "Xilinx Zynq-7000",
    boardType: "pynq-z2",
    capabilities: ["led", "uart", "ethernet", "python"],
  },
  "031050dd": {
    name: "DE10-Lite",
    fpgaFamily: "Intel MAX 10",
    boardType: "de10lite",
    capabilities: ["led", "switches", "display"],
  },
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Detect FPGA Hardware via JTAG
    const result = await detectDevices();
    const { devices, rawOutput } = result;
    
    // Enrich hardware with templates
    const enrichedHardware = devices.map(h => {
      const cleanId = h.idcode.toLowerCase().replace("0x", "");
      const template = BOARD_TEMPLATES[cleanId] || null;
      return { ...h, template };
    });

    // 2. Scan for Network Connected Devices (PYNQ, XVC, SSH)
    const networkDevices = await detectNetworkDevices();

    // 3. Scan & Sync Hardware Registry (Cameras & UART Ports)
    const registeredDevices = await syncHardwareRegistry();
    
    const cameras = registeredDevices
      .filter((d) => d.type === "camera" && d.status !== "OFFLINE")
      .map((d) => ({
        id: d.id,
        deviceNode: d.deviceNode,
        preferredPath: d.preferredPath,
        byId: d.byId,
        byPath: d.byPath,
        isPersistent: d.isPersistent,
        model: d.model,
        manufacturer: d.manufacturer,
        serialNumber: d.serialNumber,
        usbBus: d.usbBus,
        usbPort: d.usbPort,
        status: d.status,
        assignedBoardId: d.assignedBoardId,
        previewUrl: `/api/admin/hardware/cameras/${d.id}/preview`,
      }));

    const serialPorts = registeredDevices
      .filter((d) => d.type === "uart" && d.status !== "OFFLINE")
      .map((d) => ({
        id: d.id,
        deviceNode: d.deviceNode,
        preferredPath: d.preferredPath,
        byId: d.byId,
        byPath: d.byPath,
        isPersistent: d.isPersistent,
        model: d.model,
        manufacturer: d.manufacturer,
        serialNumber: d.serialNumber,
        usbBus: d.usbBus,
        usbPort: d.usbPort,
        status: d.status,
        assignedBoardId: d.assignedBoardId,
      }));

    return NextResponse.json({ 
      hardware: enrichedHardware, 
      networkDevices,
      serialPorts,
      cameras,
      rawOutput
    });
  } catch (error) {
    console.error("[Admin] Detection error:", error);
    return NextResponse.json({ error: "Failed to scan hardware" }, { status: 500 });
  }
}
