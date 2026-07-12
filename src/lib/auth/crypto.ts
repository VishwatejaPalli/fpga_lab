import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const ITERATIONS = 10000;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-secret-change-me";
  return crypto.pbkdf2Sync(secret, "salt-fpga-remote-lab", ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypt a text string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Decrypts securely or returns the raw text if it is a legacy plaintext password.
 */
export function decryptSafe(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  
  // If it doesn't match the standard AES-256-GCM format, assume legacy plaintext
  if (encryptedText.split(":").length !== 3) {
    return encryptedText;
  }
  
  try {
    return decrypt(encryptedText);
  } catch {
    // Fallback in case of corruption or if plaintext contains colons
    return encryptedText;
  }
}
