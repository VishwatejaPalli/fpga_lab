"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import ConfirmModal from "@/components/confirm-modal";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Precision SVG Icons (No Emojis) ───────────────────────────────────────
function CpuIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

function CameraIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function TerminalIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function RefreshCwIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function ZapIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function Trash2Icon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function Edit3Icon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function BarChart3Icon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function UsersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AlertCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FilterIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SlidersHorizontalIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  );
}

interface AnalyticsData {
  fpgaUsageData: { day: string; sessions: number }[];
  boardUtilizationData: { board: string; runs: number }[];
  userActivityData: { time: string; active: number }[];
  sessionDurationData: { duration: string; count: number }[];
  reservationStatsData: { status: string; count: number }[];
}

const CHART_COLORS = ["#10b981", "#3b82f6", "#ef4444"];

// ── Type Definitions ─────────────────────────────────────────────────────
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
  cameraDeviceId?: string | null;
  uartDeviceId?: string | null;
  jtagDeviceId?: string | null;
  mappingStatus?: "UNMAPPED" | "PENDING_VERIFICATION" | "VERIFIED" | "DEGRADED" | "NEEDS_REVALIDATION";
  mappingVerifiedAt?: string | null;
  hardwareFingerprint?: string | null;
  boardImageUrl: string | null;
  blankBitstreamPath: string | null;
  programmingTool: string | null;
  sshUsername?: string | null;
  sshPassword?: string | null;
  status: string;
  capabilities: string[];
  sessionTimeoutMinutes: number;
}

interface DetectedCamera {
  id: string;
  deviceNode: string;
  preferredPath: string;
  byId: string | null;
  byPath: string | null;
  isPersistent: boolean;
  model: string;
  manufacturer?: string;
  serialNumber?: string;
  usbBus?: string;
  usbPort?: string;
  status: string;
  assignedBoardId?: string | null;
  previewUrl: string;
}

interface DetectedUart {
  id: string;
  deviceNode: string;
  preferredPath: string;
  byId: string | null;
  byPath: string | null;
  isPersistent: boolean;
  model: string;
  manufacturer?: string;
  serialNumber?: string;
  usbBus?: string;
  usbPort?: string;
  status: string;
  assignedBoardId?: string | null;
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
  const [tab, setTab] = useState<"boards" | "hardware" | "add-board" | "analytics" | "users">("boards");
  const [boards, setBoards] = useState<Board[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [verifyingBoardId, setVerifyingBoardId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"guest" | "student" | "researcher" | "admin">("student");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Analytics Live State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Fleet Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mappingFilter, setMappingFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");

  // Camera & UART testing state
  const [cameraTimestamps, setCameraTimestamps] = useState<Record<string, number>>({});
  const [testingUart, setTestingUart] = useState<Record<string, boolean>>({});
  const [uartTestResults, setUartTestResults] = useState<
    Record<string, { success: boolean; message: string; latencyMs?: number; inUse?: boolean }>
  >({});

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
    cameraDeviceId: "",
    uartDeviceId: "",
    jtagDeviceId: "",
    mappingStatus: "UNMAPPED",
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
  const [detectedDevices, setDetectedDevices] = useState<{
    hardware: any[];
    serialPorts: DetectedUart[];
    cameras: DetectedCamera[];
    rawOutput?: string;
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchData();
    handleDetect();
    fetchAnalytics();
  }, []);

  async function handleDetect() {
    setDetecting(true);
    try {
      const res = await fetch("/api/admin/boards/detect");
      const data = await res.json();
      if (res.ok) {
        setDetectedDevices(data);
      } else {
        setMessage(`Error: ${data.error || "Hardware detection failed"}`);
      }
    } catch {
      setMessage("Error: Network error during hardware detection");
    } finally {
      setDetecting(false);
    }
  }

  function handleRefreshCamera(camId: string) {
    setCameraTimestamps((prev) => ({ ...prev, [camId]: Date.now() }));
  }

  async function handleTestUart(uartId: string) {
    setTestingUart((prev) => ({ ...prev, [uartId]: true }));
    try {
      const res = await fetch(`/api/admin/hardware/uart/${uartId}/test`, { method: "POST" });
      const data = await res.json();
      setUartTestResults((prev) => ({
        ...prev,
        [uartId]: {
          success: data.success,
          message: data.message || data.error || (data.success ? "Test passed" : "Test failed"),
          latencyMs: data.latencyMs,
          inUse: data.inUse,
        },
      }));
    } catch {
      setUartTestResults((prev) => ({
        ...prev,
        [uartId]: {
          success: false,
          message: "Network error during UART test",
        },
      }));
    } finally {
      setTestingUart((prev) => ({ ...prev, [uartId]: false }));
    }
  }

  async function handleVerifyBoard(boardId: string) {
    setVerifyingBoardId(boardId);
    try {
      const res = await fetch(`/api/admin/boards/${boardId}/verify`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "Hardware mapping verified successfully.");
        fetchData();
      } else {
        setMessage(`Error: ${data.error || "Verification failed"}`);
      }
    } catch {
      setMessage("Error: Failed to verify board hardware mapping");
    } finally {
      setVerifyingBoardId(null);
    }
  }

