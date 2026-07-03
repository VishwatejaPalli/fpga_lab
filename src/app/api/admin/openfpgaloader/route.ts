import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { getSession } from "@/lib/auth/session";

const ALLOWED_ACTIONS: Record<string, string[]> = {
  "detect": ["--detect"],
  "scan-usb": ["--scan-usb"],
  "list-boards": ["--list-boards"],
  "list-cables": ["--list-cables"],
  "list-fpga": ["--list-fpga"],
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { action, boardType, devicePath } = await req.json();

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    let args: string[] = [];

    // Simple predefined actions
    if (ALLOWED_ACTIONS[action]) {
      args = ALLOWED_ACTIONS[action];
    } else if (action === "reset") {
      if (!boardType && !devicePath) {
        return NextResponse.json({ error: "boardType or devicePath required for reset" }, { status: 400 });
      }
      args = ["-r"];
      if (boardType) args.push("-b", boardType);
      if (devicePath) args.push("-d", devicePath);
    } else if (action === "read-dna") {
      if (!boardType && !devicePath) {
        return NextResponse.json({ error: "boardType or devicePath required for read-dna" }, { status: 400 });
      }
      args = ["-D"];
      if (boardType) args.push("-b", boardType);
      if (devicePath) args.push("-d", devicePath);
    } else if (action === "read-xadc") {
      if (!boardType && !devicePath) {
        return NextResponse.json({ error: "boardType or devicePath required for read-xadc" }, { status: 400 });
      }
      args = ["-X"];
      if (boardType) args.push("-b", boardType);
      if (devicePath) args.push("-d", devicePath);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const command = `openFPGALoader ${args.join(" ")}`;
    
    return new Promise<Response>((resolve) => {
      exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
        const fullOutput = (stdout || "") + (stderr || "");
        
        // Even if there's an error (like openFPGALoader returning non-zero because a board isn't found),
        // we want to return the output to the user so they can read the CLI message.
        resolve(NextResponse.json({ 
          success: !error,
          output: fullOutput,
          command
        }));
      });
    });

  } catch (error) {
    console.error("[openFPGALoader API] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
