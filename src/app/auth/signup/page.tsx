"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "researcher">("student");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // No client-side domain restriction (server will handle policy)

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-bg min-h-screen flex items-center justify-center px-4">
        <div className="auth-slideshow" />
        <div className="relative z-10 w-full max-w-md">
          <div className="card p-8 md:p-10 text-center">
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-muted mb-6">
              We sent a verification link to <strong className="text-foreground">{email}</strong>. Click the
              link to activate your account.
            </p>
            <Link href="/auth/login" className="btn-primary inline-block">
              GO TO LOGIN
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-4">
      {/* Animated sliding background */}
      <div className="auth-slideshow" />
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-8 md:p-10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] relative overflow-hidden">
          {/* Logo & branding */}
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vce-logo.png"
              alt="VCE - Vardhaman College of Engineering"
              className="relative w-24 h-auto mx-auto mb-4 drop-shadow-sm mix-blend-multiply"
            />
            <h1 className="text-xl font-bold text-primary tracking-wide">
              FPGA Remote Lab
            </h1>
            <div className="w-12 h-0.5 bg-primary mx-auto mt-3 rounded-full" />
          </div>

          <h2 className="text-center text-xl font-semibold text-primary mb-6">
            Create Account
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  aria-pressed={role === "student"}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    role === "student"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-slate-900/40 dark:bg-slate-900/60 text-muted hover:border-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-lg mb-0.5">🎓</div>
                  <div className="text-sm font-semibold">Student</div>
                  <div className="text-xs opacity-70 mt-0.5">Course labs &amp; assignments</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("researcher")}
                  aria-pressed={role === "researcher"}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    role === "researcher"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-slate-900/40 dark:bg-slate-900/60 text-muted hover:border-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-lg mb-0.5">🔬</div>
                  <div className="text-sm font-semibold">Researcher</div>
                  <div className="text-xs opacity-70 mt-0.5">Extended sessions &amp; priority</div>
                </button>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-inner"
                required
              />
            </div>

            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="College Email (vardhaman.org)"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-inner"
                required
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 characters)"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-inner pr-12"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? "Creating account..." : "SIGN UP"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-blue-600 font-semibold hover:text-blue-700 hover:underline">
                Log in
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400">
              Powered by <span className="font-semibold text-blue-600">FPGA Remote Lab</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
