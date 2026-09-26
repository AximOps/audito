"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/reset-password`;

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage(
        "If an account exists for this email address, a password reset link has been sent."
      );
    }

    setLoading(false);
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
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
            >
              <ArrowLeft size={15} /> Back to sign in
            </Link>

            <h2 className="text-2xl font-semibold mt-6">Reset your password</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter your email and we&apos;ll send you a secure password reset
              link.
            </p>

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

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm p-3">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm p-3 flex gap-2">
                  <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              <button
                disabled={loading}
                className="w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-6">
              For security, the page does not reveal whether an email address
              has an AuditOps account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
