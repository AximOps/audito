"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import AuthLayout, { Notice } from "@/components/auth/auth-layout";
import { Turnstile, turnstileRequired, type TurnstileHandle } from "@/components/auth/turnstile";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (turnstileRequired && !captchaToken) return setError("Please complete the security check.");
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send the reset link.");
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the reset link.");
      captcha.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={15} /> Back to sign in
      </Link>

      <h2 className="text-2xl font-semibold mt-6">Reset your password</h2>
      <p className="text-sm text-gray-500 mt-1">
        Enter your email and we&apos;ll send you a secure password reset link. Open it in this browser.
      </p>

      {message ? (
        <div className="mt-7 flex gap-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 text-sm">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>

          <Turnstile ref={captcha} action="forgot_password" onToken={setCaptchaToken} onError={setError} />

          {error && <Notice tone="error">{error}</Notice>}

          <button
            disabled={loading || (turnstileRequired && !captchaToken)}
            className="w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Signed in with Google or Microsoft? Reset your password with that provider instead.
      </p>
    </AuthLayout>
  );
}
