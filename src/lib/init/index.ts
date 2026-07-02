import { runMigrations } from "@/lib/db/migrate";
import { jobQueue } from "@/lib/fpga/queue";
import { sessionEnforcer } from "@/lib/sessions/enforcer";
import { uartService } from "@/lib/hardware/uart";
import { cameraService } from "@/lib/hardware/camera";

let initialized = false;

/**
 * Server initialization — runs migrations and starts background services.
 * This is called once on server startup.
 */
export function initializeServer() {
  if (initialized) return;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  initialized = true;

  console.log("[Init] Initializing server...");

  // Run database migrations
  runMigrations();

  // Start job queue processor
  jobQueue.start();

  // Start session enforcer
  sessionEnforcer.start();

  // Expose services globally for WebSocket handlers in server.js
  (globalThis as Record<string, unknown>).__jobQueue = jobQueue;
  (globalThis as Record<string, unknown>).__uartService = uartService;
  (globalThis as Record<string, unknown>).__cameraService = cameraService;

  console.log("[Init] Server initialized successfully");
}

/**
 * Ensures the initialization is executed.
 */
export function ensureInit() {
  initializeServer();
  return true;
}

// Auto-initialize when this module is first imported
initializeServer();
