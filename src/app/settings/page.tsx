"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import Navbar from "@/components/navbar";
import {
  UserIcon,
  LockIcon,
  PaletteIcon,
  BellIcon,
  AlertCircleIcon,
  CheckIcon,
} from "@/components/icons";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const themes = [
  { id: "dark", name: "Dark Theme", color: "bg-[#0b0f19] border-blue-500/50" },
  { id: "light", name: "Light Theme", color: "bg-[#f8fafc] border-blue-400/50" },
  { id: "system", name: "System", color: "bg-gradient-to-r from-[#f8fafc] to-[#0b0f19] border-gray-400/50" },
] as const;

export default function SettingsPage() {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "appearance" | "notifications" | "about">("profile");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const tabs = [
    { id: "profile", label: "Profile", icon: <UserIcon className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <LockIcon className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <PaletteIcon className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <BellIcon className="w-4 h-4" /> },
    { id: "about", label: "About", icon: <AlertCircleIcon className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Settings</h1>
        <p className="text-muted mb-8 sm:mb-12">Manage your account settings and preferences</p>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="md:w-64 shrink-0">
            <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 scrollbar-hide">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === t.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content Area */}
          <div className="flex-1 space-y-6">
            
            {/* 1. Profile Section */}
            {activeTab === "profile" && (
              <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold border-b border-border pb-4">Profile Information</h2>
                
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Full Name</label>
                    <input type="text" defaultValue={user?.name || ""} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Username</label>
                    <input type="text" defaultValue={user?.name?.toLowerCase().replace(/\s+/g, '') || ""} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Email Address</label>
                    <input type="email" defaultValue={user?.email || ""} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Role</label>
                    <input type="text" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Student"} disabled className="input-field opacity-70 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Institution</label>
                    <input type="text" defaultValue="Example University" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Department</label>
                    <input type="text" defaultValue="Computer Engineering" className="input-field" />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button className="btn-primary">Save Changes</button>
                </div>
              </div>
            )}

            {/* 2. Security Section */}
            {activeTab === "security" && (
              <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold border-b border-border pb-4">Security Settings</h2>
                
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Current Password</label>
                    <input type="password" placeholder="••••••••" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">New Password</label>
                    <input type="password" placeholder="••••••••" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Confirm Password</label>
                    <input type="password" placeholder="••••••••" className="input-field" />
                  </div>
                  <button className="btn-primary mt-2">Update Password</button>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">Email Verification <span className="text-success text-sm flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> Verified</span></h4>
                      <p className="text-sm text-muted">Your email address has been verified.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border">
                    <div>
                      <h4 className="font-medium">Two-Factor Authentication</h4>
                      <p className="text-sm text-muted">Add an extra layer of security to your account.</p>
                    </div>
                    <button className="btn-secondary text-sm">Enable 2FA</button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div>
                      <h4 className="font-medium text-danger">Active Sessions</h4>
                      <p className="text-sm text-muted">Log out from all other active devices and sessions.</p>
                    </div>
                    <button className="btn-danger text-sm">Log Out All</button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Appearance Section */}
            {activeTab === "appearance" && (
              <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold border-b border-border pb-4">Appearance Preferences</h2>
                
                <div>
                  <h3 className="font-medium mb-4">Theme</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id === "system" ? "dark" : t.id)}
                        className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300 ${
                          theme === t.id || (t.id === "system" && false)
                            ? "border-primary bg-primary/5 shadow-[0_0_15px_var(--color-primary-light)] scale-105" 
                            : "border-border hover:border-muted hover:bg-foreground/5 hover:scale-105"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full mb-3 shadow-md ${t.color} border-2 border-border`}></div>
                        <span className="font-medium text-sm">{t.name}</span>
                        {theme === t.id && (
                          <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="font-medium mb-4">Font Size</h3>
                  <div className="flex gap-4">
                    {['Small', 'Medium', 'Large'].map((size) => {
                      const id = size.toLowerCase() as "small" | "medium" | "large";
                      return (
                        <button
                          key={size}
                          onClick={() => setFontSize(id)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            fontSize === id
                              ? "bg-primary text-white border-primary shadow-[0_0_10px_var(--color-primary-light)]" 
                              : "bg-background text-muted border-border hover:border-muted hover:text-foreground"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Notifications Section */}
            {activeTab === "notifications" && (
              <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold border-b border-border pb-4">Notification Settings</h2>
                
                <div className="space-y-3">
                  {[
                    "Job completion alerts",
                    "Session expiration alerts",
                    "Reservation reminders",
                    "Email notifications",
                    "System announcements"
                  ].map((notif, i) => (
                    <label key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-foreground/5 cursor-pointer transition-colors border border-transparent hover:border-border">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" defaultChecked={i !== 3} className="peer appearance-none w-5 h-5 border-2 border-muted rounded bg-background checked:bg-primary checked:border-primary transition-colors cursor-pointer" />
                        <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-foreground select-none">{notif}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-4 flex justify-end">
                  <button className="btn-primary">Save Preferences</button>
                </div>
              </div>
            )}

            {/* 5. About Section */}
            {activeTab === "about" && (
              <div className="space-y-6">
                <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-xl font-semibold border-b border-border pb-4">About</h2>
                  
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-3 py-2 border-b border-border/50">
                      <span className="text-muted font-medium">Application</span>
                      <span className="col-span-2 font-semibold">FPGA Remote Lab</span>
                    </div>
                    <div className="grid grid-cols-3 py-2 border-b border-border/50">
                      <span className="text-muted font-medium">Version</span>
                      <span className="col-span-2 font-mono">1.0.0</span>
                    </div>
                    <div className="grid grid-cols-3 py-2 border-b border-border/50">
                      <span className="text-muted font-medium">Frontend</span>
                      <span className="col-span-2">Next.js / React</span>
                    </div>
                    <div className="grid grid-cols-3 py-2 border-b border-border/50">
                      <span className="text-muted font-medium">Backend</span>
                      <span className="col-span-2">Node.js</span>
                    </div>
                    <div className="grid grid-cols-3 py-2 border-b border-border/50">
                      <span className="text-muted font-medium">Database</span>
                      <span className="col-span-2">MySQL</span>
                    </div>
                    <div className="grid grid-cols-3 py-2">
                      <span className="text-muted font-medium">License</span>
                      <span className="col-span-2">Academic</span>
                    </div>
                  </div>
                </div>

                {/* Optional Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                  <div className="card p-4 text-center hover:border-primary/50 transition-colors">
                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">42</div>
                    <div className="text-xs text-muted mt-1 uppercase tracking-wider">Experiments</div>
                  </div>
                  <div className="card p-4 text-center hover:border-primary/50 transition-colors">
                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">18.5</div>
                    <div className="text-xs text-muted mt-1 uppercase tracking-wider">Lab Hours</div>
                  </div>
                  <div className="card p-4 text-center hover:border-primary/50 transition-colors">
                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">12</div>
                    <div className="text-xs text-muted mt-1 uppercase tracking-wider">Reservations</div>
                  </div>
                  <div className="card p-4 text-center hover:border-primary/50 transition-colors">
                    <div className="text-lg font-bold text-foreground mt-1">Jun &apos;26</div>
                    <div className="text-xs text-muted mt-1 uppercase tracking-wider">Joined</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
