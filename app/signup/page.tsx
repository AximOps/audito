"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AuthLayout, { Notice } from "@/components/auth/auth-layout";
import OAuthButtons from "@/components/auth/oauth-buttons";
import { Turnstile, turnstileRequired, type TurnstileHandle } from "@/components/auth/turnstile";
import { authMethods } from "@/lib/auth-config";
import { PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/password-policy";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  if (!authMethods.signup) {
    return (
      <AuthLayout>
        <h2 className="text-2xl font-semibold">Sign up is disabled</h2>
        <p className="text-sm text-gray-500 mt-2">
          AuditOps accounts are created by invitation. Ask your organization administrator.
        </p>
        <Link href="/login" className="inline-block mt-6 text-sm text-slate-700 hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem = validatePassword(password, email);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("Passwords do not match.");
    if (turnstileRequired && !captchaToken) return setError("Please complete the security check.");

    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, captchaToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create the account.");
      setDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the account.");
      captcha.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  const input = "mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200";

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold">Create your account</h2>
      <p className="text-sm text-gray-500 mt-1">
        Your organization administrator assigns your role after sign-up.
      </p>

      {done ? (
        <div className="mt-7 space-y-4">
          <Notice tone="success">{done}</Notice>
          <Link href="/login" className="block text-center text-sm text-slate-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {error && <Notice tone="error">{error}</Notice>}

          <OAuthButtons
            captchaToken={captchaToken}
            captchaRequired={turnstileRequired}
            onError={setError}
            onAttempt={() => captcha.current?.reset()}
          />

          {(authMethods.google || authMethods.azure) && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="h-px bg-gray-200 flex-1" /> or use email <div className="h-px bg-gray-200 flex-1" />
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Full name</span>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Work email</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} />
              <span className="text-xs text-gray-400 mt-1 block">
                {PASSWORD_MIN_LENGTH}+ characters, with three of: lowercase, uppercase, number, symbol.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Confirm password</span>
              <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} autoComplete="new-password" />
            </label>

            <Turnstile ref={captcha} action="signup" onToken={setCaptchaToken} onError={setError} />

            <button
              disabled={loading || (turnstileRequired && !captchaToken)}
              className="w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-slate-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
