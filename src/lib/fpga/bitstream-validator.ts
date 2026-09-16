import fs from "fs";
import path from "path";

export interface BitstreamHeader {
  designName?: string;
  partName?: string;
  date?: string;
  time?: string;
  dataLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  header?: BitstreamHeader;
}

/**
 * Parse Xilinx .bit header structure flexible search.
 */
export function parseXilinxHeader(filePath: string): BitstreamHeader | null {
  let fd: number | null = null;
  try {
    const HEADER_BUFFER_SIZE = 1024;
    const buffer = Buffer.alloc(HEADER_BUFFER_SIZE);
    fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(fd, buffer, 0, HEADER_BUFFER_SIZE, 0);
    if (bytesRead < 20) return null;

    const slice = buffer.subarray(0, bytesRead);

    // Search for key 'a' (0x61) within the first 120 bytes
    let aOffset = -1;
    const maxSearch = Math.min(120, bytesRead - 20);

    for (let i = 0; i < maxSearch; i++) {
      if (slice[i] === 0x61) {
        aOffset = i;
        break;
      }
    }

    if (aOffset === -1) return null;

    let offset = aOffset + 1;

    // Key 'a': Design Name
    const designLen = slice.readUInt16BE(offset);
    offset += 2;
    if (offset + designLen > bytesRead) return null;
    const designName = slice.toString("utf8", offset, offset + designLen).replace(/\0/g, "");
    offset += designLen;

    // Key 'b': Part Name
    if (offset >= bytesRead || slice[offset] !== 0x62) return null;
    offset += 1;
    const partLen = slice.readUInt16BE(offset);
    offset += 2;
    if (offset + partLen > bytesRead) return null;
    const partName = slice.toString("utf8", offset, offset + partLen).replace(/\0/g, "");
    offset += partLen;

    // Key 'c': Date
    if (offset >= bytesRead || slice[offset] !== 0x63) return null;
    offset += 1;
    const dateLen = slice.readUInt16BE(offset);
    offset += 2;
    if (offset + dateLen > bytesRead) return null;
    const date = slice.toString("utf8", offset, offset + dateLen).replace(/\0/g, "");
    offset += dateLen;

    // Key 'd': Time
    if (offset >= bytesRead || slice[offset] !== 0x64) return null;
    offset += 1;
    const timeLen = slice.readUInt16BE(offset);
    offset += 2;
    if (offset + timeLen > bytesRead) return null;
    const time = slice.toString("utf8", offset, offset + timeLen).replace(/\0/g, "");
    offset += timeLen;

    // Key 'e': Data length
    let dataLength: number | undefined = undefined;
    if (offset < bytesRead && slice[offset] === 0x65) {
      offset += 1;
      if (offset + 4 <= bytesRead) {
        dataLength = slice.readUInt32BE(offset);
      }
    }

    return {
      designName,
      partName,
      date,
      time,
      dataLength,
    };
  } catch (err) {
    console.error("[BitstreamValidator] Error parsing Xilinx .bit header:", err);
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

/**
 * Normalizes FPGA family and part strings for flexible compatibility matching,
 * handling common typos (e.g., 'sparatan' -> 'spartan') and formatting variations.
 */
export function normalizeFpgaString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\bsparatan\b/g, "spartan")
    .replace(/\bsparten\b/g, "spartan")
    .replace(/\bsparton\b/g, "spartan")
    .replace(/\bspatern\b/g, "spartan")
    .replace(/\bartix7\b/g, "artix-7")
    .replace(/\bzynq7\b/g, "zynq-7")
    .replace(/\bkintex7\b/g, "kintex-7")
    .replace(/\bvirtex7\b/g, "virtex-7");
}

/**
 * Validate bitstream size, type, and target FPGA part compatibility.
 */
