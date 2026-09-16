"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  CompassIcon,
  ZapIcon,
  SaveIcon,
  FlaskIcon,
  ScrollTextIcon,
  RadioIcon,
  BookOpenIcon,
  ShieldIcon,
  SettingsIcon,
} from "@/components/icons";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ActiveSession {
  id: string;
  boardId: string;
  expiresAt: string;
  status: string;
  boardName?: string;
  boardType?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch current user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Poll active session & countdown
  useEffect(() => {
    if (!user) return;

    async function checkSession() {
      try {
        const [sessRes, boardsRes] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/boards"),
        ]);
        const sessData = await sessRes.json();
        const boardsData = await boardsRes.json();

        if (sessData.session) {
          const matchedBoard = (boardsData.boards || []).find(
            (b: { id: string }) => b.id === sessData.session.boardId
          );
          setActiveSession({
            ...sessData.session,
            boardName: matchedBoard?.name || "FPGA Board",
            boardType: matchedBoard?.boardType || "FPGA",
          });
        } else {
          setActiveSession(null);
        }
      } catch {
        // non-fatal
      }
    }

    checkSession();
    const interval = setInterval(checkSession, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // Session timer ticker
  useEffect(() => {
    if (!activeSession?.expiresAt) {
      setTimeRemaining("");
      return;
    }

    function updateCountdown() {
      const now = Date.now();
      const expires = new Date(activeSession!.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${mins}m ${secs < 10 ? "0" : ""}${secs}s`);
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMenuOpen(false);
    router.push("/auth/login");
  }

  // Core navigation items
  const primaryLinks: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: "/dashboard", label: "Dashboard", icon: <CompassIcon className="w-3.5 h-3.5" /> },
    { href: "/editor", label: "Cloud IDE", icon: <ZapIcon className="w-3.5 h-3.5" /> },
    { href: "/program", label: "Program", icon: <SaveIcon className="w-3.5 h-3.5" /> },
  ];

  // Secondary tools items
  const secondaryLinks: { href: string; label: string; icon: React.ReactNode }[] = [
    ...(user?.role === "researcher" || user?.role === "admin"
      ? [{ href: "/researcher", label: "Research Studio", icon: <FlaskIcon className="w-3.5 h-3.5" /> }]
      : []),
    { href: "/history", label: "Job History", icon: <ScrollTextIcon className="w-3.5 h-3.5" /> },
    { href: "/status", label: "System Status", icon: <RadioIcon className="w-3.5 h-3.5" /> },
    { href: "/help", label: "Documentation", icon: <BookOpenIcon className="w-3.5 h-3.5" /> },
  ];

  const isSoC = activeSession?.boardType?.toLowerCase().includes("pynq");
  const monitorHref = activeSession
    ? isSoC
      ? `/pynq/${activeSession.boardId}`
      : `/monitor/${activeSession.boardId}`
    : "/dashboard";

  function roleBadge(role: string) {
    if (role === "admin")
      return (
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded shadow-sm">
          Admin
        </span>
      );
    if (role === "researcher")
      return (
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded shadow-sm">
          Researcher
        </span>
      );
    return (
      <span className="text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded shadow-sm">
        Student
      </span>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-[#0a0e17]/85 backdrop-blur-xl border-b border-border dark:border-white/[0.08] px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm dark:shadow-lg dark:shadow-black/40 transition-colors">
        {/* Left: Brand & Primary Links */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-md group-hover:bg-blue-500/40 transition-all duration-300" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vce-logo.png" alt="VCE" className="relative w-7 h-7 object-contain drop-shadow-md" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400">
                FPGA Lab
              </span>
              <span className="text-[9px] font-mono text-muted tracking-wider uppercase">Cloud Hardware</span>
            </div>
          </Link>

          {/* Desktop Primary Nav */}
          <div className="hidden md:flex items-center gap-1">
            {primaryLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 border border-blue-500/30 shadow-sm dark:shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.06] border border-transparent"
                  }`}
                >
                  <span className="text-xs">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Tools Dropdown */}
            <div ref={toolsRef} className="relative">
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                  secondaryLinks.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"))
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-500/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.06] border border-transparent"
                }`}
              >
                <span>Tools & Docs</span>
                <span className={`text-[10px] transition-transform ${toolsOpen ? "rotate-180" : ""}`}>▾</span>
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-[#0c121e] border border-border dark:border-slate-700/80 rounded-xl shadow-xl dark:shadow-2xl p-1.5 z-50 backdrop-blur-xl divide-y divide-border dark:divide-slate-800">
                  <div className="space-y-0.5 pb-1">
                    {secondaryLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setToolsOpen(false)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          pathname === link.href
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 font-semibold"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                        }`}
                      >
                        <span className="text-sm">{link.icon}</span>
                        <span>{link.label}</span>
                      </Link>
                    ))}
                  </div>

                  {user?.role === "admin" && (
                    <div className="pt-1 space-y-0.5">
                      <Link
                        href="/admin"
                        onClick={() => setToolsOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <ShieldIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>Admin Console</span>
                      </Link>
                      <Link
                        href="/admin/openfpgaloader"
                        onClick={() => setToolsOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <SettingsIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>openFPGALoader</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right: Persistent Active Session Cockpit Pill */}
        {activeSession && (
          <div className="hidden lg:flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-in fade-in">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
            <span className="text-xs font-semibold text-amber-200">
              Active Session: <strong className="text-white">{activeSession.boardName}</strong>
            </span>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/20">
              {timeRemaining || "Active"}
            </span>
            <Link
              href={monitorHref}
              className="text-[11px] font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-500 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 shadow-sm"
            >
              <span>Lab</span>
              <span>→</span>
            </Link>
          </div>
        )}

        {/* Right: Controls & User Profile */}
        <div className="flex items-center gap-2">
          {/* Quick Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-700">
                <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Settings Button */}
          <Link
            href="/settings"
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
              pathname === "/settings"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]"
            }`}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
            </svg>
          </Link>

          {/* User Profile Pill */}
          {user ? (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border dark:border-white/10">
              <Link
                href="/profile"
                className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] p-1 pr-2 rounded-lg transition-colors group"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs text-foreground font-semibold flex items-center gap-1.5 leading-none">
                    {user.name}
                    {roleBadge(user.role)}
                  </span>
                  <span className="text-[9px] text-muted font-mono mt-0.5">
                    {user.email.split("@")[0]}
                  </span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 text-xs px-2 py-1 rounded transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Slide-down Drawer */}
      {menuOpen && (
        <div className="md:hidden absolute w-full bg-white/95 dark:bg-[#0a0e17]/95 backdrop-blur-2xl border-b border-border dark:border-white/[0.08] shadow-2xl z-40 p-4 space-y-3">
          {/* Active Session banner in mobile menu */}
          {activeSession && (
            <div className="bg-amber-500/15 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-amber-500 dark:text-amber-400 font-bold">Active Session</div>
                <div className="text-xs font-semibold text-foreground">{activeSession.boardName}</div>
                <div className="text-xs font-mono text-amber-600 dark:text-amber-300">{timeRemaining}</div>
              </div>
              <Link
                href={monitorHref}
                onClick={() => setMenuOpen(false)}
                className="btn-primary text-xs py-1.5 px-3"
              >
                Go to Lab
              </Link>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted font-mono font-bold px-2 py-1">Main Lab</div>
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === link.href
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/30"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className="space-y-1 pt-2 border-t border-border dark:border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-muted font-mono font-bold px-2 py-1">Tools & Research</div>
            {secondaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === link.href
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/30"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-border dark:border-white/[0.06] flex items-center justify-between">
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary"
                >
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[11px] font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <span>{user.name}</span>
                  {roleBadge(user.role)}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setMenuOpen(false)}
                className="btn-primary text-xs py-1.5 px-3 w-full text-center"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
