"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Pencil, Plus, Search, Shield, RotateCcw, Trash2, ShieldCheck, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";

type Organization = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  status: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  status: string;
  last_login_at: string | null;
  organizations: Organization[];
  platformRole: string | null;
  platformStatus: string | null;
};

type EditForm = {
  email: string;
  fullName: string;
  jobTitle: string;
};

const EMPTY_FORM: EditForm = { email: "", fullName: "", jobTitle: "" };

export default function UserDirectoryPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "remove" | null>(null);
  const [target, setTarget] = useState<UserRow | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const current = await getCurrentProfile();
      if (current.platformRole !== "Platform Admin") {
        setError("Platform Admin access required.");
        return;
      }

      const response = await fetch("/api/platform/directory", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load user directory.");
      setRows(result.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load user directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(row: UserRow) {
    setEditing(row);
    setForm({
      email: row.email,
      fullName: row.full_name || "",
      jobTitle: row.job_title || "",
    });
    setError("");
    setMessage("");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/platform/directory/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          jobTitle: form.jobTitle.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update user.");

      setEditing(null);
      setMessage("User details updated successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: "Active" | "Suspended", selectedTarget: UserRow | null = target) {
    if (!selectedTarget) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/platform/directory/${selectedTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update user status.");

      setConfirmAction(null);
      setTarget(null);
      setMessage(status === "Suspended" ? "User suspended successfully." : "User reactivated successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user status.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser() {
    if (!target) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/platform/directory/${target.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to remove user access.");

      setConfirmAction(null);
      setTarget(null);
      setMessage(result.message || "User access removed successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove user access.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = rows.filter((row) => {
    const text = [
      row.full_name || "",
      row.email,
      row.job_title || "",
      ...row.organizations.map((org) => org.name),
    ].join(" ").toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-7">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <ShieldCheck size={16} /> Platform Administration
            </div>
            <h1 className="text-2xl font-semibold">User Directory</h1>
            <p className="text-sm text-gray-500 mt-1">Create users, invite users, and assign users to organizations.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border bg-white px-4 py-2.5 text-sm hover:bg-gray-50">
              Add Existing
            </button>
            <button type="button" className="rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-800">
              <Plus size={16} /> Invite User
            </button>
          </div>
        </div>

        {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}

        <div className="relative mb-4">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full border rounded-xl px-10 py-3 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(200px,1.5fr)_minmax(180px,1.6fr)_120px_minmax(320px,1fr)] px-5 py-3 border-b bg-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            <div>User</div>
            <div>Email</div>
            <div>Organizations</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading user directory…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No users found.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((row) => (
                <div key={row.id} className="grid grid-cols-[minmax(220px,1.5fr)_minmax(200px,1.5fr)_minmax(180px,1.6fr)_120px_minmax(320px,1fr)] px-5 py-4 items-center gap-3">
                  <div>
                    <div className="font-medium text-sm">{row.full_name || "Unnamed user"}</div>
                    <div className="text-xs text-gray-500 mt-1">{row.job_title || "—"}</div>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{row.email}</div>
                  <div className="text-sm text-gray-600">
                    {row.organizations.length ? row.organizations.map((org) => <div key={org.id}>{org.name}</div>) : <span>No organization</span>}
                  </div>
                  <div><StatusBadge status={row.status} /></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => openEdit(row)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50">
                      <Pencil size={13} /> Edit
                    </button>
                    {row.status === "Active" && (
                      <button type="button" onClick={() => { setTarget(row); setConfirmAction("suspend"); }} className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 text-amber-700 px-2.5 py-1.5 text-xs font-medium hover:bg-amber-50">
                        <Shield size={13} /> Suspend
                      </button>
                    )}
                    {row.status === "Suspended" && (
                      <button type="button" onClick={() => changeStatus("Active", row)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md border border-green-200 text-green-700 px-2.5 py-1.5 text-xs font-medium hover:bg-green-50 disabled:opacity-50">
                        <RotateCcw size={13} /> Reactivate
                      </button>
                    )}
                    {row.status !== "Removed" && (
                      <button type="button" onClick={() => { setTarget(row); setConfirmAction("remove"); }} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 text-red-700 px-2.5 py-1.5 text-xs font-medium hover:bg-red-50">
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border bg-gray-50 p-4 text-xs text-gray-600">
          <strong className="text-gray-800">User access:</strong> Suspend blocks AuditOps access globally. Remove Access removes organization memberships and Platform Admin access while retaining the user account and audit history.
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-5 border-b flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Edit User</h2>
                <p className="text-sm text-gray-500 mt-1">Update the application user directory record.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" /></Field>
              <Field label="Full Name"><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" /></Field>
              <Field label="Job Title"><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" /></Field>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={saving || !form.email.trim() || !form.fullName.trim()} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && target && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold">{confirmAction === "suspend" ? "Suspend user?" : "Remove user access?"}</h2>
              <p className="text-sm text-gray-600 mt-2">
                {confirmAction === "suspend"
                  ? `${target.full_name || target.email} will lose AuditOps access until the user is reactivated. Existing organization assignments and audit history will be retained.`
                  : `${target.full_name || target.email} will be removed from all organizations and Platform Admin access. The AuditOps user account and audit history will be retained.`}
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={() => { setConfirmAction(null); setTarget(null); }} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              {confirmAction === "suspend" ? (
                <button type="button" onClick={() => changeStatus("Suspended")} disabled={saving} className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm">
                  {saving ? "Processing…" : "Suspend User"}
                </button>
              ) : (
                <button type="button" onClick={removeUser} disabled={saving} className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm">
                  {saving ? "Processing…" : "Remove Access"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="text-sm font-medium text-gray-700">{label}</span><div className="mt-1.5">{children}</div></label>;
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Suspended"
        ? "bg-amber-50 text-amber-700"
        : status === "Invited"
          ? "bg-blue-50 text-blue-700"
          : status === "Removed"
            ? "bg-red-50 text-red-700"
            : "bg-gray-100 text-gray-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}
