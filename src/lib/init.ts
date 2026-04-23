/**
 * Server initialization — runs migrations and starts background services.
 * This is imported once on server startup.
 */
import { runMigrations } from "@/lib/db/migrate";
import { jobQueue } from "@/lib/fpga/queue";
import { sessionEnforcer } from "@/lib/sessions/enforcer";
import { uartService } from "@/lib/hardware/uart";

let initialized = false;

export function initializeServer() {
  if (initialized) return;
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

  console.log("[Init] Server initialized successfully");
}

// Auto-initialize when this module is first imported
initializeServer();
