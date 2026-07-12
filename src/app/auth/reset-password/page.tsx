"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Token is missing or invalid");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Reset password failed");
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
      <div className="text-center py-4">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Password Reset Successful</h2>
        <p className="text-sm text-slate-500 mb-6">
          Your password has been changed. You can now log in with your new password.
        </p>
        <Link href="/auth/login" className="btn-primary inline-block px-6">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 relative z-20">
      <div>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New Password (min 8 characters)"
          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-inner"
          minLength={8}
          required
        />
      </div>

      <div>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm New Password"
          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-inner"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="show"
          checked={showPassword}
          onChange={() => setShowPassword(!showPassword)}
          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="show" className="text-xs text-slate-500 cursor-pointer">
          Show passwords
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
          <span>⚠️</span>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-3.5 text-base shadow-[0_0_20px_rgba(59,130,246,0.3)] mt-2"
      >
        {loading ? "Resetting password..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
            <h2 className="text-sm font-semibold text-slate-500 mt-2">New Password</h2>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-4 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
          </div>

          <Suspense fallback={<div className="text-center text-sm text-slate-500">Loading form...</div>}>
            <ResetPasswordForm />
          </Suspense>

          <div className="mt-8 text-center relative z-20">
            <p className="text-sm text-slate-500">
              Back to{" "}
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
