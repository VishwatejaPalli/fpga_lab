import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["student", "researcher", "admin"] })
    .notNull()
    .default("student"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Email verification tokens ──────────────────────────────────────────────
export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
});

// ─── Sessions (auth) ────────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
});

// ─── FPGA Boards ────────────────────────────────────────────────────────────
export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  fpgaFamily: text("fpga_family").notNull(), // e.g. "Xilinx Artix-7"
  boardType: text("board_type").notNull(), // openFPGALoader board name e.g. "basys3"
  connectionType: text("connection_type", {
    enum: ["jtag", "network", "usb"],
  })
    .notNull()
    .default("jtag"),
  devicePath: text("device_path"), // e.g. "/dev/ttyUSB0" for JTAG cable
  ipAddress: text("ip_address"), // Network IP address for SoC boards (e.g. PYNQ)
  serialPort: text("serial_port"), // e.g. "/dev/ttyUSB1" for UART
  cameraDevice: text("camera_device"), // e.g. "/dev/video0"
  boardImageUrl: text("board_image_url"), // optional image URL shown in UI
  blankBitstreamPath: text("blank_bitstream_path"), // optional path to safe bitstream
  programmingTool: text("programming_tool").default("openFPGALoader"), // tool override
  status: text("status", { enum: ["free", "busy", "offline"] })
    .notNull()
    .default("free"),
  currentSessionId: text("current_session_id"),
  capabilities: text("capabilities").default("[]"), // JSON array: ["led","uart","camera","switches"]
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(30),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Jobs ───────────────────────────────────────────────────────────────────
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  bitstreamPath: text("bitstream_path").notNull(),
  bitstreamName: text("bitstream_name").notNull(),
  status: text("status", {
    enum: ["queued", "programming", "success", "failed", "cancelled"],
  })
    .notNull()
    .default("queued"),
  logs: text("logs").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

// ─── Hardware Sessions ──────────────────────────────────────────────────────
export const hwSessions = sqliteTable("hw_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  jobId: text("job_id").references(() => jobs.id),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
  status: text("status", { enum: ["active", "expired", "ended"] })
    .notNull()
    .default("active"),
});

// ─── Experiment Notes (Researcher) ──────────────────────────────────────────
export const experimentNotes = sqliteTable("experiment_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: text("job_id"),
  boardId: text("board_id"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tags: text("tags").default("[]"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Board Reservations (Researcher) ────────────────────────────────────────
export const boardReservations = sqliteTable("board_reservations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  purpose: text("purpose").default(""),
  status: text("status", { enum: ["confirmed", "cancelled"] })
    .notNull()
    .default("confirmed"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── API Keys (Researcher) ──────────────────────────────────────────────────
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(),
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Batch Jobs (Researcher) ────────────────────────────────────────────────
export const batchJobs = sqliteTable("batch_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Batch"),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] })
    .notNull()
    .default("pending"),
  totalBoards: integer("total_boards").notNull().default(0),
  completedBoards: integer("completed_boards").notNull().default(0),
  failedBoards: integer("failed_boards").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});
