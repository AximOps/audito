"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/auth";

type RecoveryState = "loading" | "ready" | "error" | "success";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<RecoveryState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      const supabase = createClient();

      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : "";

        const hashParams = new URLSearchParams(hash);
        const hashError = hashParams.get("error_description");
        const hashErrorCode = hashParams.get("error_code");

        if (hashError || hashErrorCode) {
          if (!cancelled) {
            setError(
              hashError ||
                "This password reset link is invalid or has expired. Please request a new one."
            );
            setState("error");
          }
          return;
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            if (!cancelled) {
              setError(sessionError.message);
              setState("error");
            }
            return;
          }

          if (!cancelled) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
            setState("ready");
          }
          return;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          if (!cancelled) {
            setError(
              "This password reset link is invalid or has expired. Please request a new one."
            );
            setState("error");
          }
          return;
        }

        if (!cancelled) {
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setError(
            "We could not establish the password reset session. Please request a new reset link."
          );
          setState("error");
        }
      }
    }

    establishRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();

    setMessage("Your password has been updated successfully.");
    setState("success");
    setSaving(false);
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[#f7f8fa]">
      <section className="hidden lg:flex bg-slate-950 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck size={23} /> AuditOps
        </div>
        <div className="max-w-lg">
          <div className="text-sm text-slate-400 mb-4">
            COMPLIANCE OPERATIONS PLATFORM
          </div>
          <h1 className="text-5xl font-semibold tracking-tight leading-tight">
            Always audit ready.
          </h1>
          <p className="text-slate-300 mt-5 text-lg leading-7">
            Centralize compliance activities, evidence, vulnerabilities, access
            reviews and audit work in one workspace.
          </p>
        </div>
        <div className="text-xs text-slate-500">AuditOps MVP</div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 text-xl font-bold mb-10">
            <ShieldCheck size={23} /> AuditOps
          </div>

          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            {state === "loading" && (
              <div className="py-8 text-center">
                <Loader2
                  size={24}
                  className="animate-spin mx-auto text-gray-500"
                />
                <p className="text-sm text-gray-500 mt-3">
                  Verifying your password reset link…
                </p>
              </div>
            )}

            {state === "ready" && (
              <>
                <h2 className="text-2xl font-semibold">Set a new password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a new password for your AuditOps account.
                </p>

                <form onSubmit={submit} className="mt-7 space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium">New password</span>
                    <input
                      required
                      minLength={8}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
                      autoComplete="new-password"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">
                      Confirm password
                    </span>
                    <input
                      required
                      minLength={8}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
                      autoComplete="new-password"
                    />
                  </label>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm p-3">
                      {error}
                    </div>
                  )}

                  <button
                    disabled={saving}
                    className="w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {saving ? "Updating password…" : "Update password"}
                  </button>
                </form>
              </>
            )}

            {state === "success" && (
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 grid place-items-center">
                  <CheckCircle2 size={25} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-semibold mt-5">
                  Password updated
                </h2>
                <p className="text-sm text-gray-500 mt-2">{message}</p>
                <button
                  type="button"
                  onClick={() => router.replace("/login?reset=success")}
                  className="mt-6 w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium"
                >
                  Continue to sign in
                </button>
              </div>
            )}

            {state === "error" && (
              <div className="text-center">
                <h2 className="text-2xl font-semibold">
                  Reset link unavailable
                </h2>
                <p className="text-sm text-red-600 mt-3">{error}</p>
                <button
                  type="button"
                  onClick={() => router.replace("/forgot-password")}
                  className="mt-6 w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium"
                >
                  Request a new reset link
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