  async function handleQuickAssignHardware(
    deviceId: string,
    deviceType: "camera" | "uart",
    boardId: string,
    preferredPath: string
  ) {
    if (!boardId) return;
    try {
      const payload =
        deviceType === "camera"
          ? { id: boardId, cameraDeviceId: deviceId, cameraDevice: preferredPath }
          : { id: boardId, uartDeviceId: deviceId, serialPort: preferredPath };

      const res = await fetch("/api/admin/boards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Assigned ${deviceType} to board successfully.`);
        fetchData();
        handleDetect();
      } else {
        setMessage(`Error: ${data.error || "Failed to assign device"}`);
      }
    } catch {
      setMessage("Error assigning hardware device to board");
    }
  }

  function handleCreateBoardWithHardware(opts: {
    name?: string;
    fpgaFamily?: string;
    boardType?: string;
    capabilities?: string[];
    cameraDeviceId?: string;
    cameraDevice?: string;
    uartDeviceId?: string;
    serialPort?: string;
    devicePath?: string;
  }) {
    setEditingBoardId(null);
    setBoardForm({
      ...emptyBoardForm,
      name: opts.name || "",
      fpgaFamily: opts.fpgaFamily || "",
      boardType: opts.boardType || "",
      capabilities: opts.capabilities || [],
      cameraDeviceId: opts.cameraDeviceId || "",
      cameraDevice: opts.cameraDevice || "",
      uartDeviceId: opts.uartDeviceId || "",
      serialPort: opts.serialPort || "",
      devicePath: opts.devicePath || "",
    });
    setTab("add-board");
  }

