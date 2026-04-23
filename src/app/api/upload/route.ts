import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth/session";
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
    const userDir = path.join(UPLOAD_DIR, session.userId);
    const fileDir = path.join(userDir, fileId);
    fs.mkdirSync(fileDir, { recursive: true });

    const filePath = path.join(fileDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      fileId,
      fileName: file.name,
      filePath,
      size: file.size,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
