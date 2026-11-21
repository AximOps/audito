"use client";

import { FormEvent, useEffect, useState } from "react";
import { Globe, Trash2 } from "lucide-react";
import AppShell from "@/components/app-shell";
import { ROLE_OPTIONS } from "@/lib/rbac";

type Org = { id: string; name: string; status: string };
type DomainRow = { domain: string; auto_join: boolean; auto_join_role: string; allowed_providers: string[] };

const PROVIDERS = [
  { id: "email", label: "Password" },
  { id: "google", label: "Google" },
  { id: "azure", label: "Microsoft" },
];

export default function PlatformDomainsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [domain, setDomain] = useState("");
  const [role, setRole] = useState("Contributor");
  const [providers, setProviders] = useState<string[]>(["email", "google", "azure"]);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/platform/organizations", { cache: "no-store" })
      .then((r) => r.json())
      .then((result) => {
        const list: Org[] = (result.organizations || []).filter((o: Org) => o.status !== "Removed");
        setOrgs(list);
        if (list[0]) setOrgId(list[0].id);
      })
      .catch(() => setError("Unable to load organizations."));
  }, []);

  async function loadDomains(id: string) {
    if (!id) return;
    const response = await fetch(`/api/platform/organizations/${id}/domains`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load domains.");
    else setDomains(result.domains || []);
  }

  useEffect(() => {
    setDomains([]);
    loadDomains(orgId);
  }, [orgId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/platform/organizations/${orgId}/domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, autoJoin: true, autoJoinRole: role, allowedProviders: providers, verified }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error || "Unable to add domain.");
    setMessage(`${result.domain.domain} assigned.`);
    setDomain("");
    setVerified(false);
    loadDomains(orgId);
  }

  async function remove(value: string) {
    setError("");
    const response = await fetch(`/api/platform/organizations/${orgId}/domains?domain=${encodeURIComponent(value)}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Unable to remove domain.");
    setMessage(`${value} removed. Existing members keep their access.`);
    loadDomains(orgId);
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Globe size={20} /> Email Domains</h1>
          <p className="text-sm text-gray-500 mt-1">
            Assign a verified company domain to one organization. New users from that domain who sign in with an
            allowed method join with the default role. A domain can belong to one organization only.
          </p>
        </div>

        {message && <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
        {error && <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}

        <label className="block">
          <span className="text-sm font-medium">Organization</span>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1.5 w-full border rounded-lg px-3 py-2 text-sm bg-white">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.status !== "Active" ? ` (${o.status})` : ""}</option>)}
          </select>
        </label>

        <div className="bg-white border rounded-xl divide-y">
          {domains.length === 0 ? (
            <div className="p-5 text-sm text-gray-500">No domains assigned to this organization.</div>
          ) : (
            domains.map((d) => (
              <div key={d.domain} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">@{d.domain}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {d.auto_join ? `Auto-join as ${d.auto_join_role}` : "Auto-join off"} · {d.allowed_providers.join(", ")}
                  </div>
                </div>
                <button onClick={() => remove(d.domain)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" aria-label={`Remove ${d.domain}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={add} className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">Assign a domain</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <input required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="border rounded-lg px-3 py-2 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            {PROVIDERS.map((p) => (
              <label key={p.id} className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={providers.includes(p.id)}
                  onChange={(e) => setProviders((list) => (e.target.checked ? [...list, p.id] : list.filter((x) => x !== p.id)))}
                />
                {p.label}
              </label>
            ))}
          </div>
          <label className="text-xs text-gray-600 flex items-start gap-2">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5" />
            I have verified that this organization controls the domain (for example with a DNS TXT record). Anyone
            with an address on it will be able to join.
          </label>
          <button disabled={saving || !orgId || !verified} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Assign domain"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