  function applyTemplate(item: any) {
    if (!item.template) return;
    handleCreateBoardWithHardware({
      name: `${item.template.name} (${item.idcode})`,
      fpgaFamily: item.template.fpgaFamily,
      boardType: item.template.boardType,
      capabilities: item.template.capabilities,
      devicePath: item.path || "",
    });
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
      cameraDeviceId: board.cameraDeviceId || "",
      uartDeviceId: board.uartDeviceId || "",
      jtagDeviceId: board.jtagDeviceId || "",
      mappingStatus: board.mappingStatus || "UNMAPPED",
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
          cameraDeviceId: boardForm.cameraDeviceId || undefined,
          uartDeviceId: boardForm.uartDeviceId || undefined,
          jtagDeviceId: boardForm.jtagDeviceId || undefined,
          mappingStatus: boardForm.mappingStatus || undefined,
          boardImageUrl: boardForm.boardImageUrl || undefined,
          blankBitstreamPath: boardForm.blankBitstreamPath || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(editingBoardId ? "Board updated successfully." : "Board created successfully.");
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

  function handleDeleteBoard(id: string, boardName?: string) {
    setConfirmModal({
      isOpen: true,
      title: "Delete Board",
      message: `Delete board "${boardName || id}"? This action cannot be undone.`,
      confirmText: "Delete Board",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch("/api/admin/boards", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          if (res.ok) {
            setMessage("Board deleted.");
            fetchData();
          } else {
            const data = await res.json();
            setMessage(`Error: ${data.error || "Failed to delete board"}`);
          }
        } catch {
          setMessage("Error: Failed to delete board");
        }
      },
    });
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
        setMessage(`User role updated to ${newRole}`);
        fetchData();
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error || "Failed to update role"}`);
      }
    } catch {
      setMessage("Error: Failed to update role");
    } finally {
      setUpdatingRole(null);
    }
  }

  function handleDeleteUser(userId: string, userName?: string) {
    setConfirmModal({
      isOpen: true,
      title: "Delete User",
      message: `Delete user "${userName || userId}"?`,
      confirmText: "Delete User",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setUpdatingRole(userId);
        try {
          const res = await fetch(`/api/admin/users?userId=${userId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setMessage("User deleted.");
            fetchData();
          } else {
            const data = await res.json();
            setMessage(`Error: ${data.error || "Failed to delete user"}`);
          }
        } catch {
          setMessage("Error: Failed to delete user");
        } finally {
          setUpdatingRole(null);
        }
      },
    });
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
    { id: "boards" as const, label: "Boards", icon: CpuIcon, count: boards.length },
    {
      id: "hardware" as const,
      label: "Hardware Studio",
      icon: TerminalIcon,
      count: (detectedDevices?.cameras.length || 0) + (detectedDevices?.serialPorts.length || 0),
    },
    { id: "add-board" as const, label: editingBoardId ? "Edit Board" : "Add Board", icon: PlusIcon },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3Icon },
    { id: "users" as const, label: "Users", icon: UsersIcon, count: users.length },
  ];

  const boardCounts = boards.reduce(
    (acc, board) => {
      acc.total += 1;
      if (board.status === "free") acc.free += 1;
      if (board.status === "busy") acc.busy += 1;
      if (board.status === "offline") acc.offline += 1;
      if (board.mappingStatus === "VERIFIED") acc.verified += 1;
      return acc;
    },
    { total: 0, free: 0, busy: 0, offline: 0, verified: 0 }
  );

  return (
    <div className="min-h-screen pb-16 bg-background bg-grid-cockpit text-foreground transition-colors">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Minimal Industrial Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold tracking-widest text-primary uppercase">ADMIN COCKPIT</span>
              <span className="text-xs text-muted font-mono">•</span>
              <span className="text-xs font-mono text-muted">HARDWARE CONTROLLER v2.4</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Hardware &amp; Fleet Management</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDetect}
              disabled={detecting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
            >
              <SearchIcon className={`w-3.5 h-3.5 ${detecting ? "animate-spin" : ""}`} />
              <span>{detecting ? "Scanning Bus..." : "Scan Hardware"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetBoardForm();
                setTab("add-board");
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-semibold rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-all"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add Board</span>
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-mono font-medium mb-6 flex items-center justify-between border ${
              message.startsWith("Error")
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.startsWith("Error") ? (
                <AlertCircleIcon className="w-4 h-4 shrink-0 text-rose-500" />
              ) : (
                <CheckIcon className="w-4 h-4 shrink-0 text-emerald-500" />
              )}
              <span>{message}</span>
            </div>
            <button onClick={() => setMessage("")} className="text-xs opacity-60 hover:opacity-100">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Minimal Segmented Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-px mb-6 border-b border-border no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;

            return (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "add-board" && tab !== "add-board") {
                    resetBoardForm();
                  }
                  setTab(t.id);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {typeof t.count === "number" && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/30 font-bold"
                        : "bg-muted/40 text-muted border border-border"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1: BOARDS FLEET
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "boards" && (
          <div className="space-y-6">
            {/* System Status Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3.5 border border-border/80">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted">Total Registered</p>
                <p className="text-xl font-bold font-mono mt-1">{boardCounts.total}</p>
              </div>
              <div className="card p-3.5 border border-border/80">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted">Available / Free</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <p className="text-xl font-bold font-mono text-emerald-600">{boardCounts.free}</p>
                </div>
              </div>
              <div className="card p-3.5 border border-border/80">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted">In Session</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <p className="text-xl font-bold font-mono text-amber-600">{boardCounts.busy}</p>
                </div>
              </div>
              <div className="card p-3.5 border border-border/80">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted">Verified Hardware</p>
                <div className="flex items-center gap-2 mt-1">
                  <ShieldCheckIcon className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xl font-bold font-mono text-primary">{boardCounts.verified}</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 card border-border/60">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs text-muted font-mono">Loading boards...</p>
              </div>
            ) : boards.length === 0 ? (
              <div className="text-center py-16 card border-border/60">
                <CpuIcon className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-bold text-foreground">No boards configured</h3>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Scan connected hardware in Hardware Studio to automatically register boards.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button onClick={() => setTab("hardware")} className="btn-primary text-xs py-1.5 px-3">
                    Open Hardware Studio
                  </button>
                  <button onClick={() => setTab("add-board")} className="btn-secondary text-xs py-1.5 px-3">
                    Add Manually
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    className="card p-5 border border-border/80 hover:border-primary/50 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-muted/10 border border-border flex items-center justify-center font-mono text-xs font-bold text-muted">
                            {board.boardType.slice(0, 4).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">{board.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted font-mono mt-0.5">
                              <span>{board.fpgaFamily}</span>
                              <span>•</span>
                              <span>{board.boardType}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                              board.status === "free"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : board.status === "busy"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                            }`}
                          >
                            {board.status}
                          </span>
                        </div>
                      </div>

                      {/* Hardware Mapping Status Pill */}
                      <div className="my-3 p-2 rounded bg-background/60 border border-border/50 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted uppercase">Mapping:</span>
                          {board.mappingStatus === "VERIFIED" && (
                            <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                              <CheckIcon className="w-3 h-3" /> VERIFIED
                            </span>
                          )}
                          {board.mappingStatus === "DEGRADED" && (
                            <span className="text-red-600 font-bold inline-flex items-center gap-1">
                              <AlertCircleIcon className="w-3 h-3" /> DEGRADED
                            </span>
                          )}
                          {board.mappingStatus === "PENDING_VERIFICATION" && (
                            <span className="text-amber-600 font-bold">PENDING TEST</span>
                          )}
                          {(!board.mappingStatus || board.mappingStatus === "UNMAPPED") && (
                            <span className="text-muted">UNMAPPED</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleVerifyBoard(board.id)}
                          disabled={verifyingBoardId === board.id}
                          className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCwIcon className={`w-3 h-3 ${verifyingBoardId === board.id ? "animate-spin" : ""}`} />
                          <span>Verify</span>
                        </button>
                      </div>

                      {/* Technical Specs List */}
                      <div className="space-y-1 text-xs text-muted font-mono bg-background/30 p-2.5 rounded border border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground/60">CAMERA:</span>
                          <span className="truncate max-w-[240px] text-foreground" title={board.cameraDevice || "None"}>
                            {board.cameraDevice || "None"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-foreground/60">UART:</span>
                          <span className="truncate max-w-[240px] text-foreground" title={board.serialPort || "None"}>
                            {board.serialPort || "None"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-foreground/60">JTAG / IP:</span>
                          <span className="truncate max-w-[240px] text-foreground" title={board.devicePath || board.ipAddress || "None"}>
                            {board.devicePath || board.ipAddress || "Default USB"}
                          </span>
                        </div>
                      </div>

                      {/* Capabilities */}
                      {board.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {board.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-[9px] font-mono font-bold uppercase tracking-wider bg-background px-1.5 py-0.5 rounded border border-border text-muted"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted">TIMEOUT: {board.sessionTimeoutMinutes || 30}M</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditBoard(board)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-background border border-border hover:bg-muted/10 text-foreground transition-colors"
                        >
                          <Edit3Icon className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBoard(board.id, board.name)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                        >
                          <Trash2Icon className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2: HARDWARE STUDIO & MAPPING (Full-Width Precision Grid)
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "hardware" && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="card p-4 border border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Hardware Registry & Visual Binding Studio</h2>
                <p className="text-xs text-muted font-mono mt-0.5">
                  Inspect physical USB topology, verify persistent nodes, and bind endpoints to boards.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDetect}
                  disabled={detecting}
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                >
                  <RefreshCwIcon className={`w-3.5 h-3.5 ${detecting ? "animate-spin" : ""}`} />
                  <span>Rescan Hardware</span>
                </button>
              </div>
            </div>

            {/* SECTION 1: VIDEO CAMERAS (Wide 3-Column Grid) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-muted flex items-center gap-2">
                  <CameraIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Video Capture Endpoints</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/15">
                    {detectedDevices?.cameras.length || 0}
                  </span>
                </h3>
              </div>

              {detectedDevices?.cameras.length === 0 && !detecting && (
                <div className="text-center py-8 card border-border/60 bg-background/50">
                  <p className="text-xs text-muted font-mono">No video capture devices connected.</p>
                </div>
              )}

              {detectedDevices && detectedDevices.cameras.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detectedDevices.cameras.map((c) => {
                    const previewSrc = c.previewUrl
                      ? `${c.previewUrl}?t=${cameraTimestamps[c.id] || 0}`
                      : `/api/admin/hardware/cameras/${c.id}/preview`;

                    const assignedBoard = boards.find(
                      (b) => b.cameraDeviceId === c.id || b.cameraDevice === c.preferredPath
                    );

                    return (
                      <div
                        key={c.id}
                        className={`card p-0 overflow-hidden border transition-all flex flex-col justify-between ${
                          assignedBoard ? "border-primary/60" : "border-border/80"
                        }`}
                      >
                        <div>
                          {/* 16:9 Snapshot Frame */}
                          <div className="relative aspect-video bg-black/80 flex items-center justify-center overflow-hidden group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewSrc}
                              alt={c.model}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />

                            {/* Status Tag Overlay */}
                            <div className="absolute top-2 left-2">
                              {c.isPersistent ? (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 backdrop-blur">
                                  PERSISTENT
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-300 border border-amber-700/50 backdrop-blur">
                                  TRANSIENT
                                </span>
                              )}
                            </div>

                            <div className="absolute top-2 right-2">
                              <button
                                type="button"
                                onClick={() => handleRefreshCamera(c.id)}
                                className="text-[10px] font-mono font-semibold bg-black/70 hover:bg-black text-white px-2 py-1 rounded border border-white/20 transition-all flex items-center gap-1"
                              >
                                <RefreshCwIcon className="w-2.5 h-2.5" /> Snapshot
                              </button>
                            </div>

                            {assignedBoard && (
                              <div className="absolute bottom-2 left-2 bg-primary text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                                <CheckIcon className="w-3 h-3" /> {assignedBoard.name}
                              </div>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="p-3.5 space-y-2">
                            <div>
                              <h4 className="font-bold text-xs text-foreground">{c.model}</h4>
                              <p className="text-[10px] text-muted font-mono mt-0.5">
                                USB Bus {c.usbBus || "?"}:{c.usbPort || "?"} • SN: {c.serialNumber || "N/A"}
                              </p>
                            </div>

                            <div className="text-[10px] font-mono bg-background/80 p-2 rounded border border-border/60 text-muted space-y-0.5">
                              <div className="truncate text-foreground font-semibold" title={c.preferredPath}>
                                {c.preferredPath}
                              </div>
                              <div className="truncate text-muted/70 text-[9px]">{c.deviceNode}</div>
                            </div>
                          </div>
                        </div>

                        {/* Quick Assign Footer */}
                        <div className="p-3 pt-0 border-t border-border/40 mt-2 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <label className="block text-[9px] font-mono uppercase text-muted mb-1">
                              Assign to Board:
                            </label>
                            <select
                              value={assignedBoard ? assignedBoard.id : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleQuickAssignHardware(c.id, "camera", e.target.value, c.preferredPath);
                                }
                              }}
                              className="input-field text-[11px] py-1 font-mono"
                            >
                              <option value="">-- Unassigned --</option>
                              {boards.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="pt-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleCreateBoardWithHardware({
                                  cameraDeviceId: c.id,
                                  cameraDevice: c.preferredPath,
                                  name: `${c.model} Board`,
                                })
                              }
                              className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
                            >
                              + New
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: SERIAL UART MATRIX */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-muted flex items-center gap-2">
                  <TerminalIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Serial UART Endpoints</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/15">
                    {detectedDevices?.serialPorts.length || 0}
                  </span>
                </h3>
              </div>

              {detectedDevices?.serialPorts.length === 0 && !detecting && (
                <div className="text-center py-8 card border-border/60 bg-background/50">
                  <p className="text-xs text-muted font-mono">No serial UART ports detected.</p>
                </div>
              )}

              {detectedDevices && detectedDevices.serialPorts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detectedDevices.serialPorts.map((p) => {
                    const assignedBoard = boards.find(
                      (b) => b.uartDeviceId === p.id || b.serialPort === p.preferredPath
                    );
                    const testResult = uartTestResults[p.id];
                    const isTesting = testingUart[p.id];

                    return (
                      <div
                        key={p.id}
                        className={`card p-4 border transition-all flex flex-col justify-between ${
                          assignedBoard ? "border-primary/60" : "border-border/80"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-bold text-xs text-foreground">{p.model}</h4>
                              <p className="text-[10px] text-muted font-mono">
                                Bus {p.usbBus || "?"}:{p.usbPort || "?"} • SN: {p.serialNumber || "N/A"}
                              </p>
                            </div>

                            {p.isPersistent ? (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                {p.byId ? "by-id" : "by-path"}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                transient
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] font-mono bg-background/80 p-2 rounded border border-border/60 text-muted my-2 space-y-0.5">
                            <div className="truncate text-foreground font-semibold" title={p.preferredPath}>
                              {p.preferredPath}
                            </div>
                            <div className="truncate text-muted/70 text-[9px]">{p.deviceNode}</div>
                          </div>

                          {/* Diagnostic Test Button */}
                          <div className="my-2 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => handleTestUart(p.id)}
                              disabled={isTesting}
                              className="w-full text-xs font-semibold py-1.5 rounded bg-background hover:bg-muted/10 text-foreground border border-border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <ZapIcon className={`w-3 h-3 ${isTesting ? "animate-spin" : ""}`} />
                              <span>{isTesting ? "Testing Latency..." : "Test 115200 Baud"}</span>
                            </button>

                            {testResult && (
                              <div
                                className={`p-2 rounded text-[11px] font-mono flex items-center justify-between border ${
                                  testResult.success
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-600 border-red-500/20"
                                }`}
                              >
                                <span>{testResult.message}</span>
                                {testResult.latencyMs && <span>{testResult.latencyMs}ms</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Assign Footer */}
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <label className="block text-[9px] font-mono uppercase text-muted mb-1">
                              Assign to Board:
                            </label>
                            <select
                              value={assignedBoard ? assignedBoard.id : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleQuickAssignHardware(p.id, "uart", e.target.value, p.preferredPath);
                                }
                              }}
                              className="input-field text-[11px] py-1 font-mono"
                            >
                              <option value="">-- Unassigned --</option>
                              {boards.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="pt-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleCreateBoardWithHardware({
                                  uartDeviceId: p.id,
                                  serialPort: p.preferredPath,
                                  name: `${p.model} Board`,
                                })
                              }
                              className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
                            >
                              + New
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: JTAG DISCOVERY */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-muted flex items-center gap-2">
                  <CpuIcon className="w-3.5 h-3.5 text-primary" />
                  <span>JTAG FPGA Probes</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/15">
                    {detectedDevices?.hardware.length || 0}
                  </span>
                </h3>
              </div>

              {detectedDevices && detectedDevices.hardware.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detectedDevices.hardware.map((h, i) => (
                    <div key={i} className="card p-4 border border-border/80 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                          IDCODE: {h.idcode}
                        </span>
                        <p className="text-xs text-muted leading-relaxed my-2">{h.description}</p>
                      </div>

                      {h.template && (
                        <button
                          type="button"
                          onClick={() => applyTemplate(h)}
                          className="mt-2 w-full btn-primary text-xs py-1.5 font-semibold"
                        >
                          Use Template ({h.template.name})
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3: ADD / EDIT BOARD (Clean Form Layout)
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "add-board" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <form onSubmit={handleSaveBoard} className="space-y-5">
              <div className="card p-5 space-y-4 border border-border/80">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h2 className="font-bold text-sm text-foreground">
                    {editingBoardId ? "Edit FPGA Board Profile" : "Create New FPGA Board Profile"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab("hardware")}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open Hardware Studio ↗
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                      Board Name *
                    </label>
                    <input
                      type="text"
                      value={boardForm.name}
                      onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })}
                      placeholder="e.g. Basys3 Station 1"
                      className="input-field text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                      FPGA Family *
                    </label>
                    <input
                      type="text"
                      value={boardForm.fpgaFamily}
                      onChange={(e) => setBoardForm({ ...boardForm, fpgaFamily: e.target.value })}
                      placeholder="e.g. Xilinx Artix-7"
                      className="input-field text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                      Board Type * (openFPGALoader name)
                    </label>
                    <input
                      type="text"
                      value={boardForm.boardType}
                      onChange={(e) => setBoardForm({ ...boardForm, boardType: e.target.value })}
                      placeholder="e.g. basys3, pynq-z2"
                      className="input-field text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                      Connection Protocol
                    </label>
                    <select
                      value={boardForm.connectionType}
                      onChange={(e) => setBoardForm({ ...boardForm, connectionType: e.target.value })}
                      className="input-field text-xs"
                    >
                      <option value="jtag">JTAG (USB Cable)</option>
                      <option value="usb">USB DFU</option>
                      <option value="network">Network SoC (PYNQ / SSH)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Hardware Bindings */}
              <div className="card p-5 space-y-4 border border-border/80">
                <h3 className="font-bold text-sm text-foreground pb-2 border-b border-border">Hardware Endpoints</h3>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                    Camera Endpoint
                  </label>
                  <select
                    value={boardForm.cameraDeviceId || boardForm.cameraDevice}
                    onChange={(e) => {
                      const selectedCam = detectedDevices?.cameras.find(
                        (c) => c.id === e.target.value || c.preferredPath === e.target.value
                      );
                      if (selectedCam) {
                        setBoardForm({
                          ...boardForm,
                          cameraDeviceId: selectedCam.id,
                          cameraDevice: selectedCam.preferredPath,
                        });
                      } else {
                        setBoardForm({
                          ...boardForm,
                          cameraDeviceId: "",
                          cameraDevice: e.target.value,
                        });
                      }
                    }}
                    className="input-field text-xs font-mono"
                  >
                    <option value="">-- None Assigned --</option>
                    {detectedDevices?.cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.model} [{c.preferredPath}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                    Serial UART Port
                  </label>
                  <select
                    value={boardForm.uartDeviceId || boardForm.serialPort}
                    onChange={(e) => {
                      const selectedUart = detectedDevices?.serialPorts.find(
                        (p) => p.id === e.target.value || p.preferredPath === e.target.value
                      );
                      if (selectedUart) {
                        setBoardForm({
                          ...boardForm,
                          uartDeviceId: selectedUart.id,
                          serialPort: selectedUart.preferredPath,
                        });
                      } else {
                        setBoardForm({
                          ...boardForm,
                          uartDeviceId: "",
                          serialPort: e.target.value,
                        });
                      }
                    }}
                    className="input-field text-xs font-mono"
                  >
                    <option value="">-- None Assigned --</option>
                    {detectedDevices?.serialPorts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.model} [{p.preferredPath}]
                      </option>
                    ))}
                  </select>
                </div>

                {boardForm.connectionType === "network" && (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase text-muted mb-1">Target IP</label>
                      <input
                        type="text"
                        value={boardForm.ipAddress}
                        onChange={(e) => setBoardForm({ ...boardForm, ipAddress: e.target.value })}
                        placeholder="192.168.2.99"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase text-muted mb-1">SSH User</label>
                      <input
                        type="text"
                        value={boardForm.sshUsername}
                        onChange={(e) => setBoardForm({ ...boardForm, sshUsername: e.target.value })}
                        placeholder="xilinx"
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase text-muted mb-1">SSH Pass</label>
                      <input
                        type="password"
                        value={boardForm.sshPassword}
                        onChange={(e) => setBoardForm({ ...boardForm, sshPassword: e.target.value })}
                        placeholder="xilinx"
                        className="input-field text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Capabilities & Controls */}
              <div className="card p-5 space-y-4 border border-border/80">
                <h3 className="font-bold text-sm text-foreground pb-2 border-b border-border">Peripherals & Limits</h3>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-2">
                    Supported Capabilities
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["uart", "camera", "led", "switches", "7segment", "pynq-jupyter", "gpio"].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => toggleCapability(cap)}
                        className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                          boardForm.capabilities.includes(cap)
                            ? "bg-primary text-white border-primary"
                            : "bg-background text-muted border-border hover:border-primary/40"
                        }`}
                      >
                        {boardForm.capabilities.includes(cap) ? (
                          <CheckIcon className="w-3.5 h-3.5" />
                        ) : (
                          <PlusIcon className="w-3.5 h-3.5" />
                        )}
                        {cap.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                      Timeout (Minutes)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={boardForm.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setBoardForm({ ...boardForm, sessionTimeoutMinutes: parseInt(e.target.value, 10) || 30 })
                      }
                      className="input-field text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1">
                      Programming Tool
                    </label>
                    <input
                      type="text"
                      value={boardForm.programmingTool}
                      onChange={(e) => setBoardForm({ ...boardForm, programmingTool: e.target.value })}
                      placeholder="openFPGALoader"
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetBoardForm();
                    setTab("boards");
                  }}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2 font-semibold">
                  {editingBoardId ? "Update Board" : "Save Board"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 4: ANALYTICS (Charts & Telemetry)
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "analytics" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Fleet Telemetry & Usage Analytics</h3>
                <p className="text-xs text-muted font-mono">Aggregated from active hardware sessions, jobs, and board telemetry</p>
              </div>
              <button
                onClick={fetchAnalytics}
                disabled={loadingAnalytics}
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <span>{loadingAnalytics ? "Refreshing..." : "Refresh Analytics"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-4 border border-border/80">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-muted mb-4">
                  Weekly Session Volume
                </h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData?.fpgaUsageData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "11px" }} />
                      <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-4 border border-border/80">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-muted mb-4">
                  Board Fleet Utilization
                </h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.boardUtilizationData || []} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={true} vertical={false} />
                      <XAxis type="number" fontSize={11} />
                      <YAxis dataKey="board" type="category" fontSize={11} width={80} />
                      <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "11px" }} />
                      <Bar dataKey="runs" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-4 border border-border/80">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-muted mb-4">
                  Hourly Peak Hours
                </h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData?.userActivityData || []}>
                      <defs>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="time" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "11px" }} />
                      <Area type="monotone" dataKey="active" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActive)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-4 border border-border/80">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-muted mb-4">
                  Session Duration Distribution
                </h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.sessionDurationData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis dataKey="duration" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "11px" }} />
                      <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card p-4 border border-border/80">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-muted mb-4">
                Job Execution Breakdown
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData?.reservationStatsData || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                    >
                      {(analyticsData?.reservationStatsData || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "11px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 5: USERS MANAGEMENT
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">User Management</h3>
                <p className="text-xs text-muted font-mono">Control roles, access permissions, and account status</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateUser(!showCreateUser);
                  setCreateError("");
                }}
                className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>{showCreateUser ? "Cancel" : "Create User"}</span>
              </button>
            </div>

            {showCreateUser && (
              <div className="card p-4 border border-primary/30 bg-primary/5 space-y-3">
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider font-mono">New User</h4>
                {createError && <div className="text-xs text-danger">{createError}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    className="input-field text-xs"
                    placeholder="Full name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                  <input
                    className="input-field text-xs"
                    placeholder="email@domain.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    className="input-field text-xs"
                    placeholder="Password (min 8 chars)"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-mono font-bold text-muted uppercase">Role:</label>
                    <select
                      value={createRole}
                      onChange={(e) =>
                        setCreateRole(e.target.value as "guest" | "student" | "researcher" | "admin")
                      }
                      className="input-field w-32 text-xs py-1"
                    >
                      <option value="guest">guest</option>
                      <option value="student">student</option>
                      <option value="researcher">researcher</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <button
                    onClick={async () => {
                      setCreateError("");
                      if (!createName || !createEmail || createPassword.length < 8) {
                        setCreateError("Provide name, valid email, and password (min 8 chars)");
                        return;
                      }
                      setCreateLoading(true);
                      try {
                        const res = await fetch("/api/admin/users", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: createName,
                            email: createEmail,
                            password: createPassword,
                            role: createRole,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setCreateError(data.error || "Failed to create user");
                        } else {
                          setShowCreateUser(false);
                          setCreateName("");
                          setCreateEmail("");
                          setCreatePassword("");
                          setCreateRole("student");
                          fetchData();
                        }
                      } catch {
                        setCreateError("Network error during user creation");
                      } finally {
                        setCreateLoading(false);
                      }
                    }}
                    className="btn-primary text-xs px-4 py-1.5"
                    disabled={createLoading}
                  >
                    {createLoading ? "Saving..." : "Save User"}
                  </button>
                </div>
              </div>
            )}

            <div className="card p-0 overflow-x-auto border border-border/80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/5 font-mono">
                    <th className="p-3 font-bold text-muted uppercase">ID</th>
                    <th className="p-3 font-bold text-muted uppercase">Name</th>
                    <th className="p-3 font-bold text-muted uppercase">Email</th>
                    <th className="p-3 font-bold text-muted uppercase">Role</th>
                    <th className="p-3 font-bold text-muted uppercase">Verified</th>
                    <th className="p-3 font-bold text-muted uppercase">Created</th>
                    <th className="p-3 font-bold text-muted uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/5 transition-colors">
                      <td className="p-3 font-mono text-muted">{user.id.slice(0, 8)}...</td>
                      <td className="p-3 font-semibold">{user.name}</td>
                      <td className="p-3 text-muted">{user.email}</td>
                      <td className="p-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={updatingRole === user.id}
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded border border-border bg-background cursor-pointer"
                        >
                          <option value="guest">guest</option>
                          <option value="student">student</option>
                          <option value="researcher">researcher</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        {user.verified ? (
                          <span className="text-emerald-600 font-mono font-bold">YES</span>
                        ) : (
                          <span className="text-muted font-mono">NO</span>
                        )}
                      </td>
                      <td className="p-3 text-muted font-mono">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          disabled={updatingRole === user.id}
                          className="text-danger hover:underline font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
