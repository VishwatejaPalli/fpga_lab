"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMenuOpen(false);
    router.push("/auth/login");
  }

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/editor", label: "Cloud IDE" },
    { href: "/program", label: "Program" },
    { href: "/history", label: "History" },
    { href: "/status", label: "Status" },
    { href: "/help", label: "Help" },
  ];

  if (user?.role === "admin") {
    navLinks.push({ href: "/admin", label: "Admin" });
    navLinks.push({ href: "/admin/openfpgaloader", label: "openFPGALoader" });
  }

  if (user?.role === "researcher" || user?.role === "admin") {
    navLinks.splice(2, 0, { href: "/researcher", label: "Research" });
  }

  function roleBadge(role: string) {
    if (role === "admin")
      return (
        <span className="ml-1.5 text-[10px] font-bold tracking-widest uppercase bg-danger/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.2)]">
          Admin
        </span>
      );
    if (role === "researcher")
      return (
        <span className="ml-1.5 text-[10px] font-bold tracking-widest uppercase bg-warning/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.2)]">
          Researcher
        </span>
      );
    return (
      <span className="ml-1.5 text-[10px] font-bold tracking-widest uppercase bg-success/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]">
        Student
      </span>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background/80 dark:bg-[#0b0f19]/80 backdrop-blur-xl border-b border-border/50 px-4 sm:px-6 py-3 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Left: Logo + desktop links */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-md group-hover:bg-primary/40 transition-all duration-300"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vce-logo.png" alt="VCE" className="relative w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-lg" />
            </div>
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-sm sm:text-base tracking-wide">FPGA Lab</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 overflow-hidden group ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "text-primary bg-foreground/5"
                    : "text-muted hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <span className="relative z-10">{link.label}</span>
                {(pathname === link.href || pathname.startsWith(link.href + "/")) && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-t-md shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: User info + hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Settings Button */}
          <Link
            href="/settings"
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
              pathname === "/settings" || pathname.startsWith("/settings/")
                ? "text-blue-400 bg-blue-500/15 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                : "text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
            }`}
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
            </svg>
          </Link>

          {/* Desktop user info */}
          {user && (
            <Link href="/profile" className="hidden sm:flex items-center gap-3 hover:bg-white/5 p-1.5 rounded-lg transition-all duration-300 border border-transparent hover:border-white/10 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-[0_0_10px_rgba(139,92,246,0.4)] group-hover:scale-105 transition-transform">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-right">
                <span className="text-sm text-foreground font-medium block flex items-center justify-end">
                  {user.name}
                  {roleBadge(user.role)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                  ID: {user.id.slice(0, 8)}
                </span>
              </div>
            </Link>
          )}

          {/* Desktop logout */}
          <button
            onClick={handleLogout}
            className="hidden sm:block text-sm text-slate-400 hover:text-red-400 font-medium transition-colors ml-2"
          >
            Logout
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-foreground/10 text-foreground transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden absolute w-full bg-background/95 dark:bg-[#0b0f19]/95 backdrop-blur-xl border-b border-border/50 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-40">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted hover:bg-foreground/5 border border-transparent"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile user section */}
          {user && (
            <div className="px-4 py-3 border-t border-white/10">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors touch-manipulation mb-2"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-base shadow-[0_0_10px_rgba(139,92,246,0.4)]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm text-foreground font-medium flex items-center">
                    {user.name} {roleBadge(user.role)}
                  </span>
                  <span className="text-xs text-slate-500">{user.email}</span>
                </div>
              </Link>
              
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all touch-manipulation ${
                  pathname === "/settings" || pathname.startsWith("/settings/")
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Settings</span>
              </Link>
            </div>
          )}

          <div className="px-4 pb-4">
            <button
              onClick={handleLogout}
              className="w-full py-3 text-sm text-red-400 font-medium rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors touch-manipulation shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
