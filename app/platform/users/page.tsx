"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Pencil, Plus, RotateCcw, Shield, ShieldCheck, Trash2, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";
import PlatformAdminEditDialog, { type PlatformAdminUser } from "@/components/platform-admin-edit-dialog";

type AdminRow = {
  user_id: string;
  role: string;
  status: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    job_title: string | null;
    status: string;
    last_login_at: string | null;
  } | null;
};

type ConfirmAction = "suspend" | "remove" | null;

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
  const [editing, setEditing] = useState<PlatformAdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [target, setTarget] = useState<AdminRow | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const current = await getCurrentProfile();
      setPlatformRole(current.platformRole);
      if (current.platformRole !== "Platform Admin") return;

      const response = await fetch("/api/platform/users", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load Platform Admins.");
      setRows(result.admins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Platform Admins.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addAdmin() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/platform/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, jobTitle }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to add Platform Admin.");

      setMessage(result.message || "Platform Admin added successfully.");
      setOpen(false);
      setEmail("");
      setFullName("");
      setJobTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add Platform Admin.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(userId: string, status: "Active" | "Suspended") {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update Platform Admin status.");

      setConfirmAction(null);
      setTarget(null);
      setMessage(status === "Suspended" ? "Platform Admin suspended successfully." : "Platform Admin reactivated successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update Platform Admin status.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(row: AdminRow) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/platform/admins/${row.user_id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to remove Platform Admin access.");

      setConfirmAction(null);
      setTarget(null);
      setMessage(result.message || "Platform Admin access removed successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove Platform Admin access.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: AdminRow) {
    if (!row.user) return;
    setEditing(row.user);
    setError("");
    setMessage("");
  }

  function openConfirmation(row: AdminRow, action: Exclude<ConfirmAction, null>) {
    setTarget(row);
    setConfirmAction(action);
    setError("");
    setMessage("");
  }

  function closeConfirmation() {
    if (saving) return;
    setConfirmAction(null);
    setTarget(null);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto bg-white border rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading Platform Admins…
        </div>
      </AppShell>
    );
  }

  if (platformRole !== "Platform Admin") {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto bg-white border rounded-xl p-8">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="text-sm text-gray-500 mt-2">Only Platform Admins can manage Platform Admins.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-7">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <ShieldCheck size={16} /> Platform Administration
            </div>
            <h1 className="text-2xl font-semibold">Platform Admins</h1>
            <p className="text-sm text-gray-500 mt-1">Manage administrators who can manage AuditOps organizations and users.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
              setOpen(true);
            }}
            className="rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-800"
          >
            <Plus size={16} /> Add Platform Admin
          </button>
        </div>

        {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(220px,1.5fr)_120px_170px_minmax(360px,max-content)] px-5 py-3 border-b bg-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            <div>User</div>
            <div>Email</div>
            <div>Status</div>
            <div>Last Login</div>
            <div>Actions</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No Platform Admins found.</div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => {
                const name = row.user?.full_name || "Unnamed user";
                const status = row.status || row.user?.status || "Active";

                return (
                  <div
                    key={row.user_id}
                    className="grid grid-cols-[minmax(220px,1.5fr)_minmax(220px,1.5fr)_120px_170px_minmax(360px,max-content)] px-5 py-4 items-center gap-3"
                  >
                    <div>
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-gray-500 mt-1">{row.user?.job_title || "Platform Admin"}</div>
                    </div>
                    <div className="text-sm text-gray-700 truncate">{row.user?.email || "—"}</div>
                    <div>
                      <StatusBadge status={status} />
                    </div>
                    <div className="text-sm text-gray-700">
                      {row.user?.last_login_at ? new Date(row.user.last_login_at).toLocaleString() : "Never"}
                    </div>
                    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        disabled={!row.user}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Pencil size={13} /> Edit
                      </button>

                      {status === "Active" && (
                        <button
                          type="button"
                          onClick={() => openConfirmation(row, "suspend")}
                          className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 text-amber-700 px-2.5 py-1.5 text-xs font-medium hover:bg-amber-50"
                        >
                          <Shield size={13} /> Suspend
                        </button>
                      )}

                      {status === "Suspended" && (
                        <button
                          type="button"
                          onClick={() => changeStatus(row.user_id, "Active")}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-md border border-green-200 text-green-700 px-2.5 py-1.5 text-xs font-medium hover:bg-green-50 disabled:opacity-50"
                        >
                          <RotateCcw size={13} /> Reactivate
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openConfirmation(row, "remove")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 text-red-700 px-2.5 py-1.5 text-xs font-medium hover:bg-red-50"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border bg-gray-50 p-4 text-xs text-gray-600">
          <strong className="text-gray-800">Platform Admin access:</strong> Suspend blocks Platform Administration access. Remove revokes Platform Admin access while retaining the underlying AuditOps user account and audit history.
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-5 border-b flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Add Platform Admin</h2>
                <p className="text-sm text-gray-500 mt-1">Existing users can be promoted; new users receive an invitation.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="p-1 rounded hover:bg-gray-100">
                <X size={19} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" /></Field>
              <Field label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" /></Field>
              <Field label="Job Title"><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" /></Field>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button disabled={saving || !email.trim() || !fullName.trim()} onClick={addAdmin} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? "Saving…" : "Add Platform Admin"}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <PlatformAdminEditDialog
          user={editing}
          open={true}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage("Platform Admin updated successfully.");
            load();
          }}
          onError={(msg) => setError(msg || "")}
        />
      )}

      {confirmAction && target && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold">{confirmAction === "suspend" ? "Suspend Platform Admin?" : "Remove Platform Admin?"}</h2>
              <p className="text-sm text-gray-600 mt-2">
                {confirmAction === "suspend"
                  ? `${target.user?.full_name || target.user?.email || "This user"} will lose Platform Administration access until reactivated. The user account and audit history will be retained.`
                  : `${target.user?.full_name || target.user?.email || "This user"} will lose Platform Administration access. The underlying AuditOps user account and audit history will be retained.`}
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={closeConfirmation} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => confirmAction === "suspend" ? changeStatus(target.user_id, "Suspended") : removeAdmin(target)}
                disabled={saving}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm"
              >
                {saving ? "Processing…" : confirmAction === "suspend" ? "Suspend Platform Admin" : "Remove Platform Admin"}
              </button>
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
  const classes = status === "Active"
    ? "bg-emerald-50 text-emerald-700"
    : status === "Suspended"
      ? "bg-amber-50 text-amber-700"
      : "bg-gray-100 text-gray-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}
