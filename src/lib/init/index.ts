import { runMigrations } from "@/lib/db/migrate";
import { db } from "@/lib/db";
import { jobs, batchJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { jobQueue } from "@/lib/fpga/queue";
import { sessionEnforcer } from "@/lib/sessions/enforcer";
import { uartService } from "@/lib/hardware/uart";
import { sshService } from "@/lib/hardware/ssh";
import { cameraService } from "@/lib/hardware/camera";
import { boardHealthMonitor } from "@/lib/hardware/board-health";
import { syncHardwareRegistry } from "@/lib/hardware/device-registry";
import { PynqConnectionManager } from "@/lib/hardware/connection-manager";

import { validateEnv } from "./validate-env";

let initialized = false;

/**
 * Server initialization — runs migrations and starts background services.
 * This is called once on server startup.
 */
export async function initializeServer() {
  if (initialized) return;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  initialized = true;

  // Validate critical production environment secrets
  validateEnv();

  console.log("[Init] Initializing server...");

  try {
    // Run database migrations
    await runMigrations();

    // Start job queue processor
    jobQueue.start();

    // Listen to JTAG job completions to update parent batch status dynamically
    jobQueue.on("job-complete", async (data) => {
      try {
        const jobId = data.jobId;
        const [jobRecord] = await db
          .select({ batchId: jobs.batchId, status: jobs.status })
          .from(jobs)
          .where(eq(jobs.id, jobId));

        if (jobRecord && jobRecord.batchId) {
          const batchId = jobRecord.batchId;

          // Count sub-jobs in this batch
          const subJobs = await db
            .select({ status: jobs.status })
            .from(jobs)
            .where(eq(jobs.batchId, batchId));

          const total = subJobs.length;
          const completed = subJobs.filter((sj) => sj.status === "success").length;
          const failed = subJobs.filter((sj) => sj.status === "failed" || sj.status === "cancelled").length;
          const done = completed + failed;

          if (done === total) {
            const finalStatus: "completed" | "failed" = failed > 0 && completed === 0 ? "failed" : "completed";
            await db
              .update(batchJobs)
              .set({
                status: finalStatus,
                completedAt: new Date().toISOString(),
              })
              .where(eq(batchJobs.id, batchId));
          } else {
            await db
              .update(batchJobs)
              .set({ status: "running" })
              .where(eq(batchJobs.id, batchId));
          }
        }
      } catch (err) {
        console.error("[Batch] Error updating batch status on job complete:", err);
      }
    });

    // Start session enforcer
    sessionEnforcer.start();

    // Synchronize Hardware Device Registry on startup
    await syncHardwareRegistry();

    // Start board health monitor
    boardHealthMonitor.start();

    // Expose services globally for WebSocket handlers in server.js
    (globalThis as Record<string, unknown>).__jobQueue = jobQueue;
    (globalThis as Record<string, unknown>).__uartService = uartService;
    (globalThis as Record<string, unknown>).__sshService = sshService;
    (globalThis as Record<string, unknown>).__cameraService = cameraService;
    (globalThis as Record<string, unknown>).__connectionManager = PynqConnectionManager;

    console.log("[Init] Server initialized successfully");
  } catch (err: any) {
    console.error("[Init] Server initialization failed:", err.message);
  }
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
