"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AuthLayout, { Notice } from "@/components/auth/auth-layout";
import OAuthButtons from "@/components/auth/oauth-buttons";
import { Turnstile, turnstileRequired, type TurnstileHandle } from "@/components/auth/turnstile";
import { AUTH_ERROR_MESSAGES, authMethods } from "@/lib/auth-config";
import { setActiveOrganizationId } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  const hasOAuth = authMethods.google || authMethods.azure;

  useEffect(() => {
    // Read query params without useSearchParams (keeps /login static).
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "success") {
      setNotice("Your password was updated. Please sign in with your new password.");
    }
    const code = params.get("error");
    if (code) setError(AUTH_ERROR_MESSAGES[code] || "Sign-in failed. Please try again.");
    setNext(params.get("next"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (turnstileRequired && !captchaToken) {
      setError("Please complete the security check.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken, next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign-in failed.");

      if (result.organizationId) setActiveOrganizationId(result.organizationId);
      // Full navigation so middleware and server components see the new cookies.
      window.location.assign(result.redirectTo || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setPassword("");
      captcha.current?.reset();
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold">Sign in</h2>
      <p className="text-sm text-gray-500 mt-1">Access your compliance workspace.</p>

      <div className="mt-7 space-y-4">
        {notice && <Notice tone="success">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        {hasOAuth && (
          <OAuthButtons
            captchaToken={captchaToken}
            captchaRequired={turnstileRequired}
            next={next}
            onError={setError}
            onAttempt={() => captcha.current?.reset()}
          />
        )}

        {hasOAuth && authMethods.email && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px bg-gray-200 flex-1" /> or sign in with email <div className="h-px bg-gray-200 flex-1" />
          </div>
        )}

        {authMethods.email && (
          <form onSubmit={submit} className="space-y-4">
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

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Password</span>
                <Link href="/forgot-password" className="text-xs text-slate-600 hover:text-slate-950 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            <Turnstile ref={captcha} action="login" onToken={setCaptchaToken} onError={setError} />

            <button
              disabled={loading || (turnstileRequired && !captchaToken)}
              className="w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {!authMethods.email && <Turnstile ref={captcha} action="login" onToken={setCaptchaToken} onError={setError} />}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        {authMethods.signup ? (
          <>
            New to AuditOps?{" "}
            <Link href="/signup" className="text-slate-700 hover:underline">
              Create an account
            </Link>
            . Access is granted by your organization administrator.
          </>
        ) : (
          "Accounts are provisioned by your AuditOps organization administrator."
        )}
      </p>
    </AuthLayout>
  );
}
