import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import db from "@/lib/db";
import { boards, hwSessions, synthesisJobs } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import fs from "fs";
import path from "path";

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || "./uploads/workspaces";

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SAFE_FILENAME = /^[a-zA-Z0-9_][a-zA-Z0-9_.\-]*$/;

function sanitizeFilename(name: string): string | null {
  const base = path.basename(name);
  if (!SAFE_FILENAME.test(base)) return null;
  if (base.includes('..')) return null;
  return base;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { boardId } = await req.json();

    if (!boardId) {
      return NextResponse.json(
        { error: "Target board ID is required." },
        { status: 400 }
      );
    }

    const [board] = await db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId));

    if (!board) {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }

    // Allow synthesis if board is free OR if the active session belongs to the current user
    const [activeSession] = await db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.boardId, boardId),
          eq(hwSessions.status, "active")
        )
      );

    const [userSession] = await db
      .select()
      .from(hwSessions)
      .where(
        and(
          eq(hwSessions.userId, session.userId),
          eq(hwSessions.status, "active")
        )
      );

    const canUse =
      board.status === "free" ||
      (activeSession && userSession && activeSession.id === userSession.id);

    if (!canUse) {
      return NextResponse.json(
        { error: "Board is currently allocated by another user session." },
        { status: 409 }
      );
    }

    const jobId = uuid();
    const workDir = path.join(process.cwd(), "uploads", "synthesis", jobId);
    fs.mkdirSync(workDir, { recursive: true });

    const userWorkspaceDir = path.resolve(WORKSPACE_BASE_DIR, session.userId);
    if (!fs.existsSync(userWorkspaceDir)) {
      return NextResponse.json({ error: "Workspace empty. No files to synthesize." }, { status: 400 });
    }

    // Copy all Verilog & SystemVerilog files recursively from user workspace to temp synthesis folder flat
    const copiedFiles: string[] = [];
    const collectAndCopy = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
          collectAndCopy(fullPath);
        } else {
          const ext = path.extname(item).toLowerCase();
          if (ext === ".v" || ext === ".sv") {
            const safeName = sanitizeFilename(item);
            if (!safeName) {
              console.warn(`[Synthesis] Skipping file with unsafe name: ${item}`);
              continue;
            }
            const fileContent = fs.readFileSync(fullPath, "utf-8");
            const destPath = path.join(workDir, safeName);
            fs.writeFileSync(destPath, fileContent, "utf-8");
            copiedFiles.push(safeName);
          }
        }
      }
    };
    collectAndCopy(userWorkspaceDir);

    if (copiedFiles.length === 0) {
      return NextResponse.json({ error: "No Verilog or SystemVerilog files found in workspace." }, { status: 400 });
    }

    // Resolve top-level module
    let topModule = "";
    const projectJsonPath = path.join(userWorkspaceDir, "project.json");
    if (fs.existsSync(projectJsonPath)) {
      try {
        const projectData = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
        if (projectData.top_module) {
          topModule = projectData.top_module;
        }
      } catch (e) {}
    }

    if (!topModule) {
      // Look for module definitions in copied files
      for (const file of copiedFiles) {
        const fileContent = fs.readFileSync(path.join(workDir, file), "utf-8");
        const match = fileContent.match(/module\s+(\w+)/);
        if (match) {
          topModule = match[1];
          break;
        }
      }
    }

    if (!topModule) {
      topModule = "main";
    }

    // Validate topModule is a safe identifier (no shell metacharacters)
    if (!SAFE_IDENTIFIER.test(topModule)) {
      return NextResponse.json(
        { error: `Invalid top module name '${topModule}'. Only alphanumeric characters and underscores are allowed.` },
        { status: 400 }
      );
    }

    // Insert queued synthesis job into database
    await db.insert(synthesisJobs).values({
      id: jobId,
      userId: session.userId,
      boardId: boardId,
      status: "queued",
      topModule,
      workDir: path.relative(process.cwd(), workDir),
    });

    return NextResponse.json({ 
      success: true, 
      jobId,
      message: "Synthesis job enqueued successfully."
    }, { status: 201 });

  } catch (error: any) {
    console.error("[Synthesis API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
