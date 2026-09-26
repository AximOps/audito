"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";

type AdminRow = {
  user_id: string;
  role: string;
  status: string;
  user: { email: string; full_name: string | null; job_title: string | null; status: string; last_login_at: string | null } | null;
};

export default function PlatformUsersPage() {
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  async function load() {
    const current = await getCurrentProfile();
    setPlatformRole(current.platformRole);
    if (current.platformRole !== "Platform Admin") { setLoading(false); return; }
    const response = await fetch("/api/platform/users", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load Platform Admins.");
    else setRows(result.admins || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addAdmin() {
    setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/platform/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, fullName, jobTitle }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to add Platform Admin.");
    else { setMessage(result.message); setOpen(false); setEmail(""); setFullName(""); setJobTitle(""); await load(); }
    setSaving(false);
  }

  async function changeStatus(userId: string, status: string) {
    const response = await fetch("/api/platform/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, status }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to update Platform Admin.");
    else { setMessage("Platform Admin status updated."); await load(); }
  }

  if (loading) return <AppShell><div className="max-w-6xl mx-auto bg-white border rounded-xl p-8 text-sm text-gray-500">Loading Platform Admins…</div></AppShell>;
  if (platformRole !== "Platform Admin") return <AppShell><div className="max-w-6xl mx-auto bg-white border rounded-xl p-8"><h1 className="text-xl font-semibold">Access denied</h1><p className="text-sm text-gray-500 mt-2">Only Platform Admins can manage Platform Admins.</p></div></AppShell>;

  return <AppShell>
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-7"><div><div className="flex items-center gap-2 text-sm text-gray-400 mb-2"><ShieldCheck size={16}/> Platform Administration</div><h1 className="text-2xl font-semibold">Platform Admins</h1><p className="text-sm text-gray-500 mt-1">Manage administrators who can manage AuditOps organizations and users.</p></div><button onClick={() => { setError(""); setMessage(""); setOpen(true); }} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> Add Platform Admin</button></div>
      {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
      {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1.6fr_1fr_1fr] gap-4 px-5 py-3 border-b text-[11px] uppercase tracking-wide text-gray-400 font-semibold"><div>User</div><div>Email</div><div>Status</div><div>Last Login</div></div>
        <div className="divide-y">{rows.map((row) => <div key={row.user_id} className="grid grid-cols-[1.5fr_1.6fr_1fr_1fr] gap-4 px-5 py-4 items-center"><div><div className="font-medium text-sm">{row.user?.full_name || "Unnamed user"}</div><div className="text-xs text-gray-500 mt-1">{row.user?.job_title || "Platform Admin"}</div></div><div className="text-sm text-gray-600">{row.user?.email}</div><select value={row.status} onChange={(e) => changeStatus(row.user_id, e.target.value)} className="border rounded-lg px-2.5 py-2 text-sm bg-white"><option>Active</option><option>Suspended</option></select><div className="text-sm text-gray-500">{row.user?.last_login_at ? new Date(row.user.last_login_at).toLocaleString() : "Never"}</div></div>)}</div>
      </div>
    </div>
    {open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white rounded-xl shadow-xl"><div className="flex items-center justify-between px-6 py-4 border-b"><div><h2 className="font-semibold">Add Platform Admin</h2><p className="text-xs text-gray-500 mt-1">Existing users can be promoted; new users receive an invitation.</p></div><button onClick={() => setOpen(false)}><X size={19}/></button></div><div className="p-6 space-y-4"><Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><Field label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><Field label="Job Title"><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><button disabled={saving} onClick={addAdmin} className="w-full rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm disabled:opacity-50">{saving ? "Saving…" : "Add Platform Admin"}</button></div></div></div>}
  </AppShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>; }
