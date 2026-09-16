"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import ConfirmModal from "@/components/confirm-modal";
import {
  CheckCircleSolidIcon,
  XCircleSolidIcon,
  BookOpenIcon,
  PinIcon,
  EditIcon,
  TrashIcon,
  CalendarIcon,
  UserIcon,
  RocketIcon,
  RadioIcon,
  CopyIcon,
  KeyIcon,
  ZapSolidIcon,
  AlertTriangleIcon,
  XIcon,
  ScrollTextIcon,
  MonitorIcon,
} from "@/components/icons";
import { AreaChart, Area, ScatterChart, Scatter, ZAxis, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Tab = "analytics" | "telemetry" | "notebooks" | "reservations" | "batch" | "api-keys" | "export";


const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

interface Analytics {
  summary: {
    totalJobs: number;
    successJobs: number;
    failedJobs: number;
    boardsUsed: number;
    successRate: number;
    totalSessions: number;
    avgSessionMinutes: number;
    totalLabHours: number;
  };
  jobsPerDay: { day: string; count: number; success: number; failed: number }[];
  boardUsage: { board_name: string; board_type: string; job_count: number; success_count: number; avg_duration_seconds: number }[];
  weeklyRate: { week: string; total: number; success: number; rate: number }[];
  peakHours: { hour: number; count: number }[];
}

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: number;
  created_at: string;
  updated_at: string;
}

