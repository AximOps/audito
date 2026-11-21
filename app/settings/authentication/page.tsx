"use client";

import { useEffect, useState } from "react";
import { Check, Globe, KeyRound, Minus, ShieldCheck } from "lucide-react";
import AppShell from "@/components/app-shell";
import { ACCESS_MATRIX, ROLE_OPTIONS, type Action, type Permission } from "@/lib/rbac";
import { turnstileSiteKey } from "@/lib/auth-config";

type DomainRow = {
  domain: string;
  auto_join: boolean;
  auto_join_role: string;
  allowed_providers: string[];
};

const PROVIDERS = [
  { id: "email", label: "Password" },
  { id: "google", label: "Google" },
  { id: "azure", label: "Microsoft" },
];

const MATRIX_ROWS: { key: Permission; label: string }[] = [
  { key: "activities", label: "Tasks" },
  { key: "evidence", label: "Evidence" },
  { key: "policies", label: "Policies" },
  { key: "vulnerabilities", label: "Vulnerabilities" },
  { key: "assets", label: "Assets" },
  { key: "accessReviews", label: "Access Reviews" },
  { key: "findings", label: "Findings" },
  { key: "exceptions", label: "Exceptions" },
  { key: "vendors", label: "Vendors" },
  { key: "taskTypes", label: "Task settings" },
  { key: "users", label: "Users & Roles" },
  { key: "auditLog", label: "Audit log" },
];

function level(permission: Permission, role: string): string {
  const has = (a: Action) => (ACCESS_MATRIX[permission][a] as readonly string[]).includes(role);
  if (has("delete")) return "Full";
  if (has("create") || has("update")) return "Edit";
  if (has("read")) return "View";
  return "";
}

export default function AuthenticationSettingsPage() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [methods, setMethods] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/organizations/domains", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load settings.");
    else {
      setDomains(result.domains || []);
      setMethods(result.methods || {});
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function update(domain: string, changes: Record<string, unknown>) {
    setError("");
    setMessage("");
    const response = await fetch("/api/organizations/domains", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, ...changes }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to save.");
    else {
      setMessage(`Saved settings for ${domain}.`);
      setDomains((rows) => rows.map((row) => (row.domain === domain ? { ...row, ...result.domain } : row)));
    }
  }

  return (
    <AppShell requiredPermission="authSettings">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign-in & Access</h1>
          <p className="text-sm text-gray-500 mt-1">
            How people sign in to this organization and what each role can do.
          </p>
        </div>

        {message && <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
        {error && <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}

        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2"><KeyRound size={16} /> Sign-in methods</h2>
          <p className="text-xs text-gray-500 mt-1">Enabled for the whole platform by the Platform Admin.</p>
          <div className="grid sm:grid-cols-5 gap-3 mt-4">
            {[...PROVIDERS, { id: "signup", label: "Self sign-up" }].map((p) => (
              <div key={p.id} className="border rounded-lg px-3 py-2.5 text-sm flex items-center justify-between">
                {p.label}
                {methods[p.id] ? <Check size={16} className="text-emerald-600" /> : <Minus size={16} className="text-gray-300" />}
              </div>
            ))}
            <div className="border rounded-lg px-3 py-2.5 text-sm flex items-center justify-between">
              Turnstile
              {turnstileSiteKey ? <Check size={16} className="text-emerald-600" /> : <Minus size={16} className="text-gray-300" />}
            </div>
          </div>
        </section>

        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2"><Globe size={16} /> Verified email domains</h2>
          <p className="text-xs text-gray-500 mt-1">
            People with a verified address on these domains join this organization on first sign-in with the
            default role. A Platform Admin adds domains after confirming ownership.
          </p>
          {loading ? (
            <div className="text-sm text-gray-500 mt-4">Loading…</div>
          ) : domains.length === 0 ? (
            <div className="text-sm text-gray-500 mt-4">
              No domains assigned. Users join only by invitation from Users &amp; Roles.
            </div>
          ) : (
            <div className="mt-4 divide-y border rounded-lg">
              {domains.map((d) => (
                <div key={d.domain} className="p-4 grid md:grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                  <div className="font-medium text-sm">@{d.domain}</div>
                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={d.auto_join} onChange={(e) => update(d.domain, { autoJoin: e.target.checked })} />
                    Auto-join
                  </label>
                  <select value={d.auto_join_role} onChange={(e) => update(d.domain, { autoJoinRole: e.target.value })} className="border rounded-lg px-2.5 py-2 text-sm bg-white">
                    {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <div className="flex gap-3">
                    {PROVIDERS.map((p) => (
                      <label key={p.id} className="text-xs flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={d.allowed_providers.includes(p.id)}
                          onChange={(e) =>
                            update(d.domain, {
                              allowedProviders: e.target.checked
                                ? [...d.allowed_providers, p.id]
                                : d.allowed_providers.filter((x) => x !== p.id),
                            })
                          }
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border rounded-xl overflow-x-auto">
          <div className="p-5 border-b">
            <h2 className="font-semibold flex items-center gap-2"><ShieldCheck size={16} /> Role permissions</h2>
            <p className="text-xs text-gray-500 mt-1">View = read only · Edit = create and update · Full = edit and delete. Enforced in the database.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                <th className="text-left px-5 py-3 font-semibold">Module</th>
                {ROLE_OPTIONS.map((r) => <th key={r} className="px-3 py-3 font-semibold text-center">{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {MATRIX_ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="px-5 py-2.5 font-medium">{row.label}</td>
                  {ROLE_OPTIONS.map((r) => {
                    const value = level(row.key, r);
                    return (
                      <td key={r} className="px-3 py-2.5 text-center">
                        {value ? (
                          <span className={`text-xs rounded-full px-2 py-0.5 ${value === "Full" ? "bg-slate-900 text-white" : value === "Edit" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{value}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
