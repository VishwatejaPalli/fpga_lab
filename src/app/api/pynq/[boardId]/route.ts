import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // const { boardId } = await params;

  // Mock telemetry data for PYNQ-Z2
  return NextResponse.json({
    status: "online",
    telemetry: {
      cpu: {
        temp: (42 + Math.random() * 8).toFixed(1) + "°C",
        load: [ (Math.random() * 5).toFixed(1), (Math.random() * 3).toFixed(1) ],
        freq: "650 MHz"
      },
      memory: {
        total: "512 MB",
        used: (120 + Math.random() * 40).toFixed(0) + " MB",
        percent: ((120 + Math.random() * 40) / 5.12).toFixed(1) + "%"
      },
      fpga: {
        overlay: "base.bit",
        power: (0.8 + Math.random() * 0.4).toFixed(2) + " W",
        clock: "100 MHz"
      },
      network: {
        ip: "192.168.1.105",
        uptime: "12h 45m"
      }
    }
  });
}
