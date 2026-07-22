import { pgTable, text, integer, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").$type<"student" | "researcher" | "admin" | "guest">()
    .notNull()
    .default("student"),
  verified: boolean("verified").notNull().default(false),
  status: text("status").$type<"active" | "suspended">()
    .notNull()
    .default("active"),
  lastLogin: text("last_login"),
  tokenVersion: integer("token_version").notNull().default(1),
  lockedUntil: text("locked_until"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Email verification tokens ──────────────────────────────────────────────
export const verificationTokens = pgTable("verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
});

// ─── Sessions (auth) ────────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
});

// ─── FPGA Boards ────────────────────────────────────────────────────────────
export const boards = pgTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  fpgaFamily: text("fpga_family").notNull(), // e.g. "Xilinx Artix-7"
  boardType: text("board_type").notNull(), // openFPGALoader board name e.g. "basys3"
  connectionType: text("connection_type").$type<"jtag" | "network" | "usb">()
    .notNull()
    .default("jtag"),
  devicePath: text("device_path"), // e.g. "/dev/ttyUSB0" for JTAG cable
  ipAddress: text("ip_address"), // Network IP address for SoC boards (e.g. PYNQ)
  serialPort: text("serial_port"), // e.g. "/dev/ttyUSB1" for UART
  cameraDevice: text("camera_device"), // e.g. "/dev/video0"
  boardImageUrl: text("board_image_url"), // optional image URL shown in UI
  blankBitstreamPath: text("blank_bitstream_path"), // optional path to safe bitstream
  programmingTool: text("programming_tool").default("openFPGALoader"), // tool override
  sshUsername: text("ssh_username"), // For network boards (e.g. "xilinx")
  sshPassword: text("ssh_password"), // For network boards (e.g. "xilinx")
  status: text("status").$type<"free" | "busy" | "offline" | "allocated" | "programming">()
    .notNull()
    .default("free"),
  currentSessionId: text("current_session_id"),
  capabilities: text("capabilities").default("[]"), // JSON array: ["led","uart","camera","switches"]
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(30),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Jobs ───────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  bitstreamPath: text("bitstream_path").notNull(),
  bitstreamName: text("bitstream_name").notNull(),
  status: text("status").$type<"queued" | "programming" | "success" | "failed" | "cancelled">()
    .notNull()
    .default("queued"),
  priority: integer("priority").notNull().default(0),
  batchId: text("batch_id"),
  fileSize: integer("file_size").default(0),
  logs: text("logs").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
}, (table) => ({
  statusIdx: index("jobs_status_idx").on(table.status),
}));

// ─── Hardware Sessions ──────────────────────────────────────────────────────
export const hwSessions = pgTable("hw_sessions", {
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
    .default(sql`CURRENT_TIMESTAMP::text`),
  expiresAt: text("expires_at").notNull(),
  status: text("status").$type<"active" | "expired" | "ended">()
    .notNull()
    .default("active"),
}, (table) => ({
  statusIdx: index("hw_sessions_status_idx").on(table.status),
}));

// ─── Experiment Notes (Researcher) ──────────────────────────────────────────
export const experimentNotes = pgTable("experiment_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: text("job_id"),
  boardId: text("board_id"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tags: text("tags").default("[]"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Board Reservations (Researcher) ────────────────────────────────────────
export const boardReservations = pgTable("board_reservations", {
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
  status: text("status").$type<"confirmed" | "cancelled">()
    .notNull()
    .default("confirmed"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── API Keys (Researcher) ──────────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
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
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Batch Jobs (Researcher) ────────────────────────────────────────────────
export const batchJobs = pgTable("batch_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Batch"),
  status: text("status").$type<"pending" | "running" | "completed" | "failed">()
    .notNull()
    .default("pending"),
  totalBoards: integer("total_boards").notNull().default(0),
  completedBoards: integer("completed_boards").notNull().default(0),
  failedBoards: integer("failed_boards").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
  completedAt: text("completed_at"),
});

// ─── Security Refresh Tokens ────────────────────────────────────────────────
export const refreshTokens = pgTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Password Reset Tokens ──────────────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Login Attempts (Rate Limiting) ─────────────────────────────────────────
export const loginAttempts = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address").notNull(),
  count: integer("count").notNull().default(0),
  resetAt: text("reset_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata").default("{}"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

// ─── Synthesis Jobs ─────────────────────────────────────────────────────────
export const synthesisJobs = pgTable("synthesis_jobs", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  status: text("status").$type<"queued" | "processing" | "success" | "failed">()
    .notNull()
    .default("queued"),
  topModule: text("top_module").notNull().default("main"),
  workDir: text("work_dir").notNull(),
  logs: text("logs").default(""),
  schematic: text("schematic").default(""),
  timingReport: text("timing_report").default(""),
  powerReport: text("power_report").default(""),
  areaReport: text("area_report").default(""),
  waveformData: text("waveform_data").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
  completedAt: text("completed_at"),
});
