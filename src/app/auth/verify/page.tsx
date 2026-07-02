"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const hasToken = Boolean(token);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    hasToken ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    hasToken ? "" : "No verification token provided"
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch(`/api/auth/verify?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
          setMessage(data.message);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="card">
          {status === "loading" && (
            <>
              <div className="text-5xl mb-4 animate-pulse">⏳</div>
              <h1 className="text-2xl font-bold mb-2">Verifying...</h1>
              <p className="text-muted">Please wait while we verify your email.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-2xl font-bold mb-2">Email Verified!</h1>
              <p className="text-muted mb-6">{message}</p>
              <Link href="/auth/login" className="btn-primary inline-block">
                Log in now
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
              <p className="text-muted mb-6">{message}</p>
              <Link href="/auth/signup" className="btn-primary inline-block">
                Try again
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
