"use client";

import { useEffect, useState } from "react";
import { MoreVertical, Pencil, Plus, Search, ShieldCheck, UserX, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";

type Organization = { id: string; name: string; slug: string | null; role: string; status: string };
type UserRow = {
  id: string; email: string; full_name: string | null; job_title: string | null; status: string;
  last_login_at: string | null; organizations: Organization[]; platformRole: string | null; platformStatus: string | null;
};

export default function UserDirectoryPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [search, setSearch] = useState(""); const [actions, setActions] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null); const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [jobTitle, setJobTitle] = useState("");

  async function load() {
    setLoading(true); setError("");
    const current = await getCurrentProfile();
    if (current.platformRole !== "Platform Admin") { setLoading(false); return; }
    const response = await fetch("/api/platform/directory", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load user directory."); else setRows(result.users || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startEdit(row: UserRow) {
    setActions(null); setEditing(row); setEmail(row.email); setFullName(row.full_name || ""); setJobTitle(row.job_title || ""); setError(""); setMessage("");
  }
  async function saveEdit() {
    if (!editing) return; setSaving(true); setError("");
    const response = await fetch(`/api/platform/directory/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, fullName, jobTitle }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to update user."); else { setEditing(null); setMessage("User details updated successfully."); await load(); }
    setSaving(false);
  }
  async function changeStatus(row: UserRow, status: string) {
    setActions(null); setError("");
    const response = await fetch(`/api/platform/directory/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to update user status."); else { setMessage(`User ${status === "Suspended" ? "suspended" : "enabled"} successfully.`); await load(); }
  }
  async function removeUser(row: UserRow) {
    setActions(null);
    if (!window.confirm(`Remove ${row.full_name || row.email} from all organizations and platform access? The AuditOps user account and audit history will be retained.`)) return;
    const response = await fetch(`/api/platform/directory/${row.id}`, { method: "DELETE" }); const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to remove user."); else { setMessage(result.message || "User access removed."); await load(); }
  }

  const filtered = rows.filter((row) => `${row.full_name || ""} ${row.email} ${row.organizations.map((x) => x.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));

  return <AppShell>
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-7"><div><div className="flex items-center gap-2 text-sm text-gray-400 mb-2"><ShieldCheck size={16}/> Platform Administration</div><h1 className="text-2xl font-semibold">User Directory</h1><p className="text-sm text-gray-500 mt-1">Create users, invite users, and assign users to organizations.</p></div><div className="flex gap-2"><button className="rounded-lg border bg-white px-4 py-2 text-sm">Add Existing</button><button className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> Invite User</button></div></div>
      {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
      {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}
      <div className="relative mb-4"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="w-full border rounded-xl px-10 py-3 text-sm bg-white"/></div>
      <div className="bg-white border rounded-xl overflow-visible"><div className="grid grid-cols-[1.5fr_1.5fr_1.6fr_1fr_auto] gap-4 px-5 py-3 border-b text-[11px] uppercase tracking-wide text-gray-400 font-semibold"><div>User</div><div>Email</div><div>Organizations</div><div>Status</div><div>Actions</div></div>
      {loading ? <div className="p-8 text-sm text-gray-500">Loading user directory…</div> : filtered.length === 0 ? <div className="p-8 text-sm text-gray-500">No users found.</div> : <div className="divide-y">{filtered.map((row) => { const active = row.status === "Active"; return <div key={row.id} className="grid grid-cols-[1.5fr_1.5fr_1.6fr_1fr_auto] gap-4 px-5 py-4 items-center"><div><div className="font-medium text-sm">{row.full_name || "Unnamed user"}</div><div className="text-xs text-gray-500 mt-1">{row.job_title || "—"}</div></div><div className="text-sm text-gray-600 truncate">{row.email}</div><div className="text-sm text-gray-600">{row.organizations.length ? row.organizations.map((org) => <div key={org.id}>{org.name}</div>) : <span>No organization</span>}</div><div><span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs">{row.status}</span></div><div className="relative"><button onClick={() => setActions(actions === row.id ? null : row.id)} className="p-2 rounded-lg hover:bg-gray-100"><MoreVertical size={17}/></button>{actions === row.id && <div className="absolute right-0 top-10 z-40 w-56 bg-white border rounded-xl shadow-lg p-1"><button onClick={() => startEdit(row)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50"><Pencil size={15}/> Edit User</button><button onClick={() => changeStatus(row, active ? "Suspended" : "Active")} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50"><UserX size={15}/> {active ? "Suspend User" : "Enable User"}</button><button onClick={() => removeUser(row)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600"><UserX size={15}/> Remove Access</button></div>}</div></div>; })}</div>}</div>
      <div className="mt-6 bg-gray-50 border rounded-xl p-5"><h3 className="font-semibold text-sm">User access</h3><p className="text-xs text-gray-500 mt-2">Suspend blocks AuditOps access globally. Remove Access removes organization memberships and Platform Admin access but retains the user account and audit history.</p></div>
    </div>
    {editing && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white rounded-xl shadow-xl"><div className="flex items-center justify-between px-6 py-4 border-b"><div><h2 className="font-semibold">Edit User</h2><p className="text-xs text-gray-500 mt-1">Update the application user directory record.</p></div><button onClick={() => setEditing(null)}><X size={19}/></button></div><div className="p-6 space-y-4"><Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><Field label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><Field label="Job Title"><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><button disabled={saving} onClick={saveEdit} className="w-full rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button></div></div></div>}
  </AppShell>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>; }
