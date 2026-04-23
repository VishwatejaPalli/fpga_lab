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

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  }

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/program", label: "Program" },
    { href: "/history", label: "History" },
    { href: "/status", label: "Status" },
    { href: "/help", label: "Help" },
  ];

  if (user?.role === "admin") {
    navLinks.push({ href: "/admin", label: "Admin" });
  }

  if (user?.role === "researcher" || user?.role === "admin") {
    navLinks.splice(2, 0, { href: "/researcher", label: "Research" });
  }

  function roleBadge(role: string) {
    if (role === "admin")
      return (
        <span className="ml-1.5 text-xs bg-primary text-white px-2 py-0.5 rounded-full">
          Admin
        </span>
      );
    if (role === "researcher")
      return (
        <span className="ml-1.5 text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
          Researcher
        </span>
      );
    return (
      <span className="ml-1.5 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
        Student
      </span>
    );
  }

  return (
    <>
      <nav className="bg-white border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm relative z-50">
        {/* Left: Logo + desktop links */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <img src="/vce-logo.png" alt="VCE" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
            <span className="font-bold text-primary text-sm sm:text-base">FPGA Lab</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-primary/10 text-primary"
                    : "text-gray-500 hover:text-primary hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: User info + hamburger */}
        <div className="flex items-center gap-3">
          {/* Desktop user info */}
          {user && (
            <Link href="/profile" className="hidden sm:flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-right">
                <span className="text-sm text-gray-800 font-medium block">
                  {user.name}
                  {roleBadge(user.role)}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  ID: {user.id.slice(0, 8)}
                </span>
              </div>
            </Link>
          )}

          {/* Desktop logout */}
          <button
            onClick={handleLogout}
            className="hidden sm:block text-sm text-gray-400 hover:text-danger font-medium transition-colors"
          >
            Logout
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg active:bg-gray-100 transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-border shadow-lg z-40 relative">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors active:bg-gray-100 touch-manipulation ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile user section */}
          {user && (
            <div className="px-4 py-3 border-t border-border">
              <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-lg active:bg-gray-100 touch-manipulation">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm text-gray-800 font-medium block">
                    {user.name} {roleBadge(user.role)}
                  </span>
                  <span className="text-xs text-gray-400">{user.email}</span>
                </div>
              </Link>
            </div>
          )}

          <div className="px-4 pb-4">
            <button
              onClick={handleLogout}
              className="w-full py-3 text-sm text-danger font-medium rounded-lg border border-danger/20 active:bg-danger/5 transition-colors touch-manipulation"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
