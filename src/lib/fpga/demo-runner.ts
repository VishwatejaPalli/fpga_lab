/**
 * Demo FPGA Programming Simulator
 *
 * Simulates the openFPGALoader programming process with realistic
 * log output and timing. Used when no real hardware is connected.
 */

import { EventEmitter } from "events";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import db from "@/lib/db";
import { jobs, boards, hwSessions } from "@/lib/db/schema";

// Initialize global job event emitter if not already set
if (!globalThis.__jobQueue) {
  globalThis.__jobQueue = new EventEmitter();
  globalThis.__jobQueue.setMaxListeners(50);
}

interface DemoLogLine {
  text: string;
  delay: number; // ms to wait before emitting this line
}

function getDemoLogSequence(bitstreamName: string, boardName: string): DemoLogLine[] {
  // Determine FPGA part from board name
  let fpgaPart = "xc7a35tcpg236-1";
  let idcode = "0x0362D093";
  let family = "Artix-7";

  if (boardName.toLowerCase().includes("nexys")) {
    fpgaPart = "xc7a100tcsg324-1";
    idcode = "0x13631093";
    family = "Artix-7";
  } else if (boardName.toLowerCase().includes("pynq")) {
    fpgaPart = "xc7z020clg400-1";
    idcode = "0x03727093";
    family = "Zynq-7000";
  } else if (boardName.toLowerCase().includes("de10")) {
    fpgaPart = "10M50DAF484C7G";
    idcode = "0x031050DD";
    family = "MAX 10";
  } else if (boardName.toLowerCase().includes("ice")) {
    fpgaPart = "iCE40UP5K-SG48";
    idcode = "0x0000681E";
    family = "iCE40 UltraPlus";
  }

  const designName = bitstreamName.replace(/\.(bit|bin|svf|rbf|sof)$/i, "");
  const fileSize = "2.5";

  return [
    { text: `$ openFPGALoader --board auto -f ${bitstreamName}\n`, delay: 0 },
    { text: `\n`, delay: 200 },
    { text: `openFPGALoader v0.12.1 (${process.platform})\n`, delay: 300 },
    { text: `Copyright (C) 2019-2025 Gwenhael Goavec-Merou\n`, delay: 100 },
    { text: `\n`, delay: 100 },
    { text: `Scanning USB for compatible devices...\n`, delay: 600 },
    { text: `Found FTDI device: Digilent USB Device (0403:6010)\n`, delay: 400 },
    { text: `JTAG firmware version: 0x0700\n`, delay: 200 },
    { text: `\n`, delay: 100 },
    { text: `Detecting JTAG chain...\n`, delay: 500 },
    { text: `Found 1 device(s) in JTAG chain:\n`, delay: 300 },
    { text: `  index 0:\n`, delay: 100 },
    { text: `    idcode:  ${idcode}\n`, delay: 100 },
    { text: `    family:  ${family}\n`, delay: 100 },
    { text: `    part:    ${fpgaPart}\n`, delay: 100 },
    { text: `    manufacturer: Xilinx\n`, delay: 100 },
    { text: `\n`, delay: 200 },
    { text: `Parsing bitstream: ${bitstreamName}\n`, delay: 400 },
    { text: `  Design name:   ${designName}\n`, delay: 150 },
    { text: `  Part name:     ${fpgaPart.split("-")[0]}\n`, delay: 100 },
    { text: `  Date:          ${new Date().toISOString().split("T")[0]}\n`, delay: 100 },
    { text: `  File size:     ${fileSize} MB (2621440 bytes)\n`, delay: 100 },
    { text: `  Bitstream CRC: 0x8A4F\n`, delay: 200 },
    { text: `\n`, delay: 100 },
    { text: `DNA: 0x4002000001234567\n`, delay: 300 },
    { text: `\n`, delay: 200 },
    { text: `Erasing device...`, delay: 800 },
    { text: ` done.\n`, delay: 1200 },
    { text: `\n`, delay: 100 },
    { text: `Programming SRAM...\n`, delay: 300 },
    { text: `  [                                        ]   0%\r`, delay: 200 },
    { text: `  [####                                    ]  10%\r`, delay: 400 },
    { text: `  [########                                ]  20%\r`, delay: 350 },
    { text: `  [############                            ]  30%\r`, delay: 380 },
    { text: `  [################                        ]  40%\r`, delay: 320 },
    { text: `  [####################                    ]  50%\r`, delay: 400 },
    { text: `  [########################                ]  60%\r`, delay: 350 },
    { text: `  [############################            ]  70%\r`, delay: 380 },
    { text: `  [################################        ]  80%\r`, delay: 300 },
    { text: `  [####################################    ]  90%\r`, delay: 350 },
    { text: `  [########################################] 100%\n`, delay: 400 },
    { text: `\n`, delay: 200 },
    { text: `Verifying...\n`, delay: 500 },
    { text: `  [########################################] 100%\n`, delay: 800 },
    { text: `  Verification: PASSED ✓\n`, delay: 300 },
    { text: `\n`, delay: 100 },
    { text: `FPGA configured successfully.\n`, delay: 200 },
    { text: `Total time: 4.5s\n`, delay: 100 },
    { text: `\n`, delay: 100 },
    { text: `Starting hardware session...\n`, delay: 400 },
    { text: `UART: /dev/ttyUSB1 @ 115200 baud\n`, delay: 300 },
    { text: `Camera: /dev/video0 (640x480 MJPEG)\n`, delay: 200 },
    { text: `Session ready.\n`, delay: 200 },
  ];
}

/**
 * Run a simulated FPGA programming job.
 * Emits logs via globalThis.__jobQueue EventEmitter and updates DB.
 */
export async function runDemoJob(
  jobId: string,
  boardId: string,
  userId: string,
  bitstreamName: string
): Promise<void> {
  // Look up the board for context
  const board = db.select().from(boards).where(eq(boards.id, boardId)).get();
  const boardName = board?.name || "Basys 3";

  const logSequence = getDemoLogSequence(bitstreamName, boardName);

  // Update job to "programming"
  db.update(jobs)
    .set({ status: "programming" })
    .where(eq(jobs.id, jobId))
    .run();

  // Wait for WebSocket clients to connect before streaming logs
  await sleep(1500);

  const allLogs: string[] = [];

  // Emit logs with realistic delays
  for (const line of logSequence) {
    await sleep(line.delay);
    allLogs.push(line.text);

    // Emit via global EventEmitter for WebSocket clients
    if (globalThis.__jobQueue) {
      globalThis.__jobQueue.emit("job-log", {
        jobId,
        text: line.text,
      });
    }
  }

  // Create hardware session
  const sessionId = uuid();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  db.insert(hwSessions)
    .values({
      id: sessionId,
      userId,
      boardId,
      jobId,
      status: "active",
      expiresAt,
    })
    .run();

  // Update board status
  db.update(boards)
    .set({ status: "busy" })
    .where(eq(boards.id, boardId))
    .run();

  // Update job to success
  db.update(jobs)
    .set({
      status: "success",
      logs: allLogs.join(""),
      completedAt: new Date().toISOString(),
    })
    .where(eq(jobs.id, jobId))
    .run();

  // Emit completion event
  if (globalThis.__jobQueue) {
    globalThis.__jobQueue.emit("job-complete", {
      jobId,
      success: true,
      sessionId,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Augment global types
declare global {
  var __jobQueue: EventEmitter | undefined;
}
