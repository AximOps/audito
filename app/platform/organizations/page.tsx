"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Building2, Loader2, Pencil, Plus, RotateCcw, Shield, Trash2 } from "lucide-react";
import AppShell from "@/components/app-shell";
import { ORGANIZATION_SUBSCRIPTIONS, ORGANIZATION_STATUSES } from "@/lib/organization-plans";

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscription: string;
  timezone: string;
  industry: string | null;
  plan?: string | null;
};

type FormState = {
  name: string;
  slug: string;
  subscription: string;
  timezone: string;
  industry: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  subscription: "FREE",
  timezone: "Asia/Kolkata",
  industry: "",
  status: "Active",
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "remove" | null>(null);
  const [target, setTarget] = useState<Organization | null>(null);

  async function loadOrganizations() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/organizations", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load organizations.");
      setOrganizations(result.organizations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load organizations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrganizations();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function openEdit(org: Organization) {
    setEditing(org);
    setForm({
      name: org.name,
      slug: org.slug,
      subscription: org.subscription || org.plan || "FREE",
      timezone: org.timezone || "Asia/Kolkata",
      industry: org.industry || "",
      status: org.status,
    });
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  async function saveOrganization() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        subscription: form.subscription,
        timezone: form.timezone.trim(),
        industry: form.industry.trim() || null,
        ...(editing ? { status: form.status } : {}),
      };

      const response = await fetch(
        editing ? `/api/platform/organizations/${editing.id}` : "/api/platform/organizations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save organization.");

      setFormOpen(false);
      setMessage(editing ? "Organization updated successfully." : "Organization created successfully.");
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save organization.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: "Active" | "Suspended" | "Removed", selectedTarget: Organization | null = target) {
    if (!selectedTarget) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/platform/organizations/${selectedTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update organization status.");

      setConfirmAction(null);
      setTarget(null);
      setMessage(
        status === "Suspended"
          ? "Organization suspended successfully."
          : status === "Removed"
            ? "Organization removed successfully."
            : "Organization reactivated successfully."
      );
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update organization status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-7">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Building2 size={16} /> Platform Administration
            </div>
            <h1 className="text-2xl font-semibold">Organizations</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage AuditOps customer organizations.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-800"
          >
            <Plus size={16} /> Create Organization
          </button>
        </div>

        {message && <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">{message}</div>}
        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">{error}</div>}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[minmax(220px,1.5fr)_120px_150px_170px_minmax(220px,1fr)] px-5 py-3 border-b bg-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            <div>Organization</div>
            <div>Status</div>
            <div>Subscription</div>
            <div>Timezone</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading organizations…</div>
          ) : organizations.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No organizations found.</div>
          ) : (
            <div className="divide-y">
              {organizations.map((org) => (
                <div key={org.id} className="grid grid-cols-[minmax(220px,1.5fr)_120px_150px_170px_minmax(220px,1fr)] px-5 py-4 items-center gap-3">
                  <div>
                    <div className="font-medium text-sm">{org.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{org.slug}</div>
                  </div>
                  <div><StatusBadge status={org.status} /></div>
                  <div><SubscriptionBadge value={org.subscription || org.plan || "FREE"} /></div>
                  <div className="text-sm text-gray-700">{org.timezone}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => openEdit(org)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50"><Pencil size={13} /> Edit</button>
                    {org.status === "Active" && (
                      <button type="button" onClick={() => { setTarget(org); setConfirmAction("suspend"); }} className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 text-amber-700 px-2.5 py-1.5 text-xs font-medium hover:bg-amber-50"><Shield size={13} /> Suspend</button>
                    )}
                    {org.status === "Suspended" && (
                      <button type="button" onClick={() => changeStatus("Active", org)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md border border-green-200 text-green-700 px-2.5 py-1.5 text-xs font-medium hover:bg-green-50"><RotateCcw size={13} /> Reactivate</button>
                    )}
                    {org.status !== "Removed" && (
                      <button type="button" onClick={() => { setTarget(org); setConfirmAction("remove"); }} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 text-red-700 px-2.5 py-1.5 text-xs font-medium hover:bg-red-50"><Trash2 size={13} /> Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border bg-gray-50 p-4 text-xs text-gray-600">
          <strong className="text-gray-800">Subscription plans:</strong> FREE, Standard, Pro and Enterprise. Organization removal is a soft removal; compliance records, evidence and audit history are retained.
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? "Edit Organization" : "Create Organization"}</h2>
              <p className="text-sm text-gray-500 mt-1">{editing ? "Update organization details and subscription." : "Create a new AuditOps customer organization."}</p>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Organization Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" placeholder="Organization name" /></Field>
              <Field label="Slug"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" placeholder="organization-slug" /></Field>
              <Field label="Subscription"><select value={form.subscription} onChange={(e) => setForm({ ...form, subscription: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200">{ORGANIZATION_SUBSCRIPTIONS.map((plan) => <option key={plan}>{plan}</option>)}</select></Field>
              <Field label="Timezone"><input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" placeholder="Asia/Kolkata" /></Field>
              <Field label="Industry"><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" placeholder="Technology" /></Field>
              {editing && <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200">{ORGANIZATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={saveOrganization} disabled={saving || !form.name.trim()} className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? "Saving…" : editing ? "Save Changes" : "Create Organization"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && target && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold">{confirmAction === "suspend" ? "Suspend organization?" : "Remove organization?"}</h2>
              <p className="text-sm text-gray-600 mt-2">
                {confirmAction === "suspend"
                  ? `${target.name} users will lose access until the organization is reactivated. Existing compliance data will be retained.`
                  : `${target.name} will be removed from active AuditOps use. Users will lose access, while compliance records and audit history are retained.`}
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={() => { setConfirmAction(null); setTarget(null); }} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => changeStatus(confirmAction === "suspend" ? "Suspended" : "Removed")} disabled={saving} className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm">{saving ? "Processing…" : confirmAction === "suspend" ? "Suspend Organization" : "Remove Organization"}</button>
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
  const classes = status === "Active" ? "bg-emerald-50 text-emerald-700" : status === "Suspended" ? "bg-amber-50 text-amber-700" : status === "Removed" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}

function SubscriptionBadge({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-medium">{value}</span>;
}
