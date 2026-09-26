"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ShieldCheck, UserPlus, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";

type User = { id: string; email: string; full_name: string | null; job_title: string | null; status: string; last_login_at: string | null };
type Org = { id: string; name: string; slug: string; status: string; plan: string };
type Membership = { id: string; user_id: string; organization_id: string; role: string; status: string; organization?: { id: string; name: string; slug: string } | null };
const ROLES = ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager", "Contributor", "Auditor / Read Only"];

export default function UserDirectoryPage() {
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"invite" | "existing">("invite");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [role, setRole] = useState("Contributor");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const current = await getCurrentProfile();
    setPlatformRole(current.platformRole);
    if (current.platformRole !== "Platform Admin") return;
    const response = await fetch("/api/platform/directory", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load directory.");
    else { setUsers(result.users || []); setOrgs(result.organizations || []); setMemberships(result.memberships || []); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => users.filter((u) => `${u.full_name || ""} ${u.email}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  const orgNames = (userId: string) => memberships.filter((m) => m.user_id === userId).map((m) => m.organization?.name).filter(Boolean).join(", ");

  async function submit() {
    setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/platform/directory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email, fullName, jobTitle, organizationId, role }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to save user.");
    else { setMessage(result.message); setOpen(false); setEmail(""); setFullName(""); setJobTitle(""); setOrganizationId(""); setRole("Contributor"); await load(); }
    setSaving(false);
  }

  if (platformRole === null) return <AppShell><div className="max-w-6xl mx-auto bg-white border rounded-xl p-8 text-sm text-gray-500">Loading User Directory…</div></AppShell>;
  if (platformRole !== "Platform Admin") return <AppShell><div className="max-w-6xl mx-auto bg-white border rounded-xl p-8"><h1 className="text-xl font-semibold">Access denied</h1><p className="text-sm text-gray-500 mt-2">Only Platform Admins can manage the global user directory.</p></div></AppShell>;

  return <AppShell>
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-7"><div><div className="flex items-center gap-2 text-sm text-gray-400 mb-2"><ShieldCheck size={16}/> Platform Administration</div><h1 className="text-2xl font-semibold">User Directory</h1><p className="text-sm text-gray-500 mt-1">Create users, invite users, and assign users to organizations.</p></div><div className="flex gap-2"><button onClick={() => { setAction("existing"); setOpen(true); setError(""); }} className="rounded-lg border bg-white px-4 py-2 text-sm flex items-center gap-2"><UserPlus size={16}/> Add Existing</button><button onClick={() => { setAction("invite"); setOpen(true); setError(""); }} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> Invite User</button></div></div>
      {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
      {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}
      <div className="mb-4 relative"><Search size={16} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white"/></div>
      <div className="bg-white border rounded-xl overflow-hidden"><div className="grid grid-cols-[1.3fr_1.5fr_1.7fr_1fr] gap-4 px-5 py-3 border-b text-[11px] uppercase tracking-wide text-gray-400 font-semibold"><div>User</div><div>Email</div><div>Organizations</div><div>Status</div></div><div className="divide-y">{filtered.map((u) => <div key={u.id} className="grid grid-cols-[1.3fr_1.5fr_1.7fr_1fr] gap-4 px-5 py-4 items-center"><div><div className="font-medium text-sm">{u.full_name || "Unnamed user"}</div><div className="text-xs text-gray-500 mt-1">{u.job_title || "—"}</div></div><div className="text-sm text-gray-600 truncate">{u.email}</div><div className="text-sm text-gray-600">{orgNames(u.id) || "No organization"}</div><div><span className="inline-flex rounded-full px-2 py-1 text-xs bg-gray-100 text-gray-600">{u.status}</span></div></div>)}{filtered.length === 0 && <div className="p-8 text-sm text-gray-500">No users found.</div>}</div></div>
    </div>
    {open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white rounded-xl shadow-xl"><div className="flex items-center justify-between px-6 py-4 border-b"><div><h2 className="font-semibold">{action === "invite" ? "Invite New User" : "Add Existing User"}</h2><p className="text-xs text-gray-500 mt-1">{action === "invite" ? "Create the AuditOps directory record and send an authentication invitation." : "Add an existing AuditOps user to an organization."}</p></div><button onClick={() => setOpen(false)}><X size={19}/></button></div><div className="p-6 space-y-4"><Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field>{action === "invite" && <><Field label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field><Field label="Job Title"><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></Field></>}<Field label="Organization"><select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">No organization</option>{orgs.filter((o) => o.status === "Active").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="Organization Role"><select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field><button disabled={saving} onClick={submit} className="w-full rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm disabled:opacity-50">{saving ? "Saving…" : action === "invite" ? "Send Invitation" : "Add User"}</button></div></div></div>}
  </AppShell>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>; }
