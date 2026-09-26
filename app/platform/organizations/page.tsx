"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient, getCurrentProfile } from "@/lib/auth";

type Organization = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  timezone: string | null;
  status: string;
  plan: string;
  created_at: string;
};

export default function PlatformOrganizationsPage() {
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [rows, setRows] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  async function load() {
    setLoading(true);
    setError("");

    const { platformRole: role } = await getCurrentProfile();
    setPlatformRole(role);

    if (role !== "Platform Admin") {
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await createClient()
      .from("organizations")
      .select("id,name,slug,industry,timezone,status,plan,created_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setRows([]);
    } else {
      setRows((data || []) as Organization[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createOrganization() {
    if (!name.trim() || !slug.trim()) {
      setError("Organization name and slug are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const normalizedSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { error: createError } = await createClient()
      .from("organizations")
      .insert({
        name: name.trim(),
        slug: normalizedSlug,
        industry: industry.trim() || null,
        timezone: timezone.trim() || "Asia/Kolkata",
        status: "Active",
        plan: "Standard",
      });

    if (createError) {
      setError(
        createError.code === "23505"
          ? "An organization with this slug already exists."
          : createError.message
      );
      setSaving(false);
      return;
    }

    setMessage("Organization created successfully.");
    setName("");
    setSlug("");
    setIndustry("");
    setTimezone("Asia/Kolkata");
    setOpen(false);
    setSaving(false);
    await load();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto bg-white border rounded-xl p-8 text-sm text-gray-500">
          Loading platform organizations…
        </div>
      </AppShell>
    );
  }

  if (platformRole !== "Platform Admin") {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto bg-white border rounded-xl p-8">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="text-sm text-gray-500 mt-2">
            Only Platform Administrators can manage organizations.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-7">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Building2 size={16} />
              Platform Administration
            </div>
            <h1 className="text-2xl font-semibold">Organizations</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage AuditOps customer organizations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
              setOpen(true);
            }}
            className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus size={16} />
            Create Organization
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            <div>Organization</div>
            <div>Status</div>
            <div>Plan</div>
            <div>Timezone</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-sm text-gray-500">
              No organizations found.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((org) => (
                <div
                  key={org.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center"
                >
                  <div>
                    <div className="font-medium text-sm">{org.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {org.slug}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs ${
                        org.status === "Active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {org.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">{org.plan}</div>
                  <div className="text-sm text-gray-600">
                    {org.timezone || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-semibold">Create Organization</h2>
                <p className="text-xs text-gray-500 mt-1">
                  The organization can be assigned an Organization Admin after creation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Field label="Organization Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Acme Corporation"
                />
              </Field>

              <Field label="Slug">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="acme-corporation"
                />
              </Field>

              <Field label="Industry">
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Technology"
                />
              </Field>

              <Field label="Timezone">
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Asia/Kolkata"
                />
              </Field>

              <button
                type="button"
                disabled={saving}
                onClick={createOrganization}
                className="w-full rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Organization"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
