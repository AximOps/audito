"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

type Asset = {
  id: string;
  name: string;
  asset_type: string;
  hostname: string | null;
  ip_address: string | null;
  environment: string | null;
  criticality: string | null;
  status: string | null;
  description: string | null;
};

type FormState = Omit<Asset, "id">;
const EMPTY: FormState = { name: "", asset_type: "", hostname: "", ip_address: "", environment: "", criticality: "Medium", status: "Active", description: "" };

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [usage, setUsage] = useState<{ current: number; limit: number | null; remaining: number | null; plan: string } | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [assetsResponse, usageResponse] = await Promise.all([
      fetch(`/api/assets${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      fetch("/api/assets/subscription"),
    ]);
    const assetBody = await assetsResponse.json();
    const usageBody = await usageResponse.json();
    if (!assetsResponse.ok) throw new Error(assetBody.error || "Unable to load assets.");
    if (!usageResponse.ok) throw new Error(usageBody.error || "Unable to load asset usage.");
    setAssets(assetBody.assets || []);
    setUsage(usageBody);
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, [search]);

  const canAdd = usage?.limit === null || (usage?.remaining ?? 0) > 0;
  const title = useMemo(() => editing ? "Edit Asset" : "Add Asset", [editing]);
  const fields: Array<[keyof FormState, string, boolean]> = [["name", "Name", true], ["asset_type", "Asset Type", true], ["hostname", "Hostname", false], ["ip_address", "IP Address", false], ["environment", "Environment", false]];

  function openCreate() {
    setEditing(null); setForm(EMPTY); setError(""); setOpen(true);
  }
  function openEdit(asset: Asset) {
    setEditing(asset);
    setForm({ name: asset.name, asset_type: asset.asset_type, hostname: asset.hostname || "", ip_address: asset.ip_address || "", environment: asset.environment || "", criticality: asset.criticality || "Medium", status: asset.status || "Active", description: asset.description || "" });
    setError(""); setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(editing ? `/api/assets/${editing.id}` : "/api/assets", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code === "PLAN_LIMIT_REACHED" ? `Asset limit reached: ${body.current}/${body.limit} on ${body.plan}.` : body.error || "Unable to save asset.");
      setOpen(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save asset."); }
    finally { setBusy(false); }
  }

  async function retire(asset: Asset) {
    if (!window.confirm(`Retire ${asset.name}? Retired assets no longer consume subscription capacity.`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to retire asset.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to retire asset."); }
    finally { setBusy(false); }
  }

  return <AppShell requiredPermission="assets">
    <main className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div><a href="/dashboard" className="text-sm text-gray-500">← Dashboard</a><h1 className="text-2xl font-semibold mt-5">Assets</h1><p className="text-sm text-gray-500 mt-1">Inventory servers, applications, databases, endpoints and cloud resources.</p></div>
        <button onClick={openCreate} disabled={!canAdd} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Plus size={16}/> Add Asset</button>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets" className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"/></div>
        <div className="text-sm text-gray-600 whitespace-nowrap">{usage ? <><strong>{usage.current}</strong> / {usage.limit === null ? "Unlimited" : usage.limit} assets · {usage.plan}</> : "Loading usage…"}</div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {usage && usage.limit !== null && usage.remaining === 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Asset limit reached for the <strong>{usage.plan}</strong> plan. Retire an asset or change the organization subscription to add more.</div>}

      <div className="mt-5 overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3 text-left">Asset</th><th className="px-5 py-3 text-left">Type</th><th className="px-5 py-3 text-left">Environment</th><th className="px-5 py-3 text-left">Criticality</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y">{assets.map(asset => <tr key={asset.id} className="hover:bg-gray-50"><td className="px-5 py-4"><div className="font-medium text-slate-900">{asset.name}</div><div className="text-xs text-gray-500">{asset.hostname || asset.ip_address || "—"}</div></td><td className="px-5 py-4">{asset.asset_type}</td><td className="px-5 py-4">{asset.environment || "—"}</td><td className="px-5 py-4">{asset.criticality || "—"}</td><td className="px-5 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs">{asset.status || "Active"}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2 whitespace-nowrap"><button onClick={() => openEdit(asset)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"><Pencil size={13}/> Edit</button>{asset.status !== "Retired" && <button onClick={() => retire(asset)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600"><Trash2 size={13}/> Retire</button>}</div></td></tr>)}
          {!assets.length && <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-500">No assets found.</td></tr>}</tbody></table>
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-xl bg-white shadow-xl"><div className="flex items-center justify-between border-b px-6 py-4"><h2 className="font-semibold">{title}</h2><button onClick={() => setOpen(false)}><X size={20}/></button></div><form onSubmit={save} className="space-y-4 p-6"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(([key,label,required]) => <label key={key} className="text-sm"><span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span><input required={required} value={(form as any)[key]} onChange={e => setForm({...form,[key]:e.target.value})} className="w-full rounded-lg border px-3 py-2"/></label>)}
          <label className="text-sm"><span className="mb-1 block font-medium">Criticality</span><select value={form.criticality || ""} onChange={e => setForm({...form,criticality:e.target.value})} className="w-full rounded-lg border px-3 py-2"><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Status</span><select value={form.status || "Active"} onChange={e => setForm({...form,status:e.target.value})} className="w-full rounded-lg border px-3 py-2"><option>Active</option><option>Inactive</option><option>Retired</option></select></label>
        </div><label className="text-sm"><span className="mb-1 block font-medium">Description</span><textarea rows={3} value={form.description || ""} onChange={e => setForm({...form,description:e.target.value})} className="w-full rounded-lg border px-3 py-2"/></label>{error && <div className="text-sm text-red-600">{error}</div>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save Asset"}</button></div></form></div></div>}
    </main>
  </AppShell>;
}
