"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to process request");
        return;
      }

      setMessage(data.message || "A reset link has been sent to your email.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-4 relative">
      <div className="auth-slideshow" />
      <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] bg-blue-500/20 rounded-full blur-[100px] animate-glow pointer-events-none mix-blend-screen"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] animate-glow pointer-events-none mix-blend-screen" style={{ animationDelay: '3s' }}></div>

      <div className="relative z-10 w-full max-w-md animate-float">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-8 md:p-10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>

          <div className="text-center mb-8 relative z-20">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-wide">
              FPGA Remote Lab
            </h1>
            <h2 className="text-sm font-semibold text-slate-500 mt-2">Reset Password</h2>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-4 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-6 flex items-center gap-3 backdrop-blur-md">
              <span className="text-xl">⚠️</span>
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-6 flex items-center gap-3 backdrop-blur-md">
              <span className="text-xl">📧</span>
              {message}
            </div>
          )}

          {!message && (
            <form onSubmit={handleSubmit} className="space-y-5 relative z-20">
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter your college email address and we will send you a secure link to reset your password.
              </p>
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="College Email"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-inner"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 text-base shadow-[0_0_20px_rgba(59,130,246,0.3)] mt-2"
              >
                {loading ? "Sending link..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="mt-8 text-center relative z-20">
            <p className="text-sm text-slate-500">
              Remember your password?{" "}
              <Link href="/auth/login" className="text-blue-600 font-semibold hover:text-blue-700 hover:underline transition-colors">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
