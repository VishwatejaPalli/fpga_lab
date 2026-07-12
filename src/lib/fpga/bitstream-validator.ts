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
 * Parse Xilinx .bit header structure.
 */
export function parseXilinxHeader(filePath: string): BitstreamHeader | null {
  try {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;

    if (buffer.length < 20) return null;
    
    // First section dummy length
    const dummyLen = buffer.readUInt16BE(offset);
    offset += 2 + dummyLen;

    // Key 'a': Design Name
    if (buffer[offset] !== 0x61) return null;
    offset += 1;
    const designLen = buffer.readUInt16BE(offset);
    offset += 2;
    const designName = buffer.toString("utf8", offset, offset + designLen).replace(/\0/g, "");
    offset += designLen;

    // Key 'b': Part Name
    if (buffer[offset] !== 0x62) return null;
    offset += 1;
    const partLen = buffer.readUInt16BE(offset);
    offset += 2;
    const partName = buffer.toString("utf8", offset, offset + partLen).replace(/\0/g, "");
    offset += partLen;

    // Key 'c': Date
    if (buffer[offset] !== 0x63) return null;
    offset += 1;
    const dateLen = buffer.readUInt16BE(offset);
    offset += 2;
    const date = buffer.toString("utf8", offset, offset + dateLen).replace(/\0/g, "");
    offset += dateLen;

    // Key 'd': Time
    if (buffer[offset] !== 0x64) return null;
    offset += 1;
    const timeLen = buffer.readUInt16BE(offset);
    offset += 2;
    const time = buffer.toString("utf8", offset, offset + timeLen).replace(/\0/g, "");
    offset += timeLen;

    // Key 'e': Data length
    if (buffer[offset] !== 0x65) return null;
    offset += 1;
    const dataLength = buffer.readUInt32BE(offset);

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
  }
}

/**
 * Validate bitstream size, type, and target FPGA part compatability.
 */
export function validateBitstream(
  filePath: string,
  fileName: string,
  expectedFpgaFamily: string
): ValidationResult {
  const ext = path.extname(fileName).toLowerCase();
  const allowedExtensions = [".bit", ".bin", ".svf", ".sof", ".rbf"];
  
  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed types: ${allowedExtensions.join(", ")}`,
    };
  }

  // Size validation (Max 50MB)
  const maxBytes = 50 * 1024 * 1024;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > maxBytes) {
      return {
        valid: false,
        error: `File size exceeds 50MB limit (${(stats.size / (1024 * 1024)).toFixed(1)}MB)`,
      };
    }
  } catch {
    return { valid: false, error: "Unable to read file metadata" };
  }

  // If Xilinx .bit file, parse header properties
  if (ext === ".bit") {
    const header = parseXilinxHeader(filePath);
    if (!header) {
      return {
        valid: false,
        error: "Failed to parse Xilinx bitstream header. File may be corrupted.",
      };
    }

    // Verify part name maps to board family
    // E.g. Basys 3 has "Artix-7" chip "xc7a35t"
    if (header.partName && expectedFpgaFamily) {
      const partLower = header.partName.toLowerCase();
      const familyLower = expectedFpgaFamily.toLowerCase();
      
      // Simple heuristic matching
      let isMatch = false;
      if (familyLower.includes("artix-7") && partLower.includes("xc7a")) isMatch = true;
      else if (familyLower.includes("zynq-7") && partLower.includes("xc7z")) isMatch = true;
      else if (familyLower.includes("kintex-7") && partLower.includes("xc7k")) isMatch = true;
      else if (familyLower.includes("virtex-7") && partLower.includes("xc7v")) isMatch = true;
      else if (familyLower.includes("spartan") && partLower.includes("xc7s")) isMatch = true;
      else if (familyLower.includes(partLower) || partLower.includes(familyLower)) isMatch = true;
      
      if (!isMatch) {
        return {
          valid: false,
          error: `Bitstream target part '${header.partName}' does not match allocated board chip '${expectedFpgaFamily}'`,
          header,
        };
      }
    }

    return { valid: true, header };
  }

  return { valid: true };
}
