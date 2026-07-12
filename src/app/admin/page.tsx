"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fpgaUsageData = [
  { day: 'Mon', sessions: 12 },
  { day: 'Tue', sessions: 18 },
  { day: 'Wed', sessions: 24 },
  { day: 'Thu', sessions: 17 },
  { day: 'Fri', sessions: 29 },
  { day: 'Sat', sessions: 14 },
  { day: 'Sun', sessions: 9 },
];

const boardUtilizationData = [
  { board: 'PYNQ-1', runs: 130 },
  { board: 'PYNQ-2', runs: 85 },
  { board: 'Basys3', runs: 52 },
  { board: 'Artix7', runs: 34 },
];

const userActivityData = [
  { time: '00:00', active: 2 },
  { time: '04:00', active: 5 },
  { time: '08:00', active: 15 },
  { time: '12:00', active: 45 },
  { time: '16:00', active: 38 },
  { time: '20:00', active: 20 },
];

const sessionDurationData = [
  { duration: '< 10m', count: 45 },
  { duration: '10-30m', count: 120 },
  { duration: '30-60m', count: 85 },
  { duration: '1-2h', count: 32 },
  { duration: '> 2h', count: 12 },
];

const reservationStatsData = [
  { status: 'Completed', count: 150 },
  { status: 'Upcoming', count: 42 },
  { status: 'Cancelled', count: 18 },
];

