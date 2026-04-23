"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  verified: boolean;
  createdAt: string;
}

interface Stats {
  totalJobs: number;
  successJobs: number;
  failedJobs: number;
  totalSessions: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => {
        if (!res.ok) {
          router.push("/auth/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUser(data.user);
          setStats(data.stats);
          setName(data.user.name);
        }
      })
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const body: Record<string, string> = {};
      if (name !== user?.name) body.name = name;
      if (currentPassword && newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      if (Object.keys(body).length === 0) {
        setMessage("No changes to save.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update profile");
      } else {
        setMessage("Profile updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        // Refresh profile data
        const refreshRes = await fetch("/api/profile");
        const refreshData = await refreshRes.json();
        if (refreshData.user) {
          setUser(refreshData.user);
          setName(refreshData.user.name);
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-48 bg-gray-200 rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-muted mb-8">Manage your account settings</p>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.totalJobs}
              </div>
              <div className="text-xs text-muted mt-1">Total Jobs</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-success">
                {stats.successJobs}
              </div>
              <div className="text-xs text-muted mt-1">Successful</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-danger">
                {stats.failedJobs}
              </div>
              <div className="text-xs text-muted mt-1">Failed</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.totalSessions}
              </div>
              <div className="text-xs text-muted mt-1">Sessions</div>
            </div>
          </div>
        )}

        {/* Account info */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Account Information</h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="text-muted block mb-1">User ID</span>
              <span className="font-mono text-gray-700">{user?.id}</span>
            </div>
            <div>
              <span className="text-muted block mb-1">Email</span>
              <span className="text-gray-700">{user?.email}</span>
            </div>
            <div>
              <span className="text-muted block mb-1">Role</span>
              <span className="capitalize text-gray-700">{user?.role}</span>
            </div>
            <div>
              <span className="text-muted block mb-1">Member Since</span>
              <span className="text-gray-700">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Edit Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Your name"
              />
            </div>

            <hr className="border-border" />

            <h3 className="text-sm font-semibold text-gray-600">
              Change Password
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                placeholder="Enter new password (min 6 chars)"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 text-sm text-danger bg-danger/10 p-3 rounded-lg">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 text-sm text-success bg-success/10 p-3 rounded-lg">
              {message}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary mt-6"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </main>
    </div>
  );
}