interface Reservation {
  id: string;
  board_name: string;
  user_name?: string;
  starts_at: string;
  ends_at: string;
  purpose: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Board {
  id: string;
  name: string;
  status: string;
  boardType?: string;
  fpgaFamily?: string;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "researcher" | "admin";
}

export default function ResearcherPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("analytics");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Analytics
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);

  // Telemetry
  const [telemetry, setTelemetry] = useState<{
    synthesisStats: any[];
    telemetryHistory: any[];
  } | null>(null);
  const [selectedTelemetryBoard, setSelectedTelemetryBoard] = useState<string>("");

  // Notebooks
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteForm, setNoteForm] = useState({ title: "", content: "", tags: "" });
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  // Reservations
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [resForm, setResForm] = useState({ boardId: "", startsAt: "", endsAt: "", purpose: "" });
  const [showResForm, setShowResForm] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDays, setNewKeyDays] = useState(90);
  const [revealedKey, setRevealedKey] = useState("");

  // Batch JTAG Programming states
  interface BatchSubJob {
    id: string;
    board_id: string;
    status: "queued" | "programming" | "success" | "failed" | "cancelled";
    created_at: string;
    completed_at: string | null;
    board_name: string;
  }

  interface BatchJob {
    id: string;
    name: string;
    status: "pending" | "running" | "completed" | "failed";
    total_boards: number;
    completed_boards: number;
    failed_boards: number;
    created_at: string;
    completed_at: string | null;
    jobs?: BatchSubJob[];
  }

  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [batchBitstreamName, setBatchBitstreamName] = useState("blinky.bit");
  const [batchBitstreamPath, setBatchBitstreamPath] = useState("/uploads/blinky.bit");
  const [batchName, setBatchName] = useState("");
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Real-time JTAG log streaming states
  const [activeLogJobId, setActiveLogJobId] = useState<string | null>(null);
  const [activeLogBoardName, setActiveLogBoardName] = useState("");
  const [activeJobLogs, setActiveJobLogs] = useState<string>("");
  const [jobNotification, setJobNotification] = useState<{
    id: string;
    boardName: string;
    success: boolean;
  } | null>(null);

  // Auto-dismiss job completion toast
  useEffect(() => {
    if (!jobNotification) return;
    const t = setTimeout(() => setJobNotification(null), 7000);
    return () => clearTimeout(t);
  }, [jobNotification]);

  // Flash message
  const [msg, setMsg] = useState({ text: "", ok: true });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data.user.role !== "researcher" && data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  // WebSocket JTAG logs hook
  useEffect(() => {
    if (!activeLogJobId) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/logs/${activeLogJobId}`);

    setActiveJobLogs(`[WebSocket] Connecting to log stream for ${activeLogBoardName}...\n`);

    ws.onopen = () => {
      setActiveJobLogs((prev) => prev + `[WebSocket] Connected. Waiting for JTAG logs...\n`);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "job-log" && msg.data) {
          setActiveJobLogs((prev) => prev + msg.data);
        } else if (msg.type === "job-complete") {
          setActiveJobLogs((prev) => prev + `\n[System] Programming completed: ${msg.success ? "SUCCESS" : "FAILED"}\n`);
          setJobNotification({
            id: activeLogJobId,
            boardName: activeLogBoardName || "FPGA Board",
            success: !!msg.success,
          });
        }
      } catch (err) {
        setActiveJobLogs((prev) => prev + event.data);
      }
    };

    ws.onerror = () => {
      setActiveJobLogs((prev) => prev + `[WebSocket] Connection error.\n`);
    };

    ws.onclose = () => {
      setActiveJobLogs((prev) => prev + `[WebSocket] Disconnected.\n`);
    };

    return () => {
      ws.close();
    };
  }, [activeLogJobId, activeLogBoardName]);

  useEffect(() => {
    if (!user) return;
    if (tab === "analytics") fetchAnalytics();
    if (tab === "telemetry") fetchTelemetry();
    if (tab === "notebooks") fetchNotes();
    if (tab === "reservations") { fetchReservations(); fetchBoards(); }
    if (tab === "api-keys") fetchApiKeys();
    if (tab === "batch") {
      fetchBatchJobs();
      fetchBoards();
      const interval = setInterval(fetchBatchJobs, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user, days]);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: "", ok: true }), 3500);
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────
  async function fetchTelemetry() {
    try {
      const r = await fetch("/api/researcher/telemetry");
      if (r.ok) {
        const data = await r.json();
        setTelemetry(data);
        if (data.telemetryHistory && data.telemetryHistory.length > 0) {
          const unique = Array.from(new Set(data.telemetryHistory.map((item: any) => item.boardName))) as string[];
          if (unique.length > 0) {
            setSelectedTelemetryBoard((prev) => prev && unique.includes(prev) ? prev : unique[0]);
          }
        }
      }
    } catch { /* */ }
  }
  async function fetchAnalytics() {
    try {
      const r = await fetch(`/api/researcher/analytics?days=${days}`);
      if (r.ok) setAnalytics(await r.json());
    } catch { /* */ }
  }
  async function fetchNotes() {
    try {
      const r = await fetch("/api/researcher/notebooks");
      if (r.ok) { const j = await r.json(); setNotes(j.notes); }
    } catch { /* */ }
  }
  async function fetchReservations() {
    try {
      const r = await fetch("/api/researcher/reservations?scope=all");
      if (r.ok) { const j = await r.json(); setReservations(j.reservations); }
    } catch { /* */ }
  }
  async function fetchBoards() {
    try {
      const r = await fetch("/api/boards");
      if (r.ok) { const j = await r.json(); setBoards(j.boards); }
    } catch { /* */ }
  }
  async function fetchApiKeys() {
    try {
      const r = await fetch("/api/researcher/api-keys");
      if (r.ok) { const j = await r.json(); setApiKeys(j.keys); }
    } catch { /* */ }
  }

  // ── JTAG Batch Programming ────────────────────────────────────────────
  async function fetchBatchJobs() {
    try {
      const r = await fetch("/api/researcher/batch");
      if (r.ok) {
        const j = await r.json();
        setBatches(j.batches || []);
      }
    } catch (err) {
      console.error("Error fetching batch jobs:", err);
    }
  }

  async function deployBatch() {
    if (selectedBoards.length === 0) {
      flash("Please select at least one board", false);
      return;
    }
    if (!batchBitstreamName.trim() || !batchBitstreamPath.trim()) {
      flash("Bitstream path and name are required", false);
      return;
    }
    const name = batchName.trim() || `Batch: ${batchBitstreamName}`;
    try {
      const r = await fetch("/api/researcher/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          boardIds: selectedBoards,
          bitstreamPath: batchBitstreamPath.trim(),
          bitstreamName: batchBitstreamName.trim(),
        }),
      });
      const data = await r.json();
      if (r.ok) {
        flash("JTAG Batch programming successfully queued", true);
        setSelectedBoards([]);
        setBatchName("");
        fetchBatchJobs();
      } else {
        flash(data.error || "Failed to start batch deploy", false);
      }
    } catch (err) {
      console.error("Error deploying batch:", err);
      flash("Error starting batch JTAG program", false);
    }
  }

  // ── Note CRUD ─────────────────────────────────────────────────────────
  async function saveNote() {
    const tags = noteForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const body: Record<string, unknown> = { title: noteForm.title, content: noteForm.content, tags };
    if (editingNote) body.id = editingNote.id;

    const r = await fetch("/api/researcher/notebooks", {
      method: editingNote ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      flash(editingNote ? "Note updated" : "Note created", true);
    } else {
      flash("Failed", false);
    }
    fetchNotes();
    setShowNoteForm(false);
    setEditingNote(null);
    setNoteForm({ title: "", content: "", tags: "" });
  }

  function deleteNote(id: string) {
    setConfirmModal({
      isOpen: true,
      title: "Delete Note",
      message: "Are you sure you want to delete this notebook entry?",
      confirmText: "Delete Note",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await fetch(`/api/researcher/notebooks?id=${id}`, { method: "DELETE" });
        fetchNotes();
      },
    });
  }

  async function togglePin(note: Note) {
    await fetch("/api/researcher/notebooks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
    });
    fetchNotes();
  }

  // ── Reservations ──────────────────────────────────────────────────────
  async function createReservation() {
    const r = await fetch("/api/researcher/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resForm),
    });
    if (r.ok) { flash("Reservation created", true); fetchReservations(); setShowResForm(false); }
    else { const j = await r.json(); flash(j.error || "Failed", false); }
  }

  function cancelReservation(id: string) {
    setConfirmModal({
      isOpen: true,
      title: "Cancel Reservation",
      message: "Are you sure you want to cancel this reservation?",
      confirmText: "Cancel Reservation",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await fetch(`/api/researcher/reservations?id=${id}`, { method: "DELETE" });
        fetchReservations();
      },
    });
  }

  // ── API Keys ──────────────────────────────────────────────────────────
  async function createApiKey() {
    if (!newKeyName.trim()) { flash("Key name required", false); return; }
    const r = await fetch("/api/researcher/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName, expiresInDays: newKeyDays }),
    });
    if (r.ok) {
      const j = await r.json();
      setRevealedKey(j.key);
      setNewKeyName("");
      fetchApiKeys();
    } else { const j = await r.json(); flash(j.error || "Failed", false); }
  }

  function deleteApiKey(id: string) {
    setConfirmModal({
      isOpen: true,
      title: "Revoke API Key",
      message: "Are you sure you want to revoke this API key? External systems using it will lose access immediately.",
      confirmText: "Revoke Key",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await fetch(`/api/researcher/api-keys?id=${id}`, { method: "DELETE" });
        fetchApiKeys();
      },
    });
  }

  // ── Export ────────────────────────────────────────────────────────────
  function downloadExport(type: string, format: string) {
    window.open(`/api/researcher/export?type=${type}&format=${format}`, "_blank");
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[100dvh]">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      </div>
    );
  }

  // Telemetry computation
  const uniqueTelemetryBoards = telemetry?.telemetryHistory
    ? (Array.from(new Set(telemetry.telemetryHistory.map((item) => item.boardName))) as string[])
    : [];
  const filteredTelemetryHistory = telemetry?.telemetryHistory && selectedTelemetryBoard
    ? telemetry.telemetryHistory.filter((item) => item.boardName === selectedTelemetryBoard)
    : [];

  // ── Tab config ────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { 
      id: "analytics", 
      label: "Analytics", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ) 
    },
    { 
      id: "telemetry", 
      label: "Telemetry", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827a1.125 1.125 0 01.26 1.43l-1.297 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128c.332-.183.582-.495.645-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ) 
    },
    { 
      id: "notebooks", 
      label: "Notebooks", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
        </svg>
      ) 
    },
    { 
      id: "reservations", 
      label: "Reservations", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ) 
    },
    { 
      id: "batch", 
      label: "Batch", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ) 
    },
    { 
      id: "api-keys", 
      label: "API Keys", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 11-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ) 
    },
    { 
      id: "export", 
      label: "Export", 
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      ) 
    },
  ];

  return (
    <div className="min-h-screen pb-16 bg-background bg-grid-cockpit text-foreground transition-colors">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Researcher Tools</h1>
          <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
            {user?.role}
          </span>
        </div>

        {/* Flash message */}
        {msg.text && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-xs font-mono font-medium ${
            msg.ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30" : "bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30"
          }`}>
            {msg.text}
          </div>
        )}

        {/* Tab bar — scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-4 px-4 scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-mono font-medium transition-all touch-manipulation active:scale-95 ${
                tab === t.id
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-card text-muted border border-border hover:border-purple-500/40 hover:text-foreground"
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════ ANALYTICS ═══════════════ */}
        {tab === "analytics" && (
          <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total Jobs Run" value={analytics?.summary.totalJobs ?? 0} />
              <StatCard label="Success Rate" value={`${analytics?.summary.successRate ?? 0}%`} />
              <StatCard label="Total Lab Hours" value={`${analytics?.summary.totalLabHours ?? 0} hrs`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Jobs Activity Timeline */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Jobs Activity Timeline (Past {days} Days)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics?.jobsPerDay || []}>
                      <defs>
                        <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis fontSize={12} label={{ value: 'Jobs Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#666' } }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorJobs)" name="Total Jobs" />
                      <Area type="monotone" dataKey="success" stroke="#10b981" fillOpacity={0} name="Success Jobs" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. Weekly Success Rate Trends */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Weekly Success Rate Trends</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.weeklyRate || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="week" fontSize={12} />
                      <YAxis fontSize={12} unit="%" />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="rate" stroke="#10b981" activeDot={{ r: 8 }} name="Success Rate" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. Job Status Distribution */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Job Status Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          analytics
                            ? [
                                { name: "Success", count: analytics.summary.successJobs },
                                { name: "Failed", count: analytics.summary.failedJobs },
                              ]
                            : []
                        }
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {[0, 1].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4. Hourly Peak Usage Analysis */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Hourly Peak Usage Analysis</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.peakHours || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis dataKey="hour" name="Hour of Day" fontSize={12} tickFormatter={(h) => `${h}:00`} />
                      <YAxis fontSize={12} label={{ value: 'Jobs', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#666' } }} />
                      <Tooltip cursor={{ fill: '#f3e8ff' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Jobs Launched" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 5. FPGA Board Utilization */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm">FPGA Board Utilization</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.boardUsage || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="board_name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip cursor={{ fill: '#f3e8ff' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="job_count" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Total Jobs Run" />
                    <Bar dataKey="success_count" fill="#10b981" radius={[2, 2, 0, 0]} name="Success Jobs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ TELEMETRY ═══════════════ */}
        {tab === "telemetry" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Board Selector */}
            <div className="cockpit-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border shadow-sm">
              <div>
                <h2 className="text-base font-bold text-foreground">FPGA Health &amp; Telemetry</h2>
                <p className="text-xs text-muted">Real-time health, thermal, and power monitoring</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="telemetry-board-select" className="text-xs font-mono font-semibold text-muted">Select Board:</label>
                <select
                  id="telemetry-board-select"
                  value={selectedTelemetryBoard}
                  onChange={(e) => setSelectedTelemetryBoard(e.target.value)}
                  className="bg-card border border-border text-foreground text-xs font-mono rounded-xl focus:ring-purple-500 focus:border-purple-500 block p-2 px-3 transition-all cursor-pointer"
                >
                  {uniqueTelemetryBoards.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Header Cards */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard 
                label="Avg Chip Temp" 
                value={
                  filteredTelemetryHistory.length > 0
                    ? `${(filteredTelemetryHistory.reduce((acc, curr) => acc + curr.temperature, 0) / filteredTelemetryHistory.length).toFixed(1)} °C`
                    : "41.6 °C"
                } 
              />
              <StatCard 
                label="Avg Power Draw" 
                value={
                  filteredTelemetryHistory.length > 0
                    ? `${(filteredTelemetryHistory.reduce((acc, curr) => acc + curr.power, 0) / filteredTelemetryHistory.length).toFixed(3)} W`
                    : "0.154 W"
                } 
              />
              <StatCard 
                label="Peak Compiled Size" 
                value={
                  telemetry?.synthesisStats && telemetry.synthesisStats.length > 0
                    ? `${Math.max(...telemetry.synthesisStats.map(s => s.lutCount))} LUTs`
                    : "54 LUTs"
                } 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Synthesis Logic Footprint Comparison */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Synthesized Design Resource footprints (LUT & FF Usage)</h3>
                <div className="h-64">
                  {telemetry?.synthesisStats && telemetry.synthesisStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={telemetry.synthesisStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                        <XAxis dataKey="designName" fontSize={11} tickFormatter={(val) => val.length > 15 ? val.substring(0, 12) + "..." : val} />
                        <YAxis fontSize={12} label={{ value: 'Cells Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '11px', fill: '#666' } }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="lutCount" fill="#3b82f6" name="LUTs" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="ffCount" fill="#10b981" name="Registers (FF)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted">No successful synthesized designs found to analyze.</div>
                  )}
                </div>
              </div>

              {/* 2. FPGA Chip Temperature over time */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">FPGA SoC Core Thermal Profile (°C)</h3>
                <div className="h-64">
                  {filteredTelemetryHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredTelemetryHistory}>
                        <defs>
                          <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="timestamp" fontSize={11} />
                        <YAxis fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} unit="°C" />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area type="monotone" dataKey="temperature" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTemp)" name="Core Temp" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted">Loading thermal data...</div>
                  )}
                </div>
              </div>

              {/* 3. Voltage Rail Stability Monitor */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">FPGA Voltage Rails Monitor (VCCINT & VCCAUX)</h3>
                <div className="h-64">
                  {filteredTelemetryHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredTelemetryHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="timestamp" fontSize={11} />
                        <YAxis fontSize={12} domain={['dataMin - 0.1', 'dataMax + 0.1']} unit="V" />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="vccint" stroke="#ef4444" name="VCCINT (Core)" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="vccaux" stroke="#8b5cf6" name="VCCAUX (Aux)" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted">Loading voltage data...</div>
                  )}
                </div>
              </div>

              {/* 4. Power Dissipation Tracker */}
              <div className="card">
                <h3 className="font-semibold mb-4 text-sm">Active Core Power Load Profile (Watts)</h3>
                <div className="h-64">
                  {filteredTelemetryHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredTelemetryHistory}>
                        <defs>
                          <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="timestamp" fontSize={11} />
                        <YAxis fontSize={12} domain={[0, 'auto']} unit="W" />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area type="monotone" dataKey="power" stroke="#10b981" fillOpacity={1} fill="url(#colorPower)" name="Power Load" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted">Loading power data...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ NOTEBOOKS ═══════════════ */}
        {tab === "notebooks" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-muted">Attach notes and observations to experiments</p>
              <button
                onClick={() => {
                  setShowNoteForm(true);
                  setEditingNote(null);
                  setNoteForm({ title: "", content: "", tags: "" });
                }}
                className="btn-primary text-sm shrink-0"
              >
                + New Note
              </button>
            </div>

            {/* Note form modal */}
            {showNoteForm && (
              <div
                className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                onClick={(e) => { if (e.target === e.currentTarget) setShowNoteForm(false); }}
              >
                <div className="bg-card border border-border text-foreground w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                  <div className="sticky top-0 bg-card border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{editingNote ? "Edit Note" : "New Experiment Note"}</h3>
                    <button onClick={() => setShowNoteForm(false)} className="text-muted hover:text-foreground p-1 rounded">
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 sm:p-6 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted mb-1 block">Title</label>
                      <input
                        value={noteForm.title}
                        onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                        placeholder="e.g. Counter overflow test — Basys3"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted mb-1 block">Content</label>
                      <textarea
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        placeholder="Observations, measurements, conclusions..."
                        rows={8}
                        className="input-field font-mono resize-y"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted mb-1 block">Tags (comma-separated)</label>
                      <input
                        value={noteForm.tags}
                        onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })}
                        placeholder="verilog, counter, timing"
                        className="input-field"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveNote} className="btn-primary flex-1">
                        {editingNote ? "Update" : "Save"} Note
                      </button>
                      <button onClick={() => setShowNoteForm(false)} className="btn-secondary">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="card text-center py-12 border-dashed border-2 border-border bg-card/40">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3 text-purple-600 dark:text-purple-400">
                  <BookOpenIcon className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">No experiment notes yet</h4>
                <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
                  Log telemetry observations, timing benchmarks, or FPGA test vectors to organize your research.
                </p>
                <button
                  onClick={() => setShowNoteForm(true)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  + Create First Note
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`card transition hover:shadow-md ${note.pinned ? "border-purple-300 dark:border-purple-700/50 ring-1 ring-purple-100 dark:ring-purple-900/20" : ""}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!!note.pinned && <PinIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                        <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => togglePin(note)} className="p-1 text-xs hover:bg-muted rounded" title="Pin">
                          <PinIcon className={`w-3.5 h-3.5 ${note.pinned ? "text-purple-600 dark:text-purple-400" : "text-muted"}`} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingNote(note);
                            setNoteForm({
                              title: note.title,
                              content: note.content,
                              tags: note.tags.join(", "),
                            });
                            setShowNoteForm(true);
                          }}
                          className="p-1 text-xs hover:bg-muted rounded text-muted hover:text-foreground"
                          title="Edit"
                        >
                          <EditIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteNote(note.id)} className="p-1 text-xs hover:bg-red-500/10 rounded text-danger" title="Delete">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {note.content && (
                      <p className="text-sm text-muted line-clamp-3 mb-2 whitespace-pre-wrap">{note.content}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 flex-wrap">
                        {note.tags.map((t) => (
                          <span key={t} className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">{t}</span>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted">{new Date(note.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ RESERVATIONS ═══════════════ */}
        {tab === "reservations" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-muted">Reserve boards for scheduled lab time</p>
              <button onClick={() => setShowResForm(!showResForm)} className="btn-primary text-sm shrink-0">
                {showResForm ? "Cancel" : "+ New Reservation"}
              </button>
            </div>

            {/* Reservation form */}
            {showResForm && (
              <div className="card space-y-4">
                <h3 className="font-semibold text-sm">New Reservation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Board</label>
                    <select
                      value={resForm.boardId}
                      onChange={(e) => setResForm({ ...resForm, boardId: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select board...</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Purpose</label>
                    <input
                      value={resForm.purpose}
                      onChange={(e) => setResForm({ ...resForm, purpose: e.target.value })}
                      placeholder="Testing counter module"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Start Time</label>
                    <input
                      type="datetime-local"
                      value={resForm.startsAt}
                      onChange={(e) => setResForm({ ...resForm, startsAt: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">End Time (max 4h)</label>
                    <input
                      type="datetime-local"
                      value={resForm.endsAt}
                      onChange={(e) => setResForm({ ...resForm, endsAt: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <button onClick={createReservation} className="btn-primary w-full">
                  Create Reservation
                </button>
              </div>
            )}

            {/* List */}
            {reservations.length === 0 ? (
              <div className="card text-center py-12 border-dashed border-2 border-border bg-card/40">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 text-emerald-500 dark:text-emerald-400">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">No upcoming reservations</h4>
                <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
                  Schedule exclusive hardware lab time in advance to run long synthesis passes or automated test loops.
                </p>
                <button
                  onClick={() => setShowResForm(true)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  + Reserve Board Time
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map((r) => {
                  const start = new Date(r.starts_at);
                  const end = new Date(r.ends_at);
                  const isNow = start <= new Date() && end >= new Date();
                  return (
                    <div key={r.id} className={`card flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isNow ? "border-green-300 dark:border-green-700/50 ring-1 ring-green-100 dark:ring-green-900/20" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{r.board_name}</span>
                          {isNow && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">NOW</span>}
                        </div>
                        <div className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {r.user_name && (
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3.5 h-3.5" />
                              {r.user_name}
                            </span>
                          )}
                          {r.purpose && (
                            <span className="flex items-center gap-1">
                              <EditIcon className="w-3.5 h-3.5" />
                              {r.purpose}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => cancelReservation(r.id)} className="btn-danger text-xs shrink-0">
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ BATCH PROGRAMMING ═══════════════ */}
        {tab === "batch" && (
          <div className="space-y-6">
            {/* Interactive Deploy Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Config */}
              <div className="card space-y-4">
                <h3 className="text-base font-bold text-foreground mb-1">Batch JTAG Configuration</h3>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Batch Label</label>
                  <input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Basys3 Bench Deployment"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Bitstream File Name</label>
                  <input
                    value={batchBitstreamName}
                    onChange={(e) => setBatchBitstreamName(e.target.value)}
                    placeholder="e.g. blinky.bit"
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Server Bitstream File Path</label>
                  <input
                    value={batchBitstreamPath}
                    onChange={(e) => setBatchBitstreamPath(e.target.value)}
                    placeholder="e.g. /uploads/blinky.bit"
                    className="input-field font-mono"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Upload your custom bitstream file on the{" "}
                    <a href="/program" className="text-purple-600 underline hover:no-underline font-medium">
                      Program page
                    </a>
                    , then copy its path here.
                  </p>
                </div>
                <button
                  onClick={deployBatch}
                  className="btn-primary w-full py-2.5 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <RocketIcon className="w-4 h-4" />
                  Deploy Batch to {selectedBoards.length} Boards
                </button>
              </div>

              {/* Target Boards Selector */}
              <div className="card flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-foreground">Select Target Boards</h3>
                  <button
                    onClick={() => {
                      const allSelectable = boards.filter((b) => b.status !== "offline").map((b) => b.id);
                      if (selectedBoards.length === allSelectable.length) {
                        setSelectedBoards([]);
                      } else {
                        setSelectedBoards(allSelectable);
                      }
                    }}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    {selectedBoards.length === boards.filter((b) => b.status !== "offline").length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                {boards.length === 0 ? (
                  <p className="text-muted text-xs my-auto text-center">No boards registered.</p>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-[280px] pr-1">
                    {boards.map((b) => {
                      const isSelected = selectedBoards.includes(b.id);
                      const isOffline = b.status === "offline";
                      const isBusy = b.status === "busy";

                      return (
                        <label
                          key={b.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition cursor-pointer select-none ${
                            isOffline
                              ? "bg-muted/20 border-border opacity-50 cursor-not-allowed text-muted"
                              : isSelected
                              ? "bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300 ring-1 ring-purple-500/20"
                              : "bg-card hover:border-purple-500/30 border-border text-foreground"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isOffline}
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedBoards((prev) => prev.filter((id) => id !== b.id));
                              } else {
                                setSelectedBoards((prev) => [...prev, b.id]);
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-400 w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">{b.name}</span>
                              <span className="text-[10px] text-muted font-mono">{b.boardType}</span>
                            </div>
                            <div className="text-[10px] text-muted mt-0.5 truncate">
                              Family: {b.fpgaFamily}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isOffline ? "bg-gray-150 text-gray-500" : isBusy ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-green-100 text-green-700"
                          }`}>
                            {b.status}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* JTAG Live Log Stream Panel */}
            {activeLogJobId && (
              <div className="card border-purple-300 bg-gray-950 text-gray-100 p-4 font-mono text-xs flex flex-col relative shadow-lg">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                  <span className="text-gray-400 flex items-center gap-1.5 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    Live Log Stream: {activeLogBoardName}
                  </span>
                  <button
                    onClick={() => setActiveLogJobId(null)}
                    className="text-muted hover:text-foreground transition font-bold flex items-center gap-1 text-xs"
                  >
                    <XIcon className="w-4 h-4" /> Close Feed
                  </button>
                </div>
                <div className="bg-slate-950 border border-border rounded-xl p-3 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text font-mono text-[11px] text-slate-200">
                  {activeJobLogs}
                </div>
              </div>
            )}

            {/* Batch History List */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground">JTAG Batch Jobs History</h3>

              {batches.length === 0 ? (
                <div className="card text-center py-12 border-dashed border-2 border-border bg-card/40">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-blue-500 dark:text-blue-400">
                    <ZapSolidIcon className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-foreground text-sm">No batch deployments yet</h4>
                  <p className="text-xs text-muted max-w-md mx-auto mt-1">
                    Deploy a bitstream simultaneously across multiple connected FPGA boards using the configuration form above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {batches.map((batch) => {
                    const isExpanded = expandedBatch === batch.id;
                    const total = batch.total_boards;
                    const done = batch.completed_boards + batch.failed_boards;
                    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                    const isRunning = batch.status === "running";

                    return (
                      <div
                        key={batch.id}
                        className={`card transition border overflow-hidden p-0 ${
                          isRunning ? "border-purple-300 dark:border-purple-700/50 shadow-sm" : ""
                        }`}
                      >
                        {/* Header Details */}
                        <div
                          onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-foreground">{batch.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                batch.status === "completed"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : batch.status === "failed"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 animate-pulse"
                              }`}>
                                {batch.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted space-x-3">
                              <span>Created: {new Date(batch.created_at).toLocaleString()}</span>
                              <span>Target: {total} boards</span>
                              {batch.completed_at && <span>Done: {new Date(batch.completed_at).toLocaleString()}</span>}
                            </div>
                          </div>

                          <div className="sm:w-48 shrink-0 flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex justify-between text-[10px] font-semibold text-muted mb-1">
                                <span>Progress</span>
                                <span>{percent}% ({done}/{total})</span>
                              </div>
                              <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    batch.status === "completed"
                                      ? "bg-green-500"
                                      : batch.status === "failed"
                                      ? "bg-red-500"
                                      : "bg-purple-600"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-muted font-semibold transition-transform">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>

                        {/* Collapsible Details list of sub-jobs */}
                        {isExpanded && (
                          <div className="border-t border-border bg-card divide-y divide-border/60">
                            {batch.jobs && batch.jobs.length > 0 ? (
                              batch.jobs.map((job) => (
                                <div key={job.id} className="flex items-center justify-between p-3.5 pl-6 text-xs transition hover:bg-muted/20">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground font-mono">{job.board_name}</span>
                                      <span className="text-[10px] font-mono text-muted">{job.board_id}</span>
                                    </div>
                                    {job.completed_at && (
                                      <div className="text-[9px] text-muted mt-0.5">
                                        Completed: {new Date(job.completed_at).toLocaleString()}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      job.status === "success"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                        : job.status === "failed" || job.status === "cancelled"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 animate-pulse"
                                    }`}>
                                      {job.status}
                                    </span>
                                    {(job.status === "programming" || job.status === "queued" || job.status === "success" || job.status === "failed") && (
                                      <button
                                        onClick={() => {
                                          setActiveLogJobId(job.id);
                                          setActiveLogBoardName(job.board_name);
                                        }}
                                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800 hover:bg-purple-500/10 px-2 py-1 rounded transition select-none flex items-center gap-1"
                                      >
                                        <RadioIcon className="w-3 h-3" /> Live Logs
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="p-4 text-center text-xs text-muted">No sub-jobs generated for this batch.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ API KEYS ═══════════════ */}
        {tab === "api-keys" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Generate API keys for programmatic access to boards</p>

            {/* Revealed key warning */}
            {revealedKey && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-sm text-amber-600 dark:text-amber-400 font-mono">Save this key — you won&apos;t see it again</span>
                </div>
                <div className="bg-card rounded-xl border border-border px-3 py-2 font-mono text-xs text-emerald-600 dark:text-emerald-400 break-all select-all">
                  {revealedKey}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(revealedKey); flash("Copied!", true); }}
                  className="mt-2 text-xs text-primary font-mono font-medium hover:underline flex items-center gap-1.5"
                >
                  <CopyIcon className="w-3.5 h-3.5" /> Copy to clipboard
                </button>
              </div>
            )}

            {/* Create key form */}
            <div className="card">
              <h3 className="font-semibold text-sm mb-3">Create New Key</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. CI Pipeline)"
                  className="input-field flex-1"
                />
                <select
                  value={newKeyDays}
                  onChange={(e) => setNewKeyDays(Number(e.target.value))}
                  className="input-field sm:w-40"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
                <button onClick={createApiKey} className="btn-primary shrink-0">
                  Generate Key
                </button>
              </div>
            </div>

            {/* Key list */}
            {apiKeys.length === 0 ? (
              <div className="card text-center py-12">
                <div className="flex justify-center mb-2">
                  <KeyIcon className="w-10 h-10 text-muted" />
                </div>
                <p className="font-medium">No API keys</p>
                <p className="text-sm text-muted mt-1">Create a key for programmatic access</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((k) => (
                  <div key={k.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{k.name}</span>
                        <code className="text-xs text-muted bg-muted px-1.5 py-0.5 rounded font-mono">{k.prefix}</code>
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.expires_at && ` · Expires ${new Date(k.expires_at).toLocaleDateString()}`}
                        {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button onClick={() => deleteApiKey(k.id)} className="btn-danger text-xs shrink-0">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ EXPORT ═══════════════ */}
        {tab === "export" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Download your data as CSV or JSON files</p>

            <div className="grid gap-4 sm:grid-cols-3">
              <ExportCard
                icon={<ScrollTextIcon className="w-6 h-6 text-primary" />}
                title="Job History"
                desc="All programming jobs with board, status, and timestamps"
                onCSV={() => downloadExport("jobs", "csv")}
                onJSON={() => downloadExport("jobs", "json")}
              />
              <ExportCard
                icon={<MonitorIcon className="w-6 h-6 text-primary" />}
                title="Sessions"
                desc="Hardware session logs with durations"
                onCSV={() => downloadExport("sessions", "csv")}
                onJSON={() => downloadExport("sessions", "json")}
              />
              <ExportCard
                icon={<BookOpenIcon className="w-6 h-6 text-primary" />}
                title="Experiment Notes"
                desc="All notebooks with tags and content"
                onCSV={() => downloadExport("notes", "csv")}
                onJSON={() => downloadExport("notes", "json")}
              />
            </div>
          </div>
        )}
      </main>

      {/* Live FPGA Job Completion Notification Toast */}
      {jobNotification && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 max-w-sm transition-all animate-in slide-in-from-bottom-5 ${
            jobNotification.success
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-200"
              : "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-200"
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {jobNotification.success ? (
              <CheckCircleSolidIcon className="w-5 h-5 text-emerald-500" />
            ) : (
              <XCircleSolidIcon className="w-5 h-5 text-rose-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground">
              {jobNotification.success ? "JTAG Programming Succeeded" : "JTAG Programming Failed"}
            </h4>
            <p className="text-xs mt-0.5 text-muted">
              Target board <strong className="font-mono text-foreground">{jobNotification.boardName}</strong> finished programming.
            </p>
          </div>
          <button
            onClick={() => setJobNotification(null)}
            className="text-muted hover:text-foreground text-xs p-1 rounded transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card text-center py-4">
      <div className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function ExportCard({ icon, title, desc, onCSV, onJSON }: {
  icon: React.ReactNode; title: string; desc: string; onCSV: () => void; onJSON: () => void;
}) {
  return (
    <div className="card flex flex-col">
      <div className="mb-2 text-primary flex items-center">{icon}</div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      <p className="text-xs text-muted mt-1 flex-1">{desc}</p>
      <div className="flex gap-2 mt-4">
        <button onClick={onCSV} className="btn-secondary text-xs flex-1">CSV</button>
        <button onClick={onJSON} className="btn-secondary text-xs flex-1">JSON</button>
      </div>
    </div>
  );
}
