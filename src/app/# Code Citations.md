# Code Citations

## License: unknown
https://github.com/nxg-hub/nxg-job-hub-frontend/blob/24d0b42b7376051da1c20a886c6065d2aa8de20d/src/pages/Dashboard/wallet/setting/Passwordsettings.jsx

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  use
```


## License: unknown
https://github.com/nxg-hub/nxg-job-hub-frontend/blob/24d0b42b7376051da1c20a886c6065d2aa8de20d/src/pages/Dashboard/wallet/setting/Passwordsettings.jsx

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  use
```


## License: MIT
https://github.com/BTMuli/TeyvatGuide/blob/74eb612d721bd6b8ebc56c574a062092b361f873/src/utils/toolFunc.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i
```


## License: MIT
https://github.com/BTMuli/TeyvatGuide/blob/74eb612d721bd6b8ebc56c574a062092b361f873/src/utils/toolFunc.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i
```


## License: MIT
https://github.com/BTMuli/TeyvatGuide/blob/74eb612d721bd6b8ebc56c574a062092b361f873/src/utils/toolFunc.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i
```


## License: MIT
https://github.com/BTMuli/TeyvatGuide/blob/74eb612d721bd6b8ebc56c574a062092b361f873/src/utils/toolFunc.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i
```


## License: unknown
https://github.com/daiyas-dev/daiyas.dev/blob/d12cd008d62bacf96e3cd536cca941c05e4214ae/client/main.js

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
```


## License: MIT
https://github.com/BTMuli/TeyvatGuide/blob/74eb612d721bd6b8ebc56c574a062092b361f873/src/utils/toolFunc.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i
```


## License: unknown
https://github.com/daiyas-dev/daiyas.dev/blob/d12cd008d62bacf96e3cd536cca941c05e4214ae/client/main.js

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
```


## License: unknown
https://github.com/daiyas-dev/daiyas.dev/blob/d12cd008d62bacf96e3cd536cca941c05e4214ae/client/main.js

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
```


## License: MIT
https://github.com/BTMuli/TeyvatGuide/blob/74eb612d721bd6b8ebc56c574a062092b361f873/src/utils/toolFunc.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
```


## License: unknown
https://github.com/Neha031193/neha031193.github.io/blob/fdffe7eff9c290932e173c426e0a0b262878f86a/projects/upload-lib-neha/src/lib/upload-lib-neha.component.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/pedromshin/pedroshin.dev/blob/f413259ef623f922980016f797419e0f83e09fc0/app/components/atoms/Dropzone.tsx

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/Neha031193/neha031193.github.io/blob/fdffe7eff9c290932e173c426e0a0b262878f86a/projects/upload-lib-neha/src/lib/upload-lib-neha.component.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/pedromshin/pedroshin.dev/blob/f413259ef623f922980016f797419e0f83e09fc0/app/components/atoms/Dropzone.tsx

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/Neha031193/neha031193.github.io/blob/fdffe7eff9c290932e173c426e0a0b262878f86a/projects/upload-lib-neha/src/lib/upload-lib-neha.component.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/pedromshin/pedroshin.dev/blob/f413259ef623f922980016f797419e0f83e09fc0/app/components/atoms/Dropzone.tsx

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/Neha031193/neha031193.github.io/blob/fdffe7eff9c290932e173c426e0a0b262878f86a/projects/upload-lib-neha/src/lib/upload-lib-neha.component.ts

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```


## License: unknown
https://github.com/pedromshin/pedroshin.dev/blob/f413259ef623f922980016f797419e0f83e09fc0/app/components/atoms/Dropzone.tsx