const COLORS = ['#10b981', '#3b82f6', '#ef4444'];

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  connectionType: string;
  devicePath: string | null;
  ipAddress: string | null;
  serialPort: string | null;
  cameraDevice: string | null;
  boardImageUrl: string | null;
  blankBitstreamPath: string | null;
  programmingTool: string | null;
  sshUsername?: string | null;
  sshPassword?: string | null;
  status: string;
  capabilities: string[];
  sessionTimeoutMinutes: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  verified: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"analytics" | "boards" | "users" | "add-board">("analytics");
  const [boards, setBoards] = useState<Board[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"guest" | "student" | "researcher" | "admin">("student");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Board form state
  const emptyBoardForm = {
    name: "",
    fpgaFamily: "",
    boardType: "",
    connectionType: "jtag",
    devicePath: "",
    ipAddress: "",
    serialPort: "",
    cameraDevice: "",
    boardImageUrl: "",
    blankBitstreamPath: "",
    programmingTool: "openFPGALoader",
    sshUsername: "",
    sshPassword: "",
    capabilities: [] as string[],
    sessionTimeoutMinutes: 30,
  };

  const [boardForm, setBoardForm] = useState(emptyBoardForm);
  const [detecting, setDetecting] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState<{ hardware: any[]; serialPorts: string[]; cameras: string[]; rawOutput?: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function handleDetect() {
    setDetecting(true);
    setDetectedDevices(null);
    try {
      const res = await fetch("/api/admin/boards/detect");
      const data = await res.json();
      if (res.ok) {
        setDetectedDevices(data);
      } else {
        alert(data.error || "Detection failed");
      }
    } catch (err) {
      alert("Network error during detection");
    } finally {
      setDetecting(false);
    }
  }

  function applyTemplate(item: any) {
    if (!item.template) return;
    setBoardForm((prev) => ({
      ...prev,
      name: `${item.template.name} (${item.idcode})`,
      fpgaFamily: item.template.fpgaFamily,
      boardType: item.template.boardType,
      capabilities: item.template.capabilities,
    }));
  }

  async function fetchData() {
    setLoading(true);
    try {
      const [boardsRes, usersRes] = await Promise.all([
        fetch("/api/admin/boards"),
        fetch("/api/admin/users"),
      ]);

      const boardsData = await boardsRes.json();
      const usersData = await usersRes.json();

      if (boardsData.boards) setBoards(boardsData.boards);
      if (usersData.users) setUsers(usersData.users);
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetBoardForm() {
    setBoardForm(emptyBoardForm);
    setEditingBoardId(null);
  }

  function handleEditBoard(board: Board) {
    setEditingBoardId(board.id);
    setBoardForm({
      name: board.name,
      fpgaFamily: board.fpgaFamily,
      boardType: board.boardType,
      connectionType: board.connectionType,
      devicePath: board.devicePath || "",
      ipAddress: board.ipAddress || "",
      serialPort: board.serialPort || "",
      cameraDevice: board.cameraDevice || "",
      boardImageUrl: board.boardImageUrl || "",
      blankBitstreamPath: board.blankBitstreamPath || "",
      programmingTool: board.programmingTool || "openFPGALoader",
      sshUsername: board.sshUsername || "",
      sshPassword: board.sshPassword || "",
      capabilities: board.capabilities || [],
      sessionTimeoutMinutes: board.sessionTimeoutMinutes || 30,
    });
    setTab("add-board");
  }

  async function handleSaveBoard(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/admin/boards", {
        method: editingBoardId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBoardId,
          ...boardForm,
          devicePath: boardForm.devicePath || undefined,
          ipAddress: boardForm.ipAddress || undefined,
          serialPort: boardForm.serialPort || undefined,
          cameraDevice: boardForm.cameraDevice || undefined,
          boardImageUrl: boardForm.boardImageUrl || undefined,
          blankBitstreamPath: boardForm.blankBitstreamPath || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(
          editingBoardId ? "Board updated successfully!" : "Board added successfully!"
        );
        resetBoardForm();
        fetchData();
        setTab("boards");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage(editingBoardId ? "Failed to update board" : "Failed to add board");
    }
  }

  async function handleDeleteBoard(id: string) {
    if (!confirm("Are you sure you want to delete this board?")) return;

    try {
      await fetch("/api/admin/boards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch {
      alert("Failed to delete board");
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRole(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update role");
      }
    } catch {
      alert("Failed to update role");
    } finally {
      setUpdatingRole(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    setUpdatingRole(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch {
      alert("Failed to delete user");
    } finally {
      setUpdatingRole(null);
    }
  }

  function toggleCapability(cap: string) {
    setBoardForm((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter((c) => c !== cap)
        : [...prev.capabilities, cap],
    }));
  }

  const tabs = [
    { id: "analytics" as const, label: "Analytics" },
    { id: "boards" as const, label: "Boards" },
    { id: "users" as const, label: "Users" },
    { id: "add-board" as const, label: "+ Add Board" },
  ];

  const boardCounts = boards.reduce(
    (acc, board) => {
      acc.total += 1;
      if (board.status === "free") acc.free += 1;
      if (board.status === "busy") acc.busy += 1;
      if (board.status === "offline") acc.offline += 1;
      if (board.blankBitstreamPath) acc.blankConfigured += 1;
      return acc;
    },
    { total: 0, free: 0, busy: 0, offline: 0, blankConfigured: 0 }
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted mb-8">Manage boards, users, and system settings</p>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm mb-6 ${
              message.startsWith("Error")
                ? "bg-danger/10 text-danger"
                : "bg-success/10 text-success"
            }`}
          >
            {message}
          </div>
        )}

        {/* Analytics tab */}
        {tab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. FPGA Usage Trend */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">FPGA Usage Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fpgaUsageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="sessions" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. Board Utilization */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Board Utilization</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={boardUtilizationData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={true} vertical={false} />
                      <XAxis type="number" fontSize={12} />
                      <YAxis dataKey="board" type="category" fontSize={12} width={60} />
                      <Tooltip cursor={{ fill: '#f3e8ff' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="runs" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. User Activity */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Daily User Activity</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={userActivityData}>
                      <defs>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="time" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="active" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActive)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4. Session Duration Distribution */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Session Duration Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionDurationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis dataKey="duration" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip cursor={{ fill: '#f3e8ff' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 5. Reservation Statistics */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm">Reservation Statistics</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reservationStatsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="status"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {reservationStatsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Boards tab */}
        {tab === "boards" && (
          <div>
            <div className="card mb-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-semibold">Boards:</span>
                <span>Total {boardCounts.total}</span>
                <span className="text-success">Free {boardCounts.free}</span>
                <span className="text-warning">Busy {boardCounts.busy}</span>
                <span className="text-danger">Offline {boardCounts.offline}</span>
                <span>Blank set {boardCounts.blankConfigured}</span>
              </div>
              <p className="text-xs text-muted mt-2">
                Tip: Set a per-board blank bitstream to auto-clean hardware after sessions.
              </p>
            </div>
            {loading ? (
              <div className="text-muted">Loading boards...</div>
            ) : boards.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔌</div>
                <h2 className="text-xl font-semibold mb-2">No boards registered</h2>
                <p className="text-muted mb-4">
                  Add your first FPGA board to get started.
                </p>
                <button
                  onClick={() => setTab("add-board")}
                  className="btn-primary"
                >
                  Add Board
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    className="card flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{board.name}</h3>
                        <span className={`badge badge-${board.status}`}>
                          {board.status}
                        </span>
                      </div>
                      <div className="text-sm text-muted space-x-4">
                        <span>{board.fpgaFamily}</span>
                        <span>Type: {board.boardType}</span>
                        <span>Tool: {board.programmingTool}</span>
                        {board.blankBitstreamPath ? (
                          <span>Blank: set</span>
                        ) : (
                          <span>Blank: not set</span>
                        )}
                        {board.devicePath && (
                          <span>Device: {board.devicePath}</span>
                        )}
                        {board.ipAddress && (
                          <span>IP: {board.ipAddress}</span>
                        )}
                        {board.serialPort && (
                          <span>UART: {board.serialPort}</span>
                        )}
                        {board.cameraDevice && (
                          <span>Camera: {board.cameraDevice}</span>
                        )}
                        {board.boardImageUrl && (
                          <span>Image: configured</span>
                        )}
                      </div>
                      {board.boardImageUrl && (
                        <div className="mt-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={board.boardImageUrl}
                            alt={`${board.name} preview`}
                            className="h-16 w-24 rounded object-cover border border-border"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      {board.capabilities.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {board.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-xs bg-background px-2 py-0.5 rounded"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <button
                        onClick={() => handleEditBoard(board)}
                        className="text-primary hover:text-primary/80 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBoard(board.id)}
                        className="text-danger hover:text-danger/80 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div>
            {loading ? (
              <div className="text-muted">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="mb-4">
                  <button
                    onClick={() => { setShowCreateUser(!showCreateUser); setCreateError(""); }}
                    className="btn-primary"
                  >
                    {showCreateUser ? "Hide Create User" : "Create User"}
                  </button>
                </div>

                {showCreateUser && (
                  <div className="card mb-4 p-4">
                    {createError && (
                      <div className="text-sm text-danger mb-2">{createError}</div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        className="input-field"
                        placeholder="Full name"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="email@vardhaman.org"
                        value={createEmail}
                        onChange={(e) => setCreateEmail(e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="Password (min 8)"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <select
                        value={createRole}
                        onChange={(e) => setCreateRole(e.target.value as "guest" | "student" | "researcher" | "admin")}
                        className="input-field w-40"
                      >
                        <option value="guest">guest</option>
                        <option value="student">student</option>
                        <option value="researcher">researcher</option>
                        <option value="admin">admin</option>
                      </select>
                      <div className="flex-1" />
                      <button
                        onClick={async () => {
                          setCreateError("");
                          if (!createName || !createEmail || createPassword.length < 8) {
                            setCreateError("Please provide name, valid email, and password (min 8)");
                            return;
                          }
                          // No client-side domain restriction for admin-created users
                          setCreateLoading(true);
                          try {
                            const res = await fetch('/api/admin/users', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: createName, email: createEmail, password: createPassword, role: createRole })
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              setCreateError(data.error || 'Failed to create user');
                            } else {
                              setShowCreateUser(false);
                              setCreateName(''); setCreateEmail(''); setCreatePassword(''); setCreateRole('student');
                              fetchData();
                            }
                          } catch {
                            setCreateError('Network error');
                          } finally {
                            setCreateLoading(false);
                          }
                        }}
                        className="btn-primary"
                        disabled={createLoading}
                      >
                        {createLoading ? 'Creating...' : 'Create User'}
                      </button>
                    </div>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted">User ID</th>
                      <th className="pb-3 font-medium text-muted">Name</th>
                      <th className="pb-3 font-medium text-muted">Email</th>
                      <th className="pb-3 font-medium text-muted">Role</th>
                      <th className="pb-3 font-medium text-muted">Verified</th>
                      <th className="pb-3 font-medium text-muted">Joined</th>
                      <th className="pb-3 font-medium text-muted text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/50">
                        <td className="py-3 font-mono text-xs text-muted" title={user.id}>
                          {user.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 font-medium">{user.name}</td>
                        <td className="py-3 text-muted">{user.email}</td>
                        <td className="py-3">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={updatingRole === user.id}
                            className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${
                              user.role === "admin"
                                ? "bg-primary/15 text-primary"
                                : user.role === "researcher"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            <option value="guest">guest</option>
                            <option value="student">student</option>
                            <option value="researcher">researcher</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="py-3">
                          {user.verified ? (
                            <span className="text-success">✓</span>
                          ) : (
                            <span className="text-danger">✗</span>
                          )}
                        </td>
                        <td className="py-3 text-muted">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={updatingRole === user.id}
                            className="text-danger hover:text-danger/80 text-xs font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add board tab */}
        {tab === "add-board" && (
          <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSaveBoard} className="space-y-6">
                <div className="card space-y-4">
                  <h2 className="font-semibold text-lg">
                    {editingBoardId ? "Edit Board" : "Board Information"}
                  </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Board Name *
                  </label>
                  <input
                    type="text"
                    value={boardForm.name}
                    onChange={(e) =>
                      setBoardForm({ ...boardForm, name: e.target.value })
                    }
                    placeholder="e.g. Basys3 Board #1"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    FPGA Family *
                  </label>
                  <input
                    type="text"
                    value={boardForm.fpgaFamily}
                    onChange={(e) =>
                      setBoardForm({ ...boardForm, fpgaFamily: e.target.value })
                    }
                    placeholder="e.g. Xilinx Artix-7"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Board Type * (openFPGALoader name)
                  </label>
                  <input
                    type="text"
                    value={boardForm.boardType}
                    onChange={(e) =>
                      setBoardForm({ ...boardForm, boardType: e.target.value })
                    }
                    placeholder="e.g. basys3, nexysA7, pynq-z2"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Connection Type
                  </label>
                  <select
                    value={boardForm.connectionType}
                    onChange={(e) =>
                      setBoardForm({
                        ...boardForm,
                        connectionType: e.target.value,
                      })
                    }
                    className="input-field"
                  >
                    <option value="jtag">JTAG</option>
                    <option value="usb">USB</option>
                    <option value="network">Network</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Board Image URL
                </label>
                <input
                  type="text"
                  value={boardForm.boardImageUrl}
                  onChange={(e) =>
                    setBoardForm({ ...boardForm, boardImageUrl: e.target.value })
                  }
                  placeholder="https://example.com/fpga-board.jpg"
                  className="input-field"
                />
                <p className="text-xs text-muted mt-1">
                  Optional: image shown on dashboard board cards.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Blank Bitstream Path
                </label>
                <input
                  type="text"
                  value={boardForm.blankBitstreamPath}
                  onChange={(e) =>
                    setBoardForm({ ...boardForm, blankBitstreamPath: e.target.value })
                  }
                  placeholder="/opt/bitstreams/blank.bit"
                  className="input-field"
                />
                <p className="text-xs text-muted mt-1">
                  Optional: programmed when the session ends.
                </p>
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-lg">Hardware Paths & Credentials</h2>

              {boardForm.connectionType === "network" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border pb-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      SSH Username
                    </label>
                    <input
                      type="text"
                      value={boardForm.sshUsername}
                      onChange={(e) =>
                        setBoardForm({ ...boardForm, sshUsername: e.target.value })
                      }
                      placeholder="e.g. xilinx"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      SSH Password
                    </label>
                    <input
                      type="password"
                      value={boardForm.sshPassword}
                      onChange={(e) =>
                        setBoardForm({ ...boardForm, sshPassword: e.target.value })
                      }
                      placeholder="e.g. xilinx"
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Device Path (JTAG cable)
                </label>
                <input
                  type="text"
                  value={boardForm.devicePath}
                  onChange={(e) =>
                    setBoardForm({ ...boardForm, devicePath: e.target.value })
                  }
                  placeholder="e.g. /dev/ttyUSB0"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  IP Address (for SoC boards e.g. PYNQ)
                </label>
                <input
                  type="text"
                  value={boardForm.ipAddress}
                  onChange={(e) =>
                    setBoardForm({ ...boardForm, ipAddress: e.target.value })
                  }
                  placeholder="e.g. 192.168.2.99"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Serial Port (UART)
                </label>
                <input
                  type="text"
                  value={boardForm.serialPort}
                  onChange={(e) =>
                    setBoardForm({ ...boardForm, serialPort: e.target.value })
                  }
                  placeholder="e.g. /dev/ttyUSB1"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Camera Device
                </label>
                <input
                  type="text"
                  value={boardForm.cameraDevice}
                  onChange={(e) =>
                    setBoardForm({ ...boardForm, cameraDevice: e.target.value })
                  }
                  placeholder="e.g. /dev/video0"
                  className="input-field"
                />
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-lg">Configuration</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Programming Tool
                  </label>
                  <select
                    value={boardForm.programmingTool}
                    onChange={(e) =>
                      setBoardForm({
                        ...boardForm,
                        programmingTool: e.target.value,
                      })
                    }
                    className="input-field"
                  >
                    <option value="openFPGALoader">
                      openFPGALoader (Universal)
                    </option>
                    <option value="xsct">Xilinx xsct</option>
                    <option value="quartus_pgm">Intel quartus_pgm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={boardForm.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setBoardForm({
                        ...boardForm,
                        sessionTimeoutMinutes: parseInt(e.target.value) || 30,
                      })
                    }
                    min={5}
                    max={480}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Capabilities
                </label>
                <div className="flex flex-wrap gap-2">
                  {["led", "uart", "camera", "switches", "ethernet", "display"].map(
                    (cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => toggleCapability(cap)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 ${
                          boardForm.capabilities.includes(cap)
                            ? "bg-emerald-600 border-emerald-600 text-white font-semibold shadow-sm shadow-emerald-600/10 scale-95"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                        }`}
                      >
                        {cap}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary flex-1">
                {editingBoardId ? "Update Board" : "Add Board"}
              </button>
              {editingBoardId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetBoardForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
          </div>

          {/* Setup Assistant Side Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card sticky top-8">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-primary">🛠️</span> Setup Assistant
                </h3>
                <button 
                  type="button"
                  onClick={handleDetect}
                  disabled={detecting}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    detecting 
                    ? "bg-muted/10 text-muted cursor-not-allowed" 
                    : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 active:scale-95"
                  }`}
                >
                  {detecting ? (
                    <>
                      <span className="animate-spin text-sm">🔄</span>
                      SCANNING...
                    </>
                  ) : (
                    <>
                      <span className="text-sm">🔍</span>
                      SCAN HARDWARE
                    </>
                  )}
                </button>
              </div>

              {!detectedDevices && !detecting && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center shadow-inner">
                  <div className="text-3xl mb-3 opacity-80">🔭</div>
                  <h4 className="font-semibold text-primary mb-2">Ready to Scan</h4>
                  <p className="text-xs text-muted leading-relaxed max-w-sm mx-auto">
                    Click <b>SCAN HARDWARE</b> to auto-detect connected FPGA boards via JTAG, available UART ports, and Webcams.
                  </p>
                </div>
              )}

              {detecting && (
                <div className="py-12 flex flex-col items-center justify-center relative rounded-xl border border-primary/20 bg-primary/5 overflow-hidden shadow-inner">
                  <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.4)]"></div>
                  <p className="text-sm font-bold text-primary tracking-wide animate-pulse uppercase">Scanning Hardware</p>
                  <p className="text-[10px] text-muted mt-2 tracking-wider">Probing JTAG, UART & Video</p>
                </div>
              )}

              {detectedDevices && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* JTAG Hardware */}
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                      <span>🔌</span> Detected FPGAs
                    </h4>
                    {detectedDevices.hardware.length === 0 ? (
                      <div className="text-center py-5 bg-background/50 rounded-lg border border-dashed border-border/50">
                        <p className="text-xs text-muted">No JTAG devices found.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detectedDevices.hardware.map((h, i) => (
                          <div key={i} className="group relative p-3 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className="text-sm font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{h.idcode}</span>
                              </div>
                              {h.template && (
                                <button 
                                  type="button"
                                  onClick={() => applyTemplate(h)}
                                  className="text-[10px] bg-primary hover:bg-primary-hover text-white px-2.5 py-1.5 rounded shadow-md transition-transform active:scale-95 font-bold tracking-wide"
                                >
                                  USE TEMPLATE
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-muted leading-relaxed">{h.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* UART Ports */}
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                      <span>📟</span> Available UART Ports
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {detectedDevices.serialPorts.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setBoardForm({ ...boardForm, serialPort: p })}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-background border border-border hover:border-primary hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm"
                          title="Click to use this port"
                        >
                          <span className="text-primary/70">🔌</span>
                          {p.replace("/dev/", "")}
                        </button>
                      ))}
                      {detectedDevices.serialPorts.length === 0 && (
                        <p className="text-xs text-muted italic px-2 py-1">No serial ports found.</p>
                      )}
                    </div>
                  </div>

                  {/* Cameras */}
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                      <span>📷</span> Video Devices
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {detectedDevices.cameras.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBoardForm({ ...boardForm, cameraDevice: c })}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-background border border-border hover:border-accent hover:bg-accent/5 hover:text-accent transition-all active:scale-95 shadow-sm"
                          title="Click to use this camera"
                        >
                          <span className="text-accent/70">👁️</span>
                          {c.replace("/dev/", "")}
                        </button>
                      ))}
                      {detectedDevices.cameras.length === 0 && (
                        <p className="text-xs text-muted italic px-2 py-1">No cameras found.</p>
                      )}
                    </div>
                  </div>

                  {/* Raw detection output */}
                  {detectedDevices.rawOutput && (
                    <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                        <span>📝</span> Detector Log
                      </h4>
                      <pre className="text-[10px] font-mono bg-background border border-border/50 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap text-muted">
                        {detectedDevices.rawOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