export function validateBitstream(
  filePath: string,
  fileName: string,
  expectedFpgaFamily: string
): ValidationResult {
  const ext = path.extname(fileName).toLowerCase();
  const allowedExtensions = [
    ".bit", ".bin", ".svf", ".jed", ".mcs", ".rbf", ".sof", ".pof", ".cfg", ".fs", ".gw"
  ];

  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension (${ext}). Allowed types: ${allowedExtensions.join(", ")}`,
    };
  }

  // Size validation (Max 50MB, Min 16 Bytes)
  const maxBytes = 50 * 1024 * 1024;
  let fileSize = 0;
  try {
    const stats = fs.statSync(filePath);
    fileSize = stats.size;
    if (fileSize > maxBytes) {
      return {
        valid: false,
        error: `File size exceeds 50MB limit (${(fileSize / (1024 * 1024)).toFixed(1)}MB)`,
      };
    }
    if (fileSize < 16) {
      return {
        valid: false,
        error: "Bitstream file is too small or corrupted (< 16 bytes)",
      };
    }
  } catch {
    return { valid: false, error: "Unable to read bitstream file metadata" };
  }

  // If Xilinx .bit file, parse header properties if available
  if (ext === ".bit") {
    const header = parseXilinxHeader(filePath);

    // If Vivado ASCII header is present, perform target chip compatibility check
    if (header && header.partName && expectedFpgaFamily) {
      const normFamily = normalizeFpgaString(expectedFpgaFamily);
      const normPart = normalizeFpgaString(header.partName);

      // Flexible chip architecture matching
      let isMatch = false;

      // Spartan family (Spartan-3 / 3E / 3A / 3AN, Spartan-6, Spartan-7)
      if (
        normFamily.includes("spartan") ||
        normFamily.includes("3s") ||
        normFamily.includes("6s") ||
        normFamily.includes("7s")
      ) {
        if (
          normPart.includes("spartan") ||
          normPart.startsWith("3s") ||
          normPart.startsWith("xc3s") ||
          normPart.startsWith("6s") ||
          normPart.startsWith("xc6s") ||
          normPart.startsWith("7s") ||
          normPart.startsWith("xc7s")
        ) {
          isMatch = true;
        }
      }

      // Artix-7
      if (!isMatch && (normFamily.includes("artix") || normFamily.includes("xc7a") || normFamily.includes("7a"))) {
        if (normPart.includes("artix") || normPart.includes("xc7a") || normPart.startsWith("7a")) {
          isMatch = true;
        }
      }

      // Zynq-7000
      if (!isMatch && (normFamily.includes("zynq") || normFamily.includes("xc7z") || normFamily.includes("7z"))) {
        if (normPart.includes("zynq") || normPart.includes("xc7z") || normPart.startsWith("7z")) {
          isMatch = true;
        }
      }

      // Kintex-7
      if (!isMatch && (normFamily.includes("kintex") || normFamily.includes("xc7k") || normFamily.includes("7k"))) {
        if (normPart.includes("kintex") || normPart.includes("xc7k") || normPart.startsWith("7k")) {
          isMatch = true;
        }
      }

      // Virtex-7
      if (!isMatch && (normFamily.includes("virtex") || normFamily.includes("xc7v") || normFamily.includes("7v"))) {
        if (normPart.includes("virtex") || normPart.includes("xc7v") || normPart.startsWith("7v")) {
          isMatch = true;
        }
      }

      // Gowin / iCE40
      if (!isMatch && (normFamily.includes("gowin") || normFamily.includes("gw1n") || normFamily.includes("ice40") || normFamily.includes("ice"))) {
        if (normPart.includes("gowin") || normPart.includes("gw") || normPart.includes("ice")) {
          isMatch = true;
        }
      }

      // Intel / Altera
      if (!isMatch && (normFamily.includes("max") || normFamily.includes("cyclone") || normFamily.includes("intel") || normFamily.includes("altera"))) {
        if (normPart.includes("10m") || normPart.includes("ep4") || normPart.includes("5c") || normPart.includes("max") || normPart.includes("cyclone")) {
          isMatch = true;
        }
      }

      // Substring & cleaned alphanumeric fallback match
      if (!isMatch) {
        const cleanFamily = normFamily.replace(/[^a-z0-9]/g, "");
        const cleanPart = normPart.replace(/[^a-z0-9]/g, "");
        if (
          cleanFamily.length > 0 &&
          cleanPart.length > 0 &&
          (cleanFamily.includes(cleanPart) ||
           cleanPart.includes(cleanFamily) ||
           normFamily.includes(normPart) ||
           normPart.includes(normFamily))
        ) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        return {
          valid: false,
          error: `Bitstream target part '${header.partName}' does not match allocated board chip '${expectedFpgaFamily}'`,
          header,
        };
      }
      return { valid: true, header };
    }

    // Raw/headerless bitstream payload (e.g. demo bitstreams or open-source toolchain binaries)
    return { valid: true, header: header || undefined };
  }

  return { valid: true };
}
