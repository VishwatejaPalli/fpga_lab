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
  status: string;
  lastLogin: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
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
        if (data && data.user) {
          setUser(data.user);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Soft gradient backgrounds for the page to match the premium aesthetic
  return (
    <div className="min-h-screen pb-16 bg-background bg-grid-cockpit text-foreground transition-colors">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        
        {/* Main Card Container */}
        <div className="cockpit-panel rounded-3xl border border-border overflow-hidden shadow-2xl">
          
          {/* Top Banner Gradient */}
          <div className="h-36 w-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10 dark:from-blue-900/40 dark:via-purple-900/30 dark:to-slate-900/50 border-b border-border"></div>
          
          <div className="px-8 pb-10">
            {/* Profile Avatar & Header Info */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 mb-8 gap-4">
              
              <div className="flex items-end gap-5">
                {/* Avatar */}
                <div className="w-32 h-32 rounded-full border-4 border-card bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-5xl font-bold shadow-xl shrink-0 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random&color=fff&size=128`} alt="Profile" className="w-full h-full object-cover" />
                </div>
                
                <div className="pb-2">
                  <h1 className="text-2xl font-bold text-foreground leading-tight">
                    {user?.name}
                  </h1>
                  <p className="text-muted font-mono text-xs mt-0.5">
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="pb-2 flex shrink-0">
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-mono px-8 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/25 disabled:opacity-70 disabled:cursor-not-allowed text-xs"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Error / Success Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 dark:bg-red-900/20 dark:border-red-900/30 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30 text-sm">
                {message}
              </div>
            )}

            {/* Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mb-10">
              
              {/* Field: Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Your First Name"
                />
              </div>

              {/* Field: Role (Read Only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Account Role
                </label>
                <input
                  type="text"
                  value={user?.role.toUpperCase()}
                  disabled
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed uppercase text-sm font-semibold tracking-wider"
                />
              </div>

              {/* Field: Current Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Current Password (to change password)
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Leave blank to keep current"
                />
              </div>

              {/* Field: New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter new password"
                />
              </div>

            </div>

            {/* Account Information Section */}
            <div className="mb-10 pt-8 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Account Information (Read-only)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                
                {/* Field: User ID */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    User ID
                  </label>
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-mono text-sm">
                    {user?.id}
                  </div>
                </div>

                {/* Field: Account Created On */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Account Created On
                  </label>
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-sm">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
                  </div>
                </div>

                {/* Field: Last Login */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Last Login
                  </label>
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-sm">
                    {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'}
                  </div>
                </div>

                {/* Field: Account Status */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Account Status
                  </label>
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user?.status === 'suspended' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                    <span className="capitalize text-slate-700 dark:text-slate-300">{user?.status || 'Active'}</span>
                  </div>
                </div>

                {/* Field: Email Verification Status */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Email Verification Status
                  </label>
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user?.verified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    <span className="capitalize text-slate-700 dark:text-slate-300">{user?.verified ? 'Verified' : 'Unverified'}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Email Address Section */}
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">
                My email Address
              </h3>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{user?.email}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>

              <button className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-semibold px-6 py-2.5 rounded-lg border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                +Add Email Address
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
