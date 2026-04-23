"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";

interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  connectionType: string;
  devicePath: string | null;
  serialPort: string | null;
  cameraDevice: string | null;
  programmingTool: string | null;
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
  const [tab, setTab] = useState<"boards" | "users" | "add-board">("boards");
  const [boards, setBoards] = useState<Board[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Board form state
  const [boardForm, setBoardForm] = useState({
    name: "",
    fpgaFamily: "",
    boardType: "",
    connectionType: "jtag",
    devicePath: "",
    serialPort: "",
    cameraDevice: "",
    programmingTool: "openFPGALoader",
    capabilities: [] as string[],
    sessionTimeoutMinutes: 30,
  });

  useEffect(() => {
    fetchData();
  }, []);

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

  async function handleAddBoard(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/admin/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...boardForm,
          devicePath: boardForm.devicePath || undefined,
          serialPort: boardForm.serialPort || undefined,
          cameraDevice: boardForm.cameraDevice || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Board added successfully!");
        setBoardForm({
          name: "",
          fpgaFamily: "",
          boardType: "",
          connectionType: "jtag",
          devicePath: "",
          serialPort: "",
          cameraDevice: "",
          programmingTool: "openFPGALoader",
          capabilities: [],
          sessionTimeoutMinutes: 30,
        });
        fetchData();
        setTab("boards");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to add board");
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

  function toggleCapability(cap: string) {
    setBoardForm((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter((c) => c !== cap)
        : [...prev.capabilities, cap],
    }));
  }

  const tabs = [
    { id: "boards" as const, label: "Boards" },
    { id: "users" as const, label: "Users" },
    { id: "add-board" as const, label: "+ Add Board" },
  ];

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

        {/* Boards tab */}
        {tab === "boards" && (
          <div>
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
                        {board.devicePath && (
                          <span>Device: {board.devicePath}</span>
                        )}
                        {board.serialPort && (
                          <span>UART: {board.serialPort}</span>
                        )}
                        {board.cameraDevice && (
                          <span>Camera: {board.cameraDevice}</span>
                        )}
                      </div>
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
                    <button
                      onClick={() => handleDeleteBoard(board.id)}
                      className="text-danger hover:text-danger/80 text-sm ml-4"
                    >
                      Delete
                    </button>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted">User ID</th>
                      <th className="pb-3 font-medium text-muted">Name</th>
                      <th className="pb-3 font-medium text-muted">Email</th>
                      <th className="pb-3 font-medium text-muted">Role</th>
                      <th className="pb-3 font-medium text-muted">Verified</th>
                      <th className="pb-3 font-medium text-muted">Joined</th>
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
          <form onSubmit={handleAddBoard} className="max-w-2xl space-y-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-lg">Board Information</h2>

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
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-lg">Hardware Paths</h2>

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
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          boardForm.capabilities.includes(cap)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted hover:border-muted"
                        }`}
                      >
                        {cap}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full">
              Add Board
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
