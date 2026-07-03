import { runMigrations } from "@/lib/db/migrate";
import { sqlite } from "@/lib/db";
import { jobQueue } from "@/lib/fpga/queue";
import { sessionEnforcer } from "@/lib/sessions/enforcer";
import { uartService } from "@/lib/hardware/uart";
import { sshService } from "@/lib/hardware/ssh";
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

  // Listen to JTAG job completions to update parent batch status dynamically
  jobQueue.on("job-complete", (data) => {
    try {
      const jobId = data.jobId;
      const jobRecord = sqlite
        .prepare("SELECT batch_id, status FROM jobs WHERE id = ?")
        .get(jobId) as { batch_id: string | null; status: string } | undefined;

      if (jobRecord && jobRecord.batch_id) {
        const batchId = jobRecord.batch_id;

        // Count sub-jobs in this batch
        const subJobs = sqlite
          .prepare("SELECT status FROM jobs WHERE batch_id = ?")
          .all(batchId) as { status: string }[];

        const total = subJobs.length;
        const completed = subJobs.filter((sj) => sj.status === "success").length;
        const failed = subJobs.filter((sj) => sj.status === "failed" || sj.status === "cancelled").length;
        const done = completed + failed;

        let batchStatus = "running";
        if (done >= total) {
          batchStatus = failed > 0 ? "failed" : "completed";
        }

        sqlite
          .prepare(`
            UPDATE batch_jobs 
            SET status = ?, 
                completed_boards = ?, 
                failed_boards = ?,
                completed_at = ?
            WHERE id = ?
          `)
          .run(
            batchStatus,
            completed,
            failed,
            done >= total ? new Date().toISOString() : null,
            batchId
          );

        console.log(`[Batch] Updated batch ${batchId}: ${done}/${total} done (status: ${batchStatus})`);
      }
    } catch (err) {
      console.error("[Batch] Error updating batch status on job complete:", err);
    }
  });

  // Start session enforcer
  sessionEnforcer.start();

  // Expose services globally for WebSocket handlers in server.js
  (globalThis as Record<string, unknown>).__jobQueue = jobQueue;
  (globalThis as Record<string, unknown>).__uartService = uartService;
  (globalThis as Record<string, unknown>).__sshService = sshService;
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
