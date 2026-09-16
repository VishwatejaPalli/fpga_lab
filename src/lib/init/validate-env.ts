/**
 * Production Environment Validator
 * Checks critical production environment variables on boot and halts server startup
 * if insecure default credentials or missing secrets are detected.
 */
export function validateEnv() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (isProduction) {
    if (!jwtSecret || jwtSecret === "dev-secret-change-me" || jwtSecret === "CHANGE_ME_TO_A_RANDOM_SECRET") {
      errors.push("FATAL: JWT_SECRET must be explicitly set to a secure random string in production.");
    }

    if (!encryptionKey || encryptionKey === "dev-secret-change-me" || encryptionKey === "CHANGE_ME_TO_A_RANDOM_SECRET") {
      errors.push("FATAL: ENCRYPTION_KEY must be explicitly set to a secure random key in production.");
    }

    if (!dbUrl) {
      errors.push("FATAL: DATABASE_URL is required in production environment.");
    }
  }

  if (errors.length > 0) {
    console.error("\n===========================================================");
    console.error(" 🚫 PRODUCTION ENVIRONMENT VALIDATION FAILURE");
    console.error("===========================================================");
    errors.forEach((err) => console.error(` - ${err}`));
    console.error("===========================================================\n");
    throw new Error(`Production environment validation failed with ${errors.length} error(s).`);
  }
}
