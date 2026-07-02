"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";

type Tab = "analytics" | "notebooks" | "reservations" | "batch" | "api-keys" | "export";

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

  // Flash message
  const [msg, setMsg] = useState({ text: "", ok: true });

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

  useEffect(() => {
    if (!user) return;
    if (tab === "analytics") fetchAnalytics();
    if (tab === "notebooks") fetchNotes();
    if (tab === "reservations") { fetchReservations(); fetchBoards(); }
    if (tab === "api-keys") fetchApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user, days]);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: "", ok: true }), 3500);
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────
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

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/researcher/notebooks?id=${id}`, { method: "DELETE" });
    fetchNotes();
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

  async function cancelReservation(id: string) {
    if (!confirm("Cancel reservation?")) return;
    await fetch(`/api/researcher/reservations?id=${id}`, { method: "DELETE" });
    fetchReservations();
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

  async function deleteApiKey(id: string) {
    if (!confirm("Revoke this API key?")) return;
    await fetch(`/api/researcher/api-keys?id=${id}`, { method: "DELETE" });
    fetchApiKeys();
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

  // ── Tab config ────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "notebooks", label: "Notebooks", icon: "📓" },
    { id: "reservations", label: "Reservations", icon: "📅" },
    { id: "batch", label: "Batch", icon: "⚡" },
    { id: "api-keys", label: "API Keys", icon: "🔑" },
    { id: "export", label: "Export", icon: "📤" },
  ];

  return (
    <div className="min-h-[100dvh]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Researcher Tools</h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
            {user?.role}
          </span>
        </div>

        {/* Flash message */}
        {msg.text && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            msg.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
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
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation active:scale-95 ${
                tab === t.id
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300"
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
            {/* Period selector */}
            <div className="flex gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition touch-manipulation ${
                    days === d ? "bg-purple-600 text-white" : "bg-white border text-gray-600"
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>

            {analytics ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Jobs" value={analytics.summary.totalJobs} />
                  <StatCard
                    label="Success Rate"
                    value={`${analytics.summary.successRate}%`}
                    color={analytics.summary.successRate >= 80 ? "text-green-600" : "text-yellow-600"}
                  />
                  <StatCard label="Boards Used" value={analytics.summary.boardsUsed} />
                  <StatCard label="Lab Hours" value={analytics.summary.totalLabHours} />
                </div>

                {/* Jobs per day bar chart */}
                <div className="card">
                  <h3 className="font-semibold mb-4 text-sm">Jobs Per Day</h3>
                  {analytics.jobsPerDay.length > 0 ? (
                    <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
                      {analytics.jobsPerDay.map((d, i) => {
                        const max = Math.max(...analytics.jobsPerDay.map((x) => x.count), 1);
                        const h = (d.count / max) * 100;
                        return (
                          <div key={i} className="flex flex-col items-center min-w-[20px] group relative">
                            <div
                              className="w-4 sm:w-5 bg-purple-200 rounded-t transition-all"
                              style={{ height: `${h}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                            />
                            <div className="absolute -top-7 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                              {d.day}: {d.count} jobs ({d.success}✓ {d.failed}✗)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted text-sm">No data for this period</p>
                  )}
                </div>

                {/* Board usage */}
                <div className="card">
                  <h3 className="font-semibold mb-4 text-sm">Board Usage</h3>
                  <div className="space-y-3">
                    {analytics.boardUsage.map((b, i) => {
                      const max = Math.max(...analytics.boardUsage.map((x) => x.job_count), 1);
                      const pct = Math.round((b.success_count / Math.max(b.job_count, 1)) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium truncate">{b.board_name}</span>
                            <span className="text-muted shrink-0 ml-2">{b.job_count} jobs · {pct}% ok</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(b.job_count / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {analytics.boardUsage.length === 0 && <p className="text-muted text-sm">No board data</p>}
                  </div>
                </div>

                {/* Peak hours */}
                <div className="card">
                  <h3 className="font-semibold mb-4 text-sm">Peak Usage Hours</h3>
                  <div className="flex items-end gap-0.5 h-24">
                    {Array.from({ length: 24 }, (_, h) => {
                      const entry = analytics.peakHours.find((p) => p.hour === h);
                      const count = entry?.count || 0;
                      const max = Math.max(...analytics.peakHours.map((p) => p.count), 1);
                      return (
                        <div key={h} className="flex-1 flex flex-col items-center group relative">
                          <div
                            className="w-full bg-purple-200 rounded-t"
                            style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                          />
                          {h % 6 === 0 && <span className="text-[9px] text-muted mt-1">{h}h</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly success rate */}
                <div className="card">
                  <h3 className="font-semibold mb-4 text-sm">Weekly Success Rate</h3>
                  <div className="space-y-2">
                    {analytics.weeklyRate.map((w, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-20 text-muted text-xs shrink-0">{w.week}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${w.rate >= 80 ? "bg-green-400" : w.rate >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                            style={{ width: `${w.rate}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-medium">{w.rate}%</span>
                      </div>
                    ))}
                    {analytics.weeklyRate.length === 0 && <p className="text-muted text-sm">No data</p>}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40">
                <div className="animate-pulse text-muted">Loading analytics...</div>
              </div>
            )}
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
                <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between">
                    <h3 className="font-semibold">{editingNote ? "Edit Note" : "New Experiment Note"}</h3>
                    <button onClick={() => setShowNoteForm(false)} className="text-muted hover:text-foreground text-xl p-1">✕</button>
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
              <div className="card text-center py-12">
                <div className="text-4xl mb-2">📓</div>
                <p className="font-medium">No experiment notes yet</p>
                <p className="text-sm text-muted mt-1">Create a note to track observations</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`card transition hover:shadow-md ${note.pinned ? "border-purple-300 ring-1 ring-purple-100" : ""}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!!note.pinned && <span>📌</span>}
                        <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => togglePin(note)} className="p-1 text-xs hover:bg-gray-100 rounded" title="Pin">
                          {note.pinned ? "📌" : "📍"}
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
                          className="p-1 text-xs hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button onClick={() => deleteNote(note.id)} className="p-1 text-xs hover:bg-red-50 rounded text-danger" title="Delete">
                          🗑
                        </button>
                      </div>
                    </div>
                    {note.content && (
                      <p className="text-sm text-muted line-clamp-3 mb-2 whitespace-pre-wrap">{note.content}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 flex-wrap">
                        {note.tags.map((t) => (
                          <span key={t} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{t}</span>
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
              <div className="card text-center py-12">
                <div className="text-4xl mb-2">📅</div>
                <p className="font-medium">No upcoming reservations</p>
                <p className="text-sm text-muted mt-1">Schedule board time in advance</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map((r) => {
                  const start = new Date(r.starts_at);
                  const end = new Date(r.ends_at);
                  const isNow = start <= new Date() && end >= new Date();
                  return (
                    <div key={r.id} className={`card flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isNow ? "border-green-300 ring-1 ring-green-100" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{r.board_name}</span>
                          {isNow && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">NOW</span>}
                        </div>
                        <div className="text-xs text-muted space-x-3">
                          <span>📅 {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {r.user_name && <span>👤 {r.user_name}</span>}
                          {r.purpose && <span>📝 {r.purpose}</span>}
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
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold mb-2">Batch Programming</h3>
              <p className="text-sm text-muted mb-4">
                Program the same bitstream to multiple boards simultaneously.
                Upload your bitstream on the{" "}
                <a href="/program" className="text-primary underline hover:no-underline">
                  Program page
                </a>
                , then use the batch API to deploy to up to 10 boards at once.
              </p>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">API Usage</h4>
                <pre className="text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`POST /api/researcher/batch
Content-Type: application/json
Authorization: Bearer fpga_xxxx...

{
  "name": "Deploy counter v2",
  "boardIds": ["board-id-1", "board-id-2"],
  "bitstreamPath": "/uploads/counter.bit",
  "bitstreamName": "counter.bit"
}`}
                </pre>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">10</div>
                  <div className="text-xs text-muted">Max boards per batch</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="text-xs text-muted">High priority queue</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">3</div>
                  <div className="text-xs text-muted">Concurrent sessions</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-2 text-sm">Session Limits</h3>
              <div className="text-sm text-muted space-y-2">
                <div className="flex justify-between">
                  <span>Session timeout</span>
                  <span className="font-medium text-foreground">120 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Concurrent sessions</span>
                  <span className="font-medium text-foreground">3</span>
                </div>
                <div className="flex justify-between">
                  <span>Job priority</span>
                  <span className="font-medium text-purple-600">High</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ API KEYS ═══════════════ */}
        {tab === "api-keys" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Generate API keys for programmatic access to boards</p>

            {/* Revealed key warning */}
            {revealedKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-semibold text-sm text-yellow-800">Save this key — you won&apos;t see it again</span>
                </div>
                <div className="bg-white rounded border px-3 py-2 font-mono text-xs break-all select-all">
                  {revealedKey}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(revealedKey); flash("Copied!", true); }}
                  className="mt-2 text-xs text-primary font-medium hover:underline"
                >
                  📋 Copy to clipboard
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
                <div className="text-4xl mb-2">🔑</div>
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
                        <code className="text-xs text-muted bg-gray-100 px-1.5 py-0.5 rounded">{k.prefix}</code>
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
                icon="📋"
                title="Job History"
                desc="All programming jobs with board, status, and timestamps"
                onCSV={() => downloadExport("jobs", "csv")}
                onJSON={() => downloadExport("jobs", "json")}
              />
              <ExportCard
                icon="🖥️"
                title="Sessions"
                desc="Hardware session logs with durations"
                onCSV={() => downloadExport("sessions", "csv")}
                onJSON={() => downloadExport("sessions", "json")}
              />
              <ExportCard
                icon="📓"
                title="Experiment Notes"
                desc="All notebooks with tags and content"
                onCSV={() => downloadExport("notes", "csv")}
                onJSON={() => downloadExport("notes", "json")}
              />
            </div>
          </div>
        )}
      </main>
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
  icon: string; title: string; desc: string; onCSV: () => void; onJSON: () => void;
}) {
  return (
    <div className="card flex flex-col">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted mt-1 flex-1">{desc}</p>
      <div className="flex gap-2 mt-4">
        <button onClick={onCSV} className="btn-secondary text-xs flex-1">CSV</button>
        <button onClick={onJSON} className="btn-secondary text-xs flex-1">JSON</button>
      </div>
    </div>
  );
}
