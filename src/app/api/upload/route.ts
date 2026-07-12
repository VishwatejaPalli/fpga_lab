import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_SIZE =
  parseInt(process.env.MAX_UPLOAD_SIZE_MB || "50") * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".bit",
  ".bin",
  ".svf",
  ".jed",
  ".mcs",
  ".rbf",
  ".sof",
  ".pof",
  ".cfg",
  ".fs",
  ".gw",
]);

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
    const file = formData.get("bitstream") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No bitstream file provided" },
        { status: 400 }
      );
    }

    // Check extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `File type ${ext} not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size: ${process.env.MAX_UPLOAD_SIZE_MB || 50}MB`,
        },
        { status: 400 }
      );
    }

    // Save file
    const fileId = uuid();
    
    // Always store uploads relative to process.cwd() for consistent relative paths
    const relativeDir = path.join("uploads", session.userId, fileId);
    const absoluteDir = path.join(process.cwd(), relativeDir);
    fs.mkdirSync(absoluteDir, { recursive: true });

    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    const absoluteFilePath = path.join(absoluteDir, safeName);
    const relativeFilePath = path.join(relativeDir, safeName);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absoluteFilePath, buffer);

    return NextResponse.json({
      fileId,
      fileName: file.name,
      filePath: relativeFilePath,
      size: file.size,
    });
});
