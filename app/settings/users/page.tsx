"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Shield, UserPlus, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_OPTIONS, isAdmin } from "@/lib/rbac";

type UserRow = {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  status: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    job_title: string | null;
    status: string;
    last_login_at: string | null;
    created_at: string;
  } | null;
};

export default function UsersPage() {
  const [profile, setProfile] = useState<any>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"invite" | "existing" | "edit" | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState("Contributor");

  async function load() {
    setLoading(true);
    setError("");
    const current = await getCurrentProfile();
    setProfile(current.profile);

    if (!current.profile || !isAdmin(current.profile.role)) {
      setLoading(false);
      return;
    }

    const response = await fetch("/api/users", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load users.");
    else setRows(result.users || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openInvite() {
    setError("");
    setMessage("");
    setEmail("");
    setFullName("");
    setJobTitle("");
    setRole("Contributor");
    setModal("invite");
  }

  function openExisting() {
    setError("");
    setMessage("");
    setEmail("");
    setRole("Contributor");
    setModal("existing");
  }

  function openEdit(row: UserRow) {
    setSelected(row);
    setFullName(row.user?.full_name || "");
    setJobTitle(row.user?.job_title || "");
    setRole(row.role);
    setModal("edit");
    setError("");
    setMessage("");
  }

  async function submit() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (modal === "invite" || modal === "existing") {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: modal === "existing" ? "add_existing" : "invite",
            email,
            fullName,
            jobTitle,
            role,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to save user.");
        setMessage(result.message || "User saved successfully.");
        setModal(null);
        await load();
      } else if (modal === "edit" && selected) {
        const response = await fetch(`/api/users/${selected.user_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, jobTitle, role }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to update user.");
        setMessage("User updated successfully.");
        setModal(null);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function updateMembership(row: UserRow, field: "role" | "status", value: string) {
    setError("");
    const response = await fetch(`/api/users/${row.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to update user.");
    else {
      setMessage("User updated successfully.");
      await load();
    }
  }

  if (loading) {
    return <AppShell requiredPermission="users"><div className="max-w-6xl mx-auto bg-white border rounded-xl p-8 text-sm text-gray-500">Loading users…</div></AppShell>;
  }

  if (!profile || !isAdmin(profile.role)) {
    return <AppShell requiredPermission="users"><div className="max-w-6xl mx-auto bg-white border rounded-xl p-8"><h1 className="text-xl font-semibold">Access denied</h1><p className="text-sm text-gray-500 mt-2">Only Organization Admins can manage users.</p></div></AppShell>;
  }

  return (
    <AppShell requiredPermission="users">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold">Users & Roles</h1>
            <p className="text-sm text-gray-500 mt-1">Manage organization access from the AuditOps portal.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openExisting} className="rounded-lg border bg-white px-4 py-2 text-sm flex items-center gap-2"><UserPlus size={16}/> Add Existing User</button>
            <button onClick={openInvite} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2"><UserPlus size={16}/> Invite New User</button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800 flex gap-3">
          <Shield size={18} className="shrink-0 mt-0.5" />
          <div><strong>Application-managed users.</strong> User directory records are managed by AuditOps. Supabase Auth is used only for authentication.</div>
        </div>

        {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm flex items-center gap-2"><Check size={15}/>{message}</div>}
        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1.4fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            <div>User</div><div>Email</div><div>Role</div><div>Status</div><div />
          </div>
          {rows.length === 0 ? <div className="p-8 text-sm text-gray-500">No organization users found.</div> : <div className="divide-y">
            {rows.map((row) => {
              const isCurrent = row.user_id === profile.id;
              return <div key={row.id} className="grid grid-cols-[1.6fr_1.4fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center">
                <div className="min-w-0"><div className="font-medium text-sm flex items-center gap-2">{row.user?.full_name || "Unnamed user"}{isCurrent && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">You</span>}</div><div className="text-xs text-gray-500 mt-1">{row.user?.job_title || "No job title"}</div></div>
                <div className="text-sm text-gray-600 truncate">{row.user?.email || "—"}</div>
                <select value={row.role} disabled={isCurrent} onChange={(e) => updateMembership(row, "role", e.target.value)} className="border rounded-lg px-2.5 py-2 text-sm bg-white disabled:bg-gray-100">{ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}</select>
                <select value={row.status} disabled={isCurrent} onChange={(e) => updateMembership(row, "status", e.target.value)} className="border rounded-lg px-2.5 py-2 text-sm bg-white disabled:bg-gray-100"><option>Active</option><option>Invited</option><option>Suspended</option></select>
                <button onClick={() => openEdit(row)} className="p-2 rounded-lg hover:bg-gray-100" title="Edit user"><Pencil size={16}/></button>
              </div>;
            })}
          </div>}
        </div>

        <div className="mt-6 bg-gray-50 border rounded-xl p-5">
          <h3 className="font-semibold text-sm">How user access works</h3>
          <p className="text-xs text-gray-500 mt-2">One AuditOps user can belong to multiple organizations. The role shown here applies only to the current organization.</p>
        </div>
      </div>

      {modal && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b"><div><h2 className="font-semibold">{modal === "invite" ? "Invite New User" : modal === "existing" ? "Add Existing User" : "Edit User"}</h2><p className="text-xs text-gray-500 mt-1">{modal === "existing" ? "Add an existing AuditOps account to this organization." : "Manage the user from the AuditOps portal."}</p></div><button onClick={() => setModal(null)}><X size={19}/></button></div>
          <div className="p-6 space-y-4">
            <Field label="Email"><input disabled={modal === "edit"} type="email" value={modal === "edit" ? selected?.user?.email || "" : email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></Field>
            {modal !== "existing" && <><Field label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field><Field label="Job Title"><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field></>}
            <Field label="Organization Role"><select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <button disabled={saving} onClick={submit} className="w-full rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm disabled:opacity-50">{saving ? "Saving…" : modal === "invite" ? "Send Invitation" : modal === "existing" ? "Add User" : "Save Changes"}</button>
          </div>
        </div>
      </div>}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>;
}
