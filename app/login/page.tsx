"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/auth";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.replace(params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[#f7f8fa]">
      <section className="hidden lg:flex bg-slate-950 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck size={23} />
          AuditOps
        </div>

        <div className="max-w-lg">
          <div className="text-sm text-slate-400 mb-4">
            COMPLIANCE OPERATIONS PLATFORM
          </div>

          <h1 className="text-5xl font-semibold tracking-tight leading-tight">
            Always audit ready.
          </h1>

          <p className="text-slate-300 mt-5 text-lg leading-7">
            Centralize compliance activities, evidence, vulnerabilities,
            access reviews and audit work in one workspace.
          </p>
        </div>

        <div className="text-xs text-slate-500">
          AuditOps MVP
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 text-xl font-bold mb-10">
            <ShieldCheck size={23} />
            AuditOps
          </div>

          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">
              Sign in
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Access your compliance workspace.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div className="block">
				  <label htmlFor="email" className="text-sm font-medium">
					Email
				  </label>

				  <input
					id="email"
					required
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
					placeholder="you@company.com"
					autoComplete="email"
				  />
				</div>

              <div className="block">
				  <label htmlFor="password" className="text-sm font-medium">
					Password
				  </label>

				  <input
					id="password"
					required
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="mt-1.5 w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
					placeholder="••••••••"
					autoComplete="current-password"
				  />
				</div>

              {message && (
                <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm p-3">
                  {message}
                </div>
              )}

              <button
                disabled={loading}
                className="w-full rounded-lg bg-slate-950 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-6">
              Accounts are provisioned by your AuditOps organization
              administrator.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
          <div className="text-sm text-gray-500">
            Loading…
          </div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}