```


I'll add several new features to make the platform more complete. Let me implement them one by one.

1. **Profile Page** — View/edit profile, change password, see stats
2. **History Page** — Full job history with filters, search, re-upload
3. **Notifications System** — Toast + bell icon with notification center
4. **Help/Documentation Page** — User guide, FAQ, supported boards
5. **Settings Page** — Preferences, theme, notification settings
6. **Board Favorites** — Star/bookmark boards for quick access
7. **Job Details Modal** — Click any job to see full logs
8. **System Status Page** — Live system health, uptime, queue length
9. **Leaderboard** — Usage stats (fun for students)
10. **Quick Actions Widget** — Floating action button for common tasks

Let me build all of these:

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user details
  const profile = db
    .prepare("SELECT id, email, name, role, verified, created_at FROM users WHERE id = ?")
    .get(user.id) as any;

  // Get stats
  const totalJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const successJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'success'")
    .get(user.id) as any;

  const failedJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'failed'")
    .get(user.id) as any;

  const totalSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE user_id = ?")
    .get(user.id) as any;

  const totalUploadSize = db
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM jobs WHERE user_id = ?")
    .get(user.id) as any;

  const favoriteBoards = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  const recentJobs = db
    .prepare(`
      SELECT j.*, b.name as board_name
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    .all(user.id);

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: totalJobs?.count || 0,
      successJobs: successJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
      totalSessions: totalSessions?.count || 0,
      totalUploadSize: totalUploadSize?.total || 0,
      successRate:
        totalJobs?.count > 0
          ? Math.round((successJobs?.count / totalJobs?.count) * 100)
          : 0,
    },
    favoriteBoards,
    recentJobs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();
  const dbUser = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as any;

  if (!dbUser || !bcrypt.compareSync(currentPassword, dbUser.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all";
  const boardId = searchParams.get("board") || "all";
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const offset = (page - 1) * limit;

  const db = getDb();

  let whereClause = "WHERE j.user_id = ?";
  const params: any[] = [user.id];

  if (status !== "all") {
    whereClause += " AND j.status = ?";
    params.push(status);
  }

  if (boardId !== "all") {
    whereClause += " AND j.board_id = ?";
    params.push(boardId);
  }

  if (search) {
    whereClause += " AND (j.original_filename LIKE ? OR b.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderClause = sortBy === "oldest" ? "ORDER BY j.created_at ASC" : "ORDER BY j.created_at DESC";

  // Get total count
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM jobs j LEFT JOIN boards b ON j.board_id = b.id ${whereClause}`)
    .get(...params) as any;

  // Get paginated results
  const jobs = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  // Get available boards for filter
  const boards = db
    .prepare("SELECT DISTINCT b.id, b.name FROM jobs j JOIN boards b ON j.board_id = b.id WHERE j.user_id = ?")
    .all(user.id);

  // Get status counts
  const statusCounts = db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM jobs WHERE user_id = ?
      GROUP BY status
    `)
    .all(user.id);

  return NextResponse.json({
    jobs,
    boards,
    statusCounts,
    pagination: {
      page,
      limit,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    },
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = db
    .prepare(`
      SELECT j.*, b.name as board_name, b.fpga_family, b.board_type
      FROM jobs j
      LEFT JOIN boards b ON j.board_id = b.id
      WHERE j.id = ? AND j.user_id = ?
    `)
    .get(id, user.id) as any;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get associated session
  const session = db
    .prepare("SELECT * FROM hardware_sessions WHERE job_id = ?")
    .get(id);

  return NextResponse.json({ job, session });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  const favorites = db
    .prepare(`
      SELECT b.id, b.name, b.fpga_family, b.board_type, b.status, f.created_at as favorited_at
      FROM board_favorites f
      JOIN boards b ON f.board_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { boardId } = body;

  if (!boardId) {
    return NextResponse.json({ error: "Board ID required" }, { status: 400 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS board_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, board_id)
    )
  `);

  // Toggle favorite
  const existing = db
    .prepare("SELECT id FROM board_favorites WHERE user_id = ? AND board_id = ?")
    .get(user.id, boardId) as any;

  if (existing) {
    db.prepare("DELETE FROM board_favorites WHERE id = ?").run(existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO board_favorites (id, user_id, board_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      user.id,
      boardId
    );
    return NextResponse.json({ favorited: true });
  }
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  let query = "SELECT * FROM notifications WHERE user_id = ?";
  if (unreadOnly) query += " AND read = 0";
  query += " ORDER BY created_at DESC LIMIT 50";

  const notifications = db.prepare(query).all(user.id);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as any;

  return NextResponse.json({
    notifications,
    unreadCount: unreadCount?.count || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, markAllRead } = body;

  const db = getDb();

  if (markAllRead) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  } else if (id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, user.id);
  }

  return NextResponse.json({ success: true });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/notifications/create.ts
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  link?: string
) {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, type, read, link) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(randomUUID(), userId, title, message, type, link || null);
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/system-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Board stats
  const totalBoards = db.prepare("SELECT COUNT(*) as count FROM boards").get() as any;
  const freeBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'free'").get() as any;
  const busyBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'busy'").get() as any;
  const offlineBoards = db.prepare("SELECT COUNT(*) as count FROM boards WHERE status = 'offline'").get() as any;

  // Job stats
  const queuedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'programming'").get() as any;
  const todayJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= datetime('now', '-1 day')")
    .get() as any;
  const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;

  // User stats
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM hardware_sessions WHERE status = 'active'")
    .get() as any;

  // System info
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Disk usage for uploads
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stat = fs.statfsSync("./uploads");
    diskUsage = {
      total: stat.bsize * stat.blocks,
      used: stat.bsize * (stat.blocks - stat.bfree),
      free: stat.bsize * stat.bfree,
    };
  } catch {}

  // Recent activity (last 10 jobs)
  const recentActivity = db
    .prepare(`
      SELECT j.id, j.status, j.created_at, j.completed_at, u.name as user_name, b.name as board_name
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN boards b ON j.board_id = b.id
      ORDER BY j.created_at DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    boards: {
      total: totalBoards?.count || 0,
      free: freeBoards?.count || 0,
      busy: busyBoards?.count || 0,
      offline: offlineBoards?.count || 0,
    },
    jobs: {
      queued: queuedJobs?.count || 0,
      active: activeJobs?.count || 0,
      today: todayJobs?.count || 0,
      total: totalJobs?.count || 0,
    },
    users: {
      total: totalUsers?.count || 0,
      activeSessions: activeSessions?.count || 0,
    },
    system: {
      uptime,
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
        loadAvg,
      },
      disk: diskUsage,
    },
    recentActivity,
    serverTime: new Date().toISOString(),
  });
}
````

````typescript
// filepath: /home/vishwa/code/fpga_ssh/src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Most active users
  const topUsers = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        ROUND(SUM(CASE WHEN j.status = 'success' THEN 1.0 ELSE 0.0 END) / MAX(COUNT(j.id), 1) * 100) as success_rate
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      GROUP BY u.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 20
    `)
    .all();

  // Most used boards
  const topBoards = db
    .prepare(`
      SELECT
        b.id,
        b.name,
        b.fpga_family,
        COUNT(j.id) as total_jobs,
        SUM(CASE WHEN j.status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM boards b
      LEFT JOIN jobs j ON b.id = j.board_id
      GROUP BY b.id
      HAVING total_jobs > 0
      ORDER BY total_jobs DESC
      LIMIT 10
    `)
    .all();

  // Today's stats
  const todayStats = db
    .prepare(`
      SELECT
        COUNT(*) as jobs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_today,
        COUNT(DISTINCT user_id) as active_users_today
      FROM jobs
      WHERE created_at >= datetime('now', '-1 day')
    `)
    .get() as any;

  // Current user rank
  const userRank = db
    .prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, COUNT(*) as cnt FROM jobs GROUP BY user_id
      ) t WHERE cnt > (SELECT COUNT(*) FROM jobs WHERE user_id = ?)
    `)
    .get(user.id) as any;

  const userStats = db
    .prepare(`
      SELECT COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_jobs
      FROM jobs WHERE user_id = ?
    `)
    .get(user.id) as any;

  return NextResponse.json({
    topUsers,
    topBoards,
    todayStats,
    currentUser: {
      rank: userRank?.rank || 0,
      totalJobs: userStats?.total_jobs || 0,
      successfulJobs: userStats?.successful_jobs || 0,
    },
  });
}
````

Now let me build all the frontend pages:

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    verified: number;
    created_at: string;
  };
  stats: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    totalSessions: number;
    totalUploadSize: number;
    successRate: number;
  };
  favoriteBoards: any[];
  recentJobs: any[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setName(json.profile.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditName(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c3e6b]"></div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, favoriteBoards, recentJobs } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c3e6b] to-[#5a7eb5] text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-1 rounded text-gray-900 text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={saving}
                      className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditName(false); setName(profile.name); }}
                      className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    <button
                      onClick={() => setEditName(true)}
                      className="p-1 hover:bg-white/20 rounded"
                      title="Edit name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <p className="text-white/80 mt-1">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"
                }`}>
                  {profile.role.toUpperCase()}
                </span>
                <span className="text-white/60 text-sm">
                  ID: <code className="font-mono">{profile.id.substring(0, 8)}</code>
                </span>
                <span className="text-white/60 text-sm">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: "📋", color: "bg-blue-50 text-blue-700" },
            { label: "Successful", value: stats.successJobs, icon: "✅", color: "bg-green-50 text-green-700" },
            { label: "Failed", value: stats.failedJobs, icon: "❌", color: "bg-red-50 text-red-700" },
            { label: "Success Rate", value: `${stats.successRate}%`, icon: "📊", color: "bg-purple-50 text-purple-700" },
            { label: "Sessions", value: stats.totalSessions, icon: "🔌", color: "bg-orange-50 text-orange-700" },
            { label: "Uploaded", value: formatBytes(stats.totalUploadSize), icon: "📦", color: "bg-teal-50 text-teal-700" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-xl ${stat.color} border`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 Security</h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#2c3e6b] hover:text-[#2c3e6b] transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-3">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Password changed successfully!</div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={changePassword}
                    className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f]"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Favorite Boards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⭐ Favorite Boards</h2>
            {favoriteBoards.length === 0 ? (
              <p className="text-gray-500 text-sm">No favorite boards yet. Star boards from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {favoriteBoards.map((board: any) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push("/program")}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{board.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{board.fpga_family}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      board.status === "free" ? "bg-green-100 text-green-700" :
                      board.status === "busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {board.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 Recent Jobs</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-[#2c3e6b] hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. Go to the Program page to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Board</th>
                    <th className="pb-2 pr-4">File</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === "success" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          job.status === "programming" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {job.status === "success" ? "✅" : job.status === "failed" ? "❌" : job.status === "programming" ? "⚡" : "⏳"}
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{job.board_name || "Unknown"}</td>
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  status: string;
  board_name: string;
  fpga_family: string;
  board_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  logs: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [boards, setBoards] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, boardFilter, search, sortBy]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        board: boardFilter,
        search,
        sort: sortBy,
      });
      const res = await fetch(`/api/history?${params}`);
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setJobs(json.jobs || []);
      setBoards(json.boards || []);
      setStatusCounts(json.statusCounts || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function viewJobDetail(job: Job) {
    setSelectedJob(job);
    try {
      const res = await fetch(`/api/history/${job.id}`);
      const json = await res.json();
      setJobDetail(json);
    } catch {
      setJobDetail(null);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDuration(start: string, end: string) {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  const statusIcon: Record<string, string> = {
    success: "✅",
    failed: "❌",
    programming: "⚡",
    queued: "⏳",
    cancelled: "🚫",
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    programming: "bg-blue-100 text-blue-700",
    queued: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
  };

  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s: any) => s.status === status);
    return found?.count || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Job History</h1>
              <p className="text-gray-500 mt-1">{total} total jobs</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              ← Dashboard
            </button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mt-4">
            {["all", "success", "failed", "programming", "queued"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-[#2c3e6b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : `${statusIcon[s] || ""} ${s}`}
                <span className="ml-1 opacity-75">
                  ({s === "all" ? total : getStatusCount(s)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by filename or board..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Boards</option>
            {boards.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2c3e6b]"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No jobs found</h3>
            <p className="text-gray-500 mt-1">
              {search ? "Try adjusting your search" : "Go to the Program page to submit your first job"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Board</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Filename</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[job.status] || "bg-gray-100"}`}>
                          {statusIcon[job.status] || "❓"} {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{job.board_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{job.fpga_family || ""}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {job.original_filename || "bitstream.bit"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(job.file_size)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewJobDetail(job)}
                          className="px-3 py-1 text-xs bg-[#2c3e6b] text-white rounded hover:bg-[#1e2d4f] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Job Details</h2>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Job ID</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[selectedJob.status]}`}>
                      {statusIcon[selectedJob.status]} {selectedJob.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Board</span>
                  <p className="font-medium mt-1">{selectedJob.board_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">FPGA Family</span>
                  <p className="mt-1">{selectedJob.fpga_family || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Filename</span>
                  <p className="font-mono text-xs mt-1">{selectedJob.original_filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size</span>
                  <p className="mt-1">{formatBytes(selectedJob.file_size)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Submitted</span>
                  <p className="mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="mt-1">{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</p>
                </div>
              </div>

              {/* Logs */}
              {(selectedJob.logs || jobDetail?.job?.logs) && (
                <div>
                  <span className="text-gray-500 text-sm">Programming Logs</span>
                  <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {selectedJob.logs || jobDetail?.job?.logs || "No logs available"}
                  </pre>
                </div>
              )}

              {/* Session info */}
              {jobDetail?.session && (
                <div>
                  <span className="text-gray-500 text-sm">Hardware Session</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p>Session ID: <code className="font-mono text-xs">{jobDetail.session.id}</code></p>
                    <p>Status: {jobDetail.session.status}</p>
                    <p>Started: {new Date(jobDetail.session.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { router.push("/program"); setSelectedJob(null); }}
                  className="px-4 py-2 bg-[#2c3e6b] text-white rounded-lg hover:bg-[#1e2d4f] transition text-sm"
                >
                  🔄 Re-program with Same Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

````tsx
// filepath: /home/vishwa/code/fpga_ssh/src/app/status/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i
```

