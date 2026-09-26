"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { Activity, ActivityStatus } from "@/lib/types";

const STATUSES: ActivityStatus[] = [
  "Not Started",
  "In Progress",
  "Pending Review",
  "Completed",
  "Overdue",
  "Cancelled",
];

const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const CATEGORIES = [
  "Access Management",
  "Asset Management",
  "Compliance",
  "Incident Management",
  "Policy Management",
  "Risk Management",
  "Security",
  "Vendor Management",
  "Other",
];

type UserOption = {
  id: string;
  full_name: string | null;
};

type ActivityForm = {
  title: string;
  description: string;
  category: string;
  owner_id: string;
  reviewer_id: string;
  frequency: string;
  status: ActivityStatus;
  priority: string;
  start_date: string;
  due_date: string;
};

const EMPTY_FORM: ActivityForm = {
  title: "",
  description: "",
  category: "Compliance",
  owner_id: "",
  reviewer_id: "",
  frequency: "",
  status: "Not Started",
  priority: "Medium",
  start_date: "",
  due_date: "",
};

export default function Activities() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityForm>(EMPTY_FORM);

  const role = profile?.role;
  const canCreate = can(role, "activities") && role !== "Auditor / Read Only";
  const canEdit = canCreate;
  const canDelete =
    role === "Organization Admin" || role === "Compliance Manager";

  async function load() {
    setLoading(true);
    setError("");

    const { profile: currentProfile } = await getCurrentProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const [{ data: activityData, error: activityError }, { data: userData }] =
      await Promise.all([
        supabase
          .from("compliance_activities")
          .select(
            "id,title,description,category,status,priority,start_date,due_date,frequency,owner:user_profiles!owner_id(id,full_name),reviewer:user_profiles!reviewer_id(id,full_name)"
          )
          .eq("organization_id", currentProfile.organization_id)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("user_profiles")
          .select("id,full_name")
          .eq("organization_id", currentProfile.organization_id)
          .eq("status", "Active")
          .order("full_name"),
      ]);

    if (activityError) {
      setError(activityError.message);
      setRows([]);
    } else {
      setRows((activityData || []) as unknown as Activity[]);
    }

    setUsers((userData || []) as UserOption[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.title.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        String(row.owner?.full_name || "").toLowerCase().includes(q);

      const matchesStatus = !statusFilter || row.status === statusFilter;
      const matchesPriority = !priorityFilter || row.priority === priorityFilter;
      const matchesCategory = !categoryFilter || row.category === categoryFilter;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory
      );
    });
  }, [rows, query, statusFilter, priorityFilter, categoryFilter]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setMessage("");
    setShowModal(true);
  }

  function openEdit(row: Activity) {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      description: (row as any).description || "",
      category: row.category || "Compliance",
      owner_id: (row as any).owner?.id || "",
      reviewer_id: (row as any).reviewer?.id || "",
      frequency: (row as any).frequency || "",
      status: row.status,
      priority: row.priority || "Medium",
      start_date: (row as any).start_date || "",
      due_date: row.due_date || "",
    });
    setError("");
    setMessage("");
    setShowModal(true);
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault();
    if (!profile || !form.title.trim()) return;

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      owner_id: form.owner_id || null,
      reviewer_id: form.reviewer_id || null,
      frequency: form.frequency.trim() || null,
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };

    try {
      const response = await fetch(
        editingId ? `/api/activities/${editingId}` : "/api/activities",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save activity.");
      }

      setMessage(editingId ? "Activity updated successfully." : "Activity created successfully.");
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save activity.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(id: string) {
    if (!canDelete || !window.confirm("Delete this compliance activity?")) {
      return;
    }

    setDeleting(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete activity.");
      }

      setMessage("Activity deleted successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete activity.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppShell requiredPermission="activities">
      <main className="max-w-7xl mx-auto">
        <a href="/dashboard" className="text-sm text-gray-500">
          ← Dashboard
        </a>

        <div className="flex justify-between items-end mt-5 mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Compliance Activities</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track recurring compliance work, ownership and due dates.
            </p>
          </div>

          {canCreate && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm flex items-center gap-2"
            >
              <Plus size={16} />
              New Activity
            </button>
          )}
        </div>

        {(message || error) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
              error
                ? "bg-red-50 border-red-100 text-red-700"
                : "bg-green-50 border-green-100 text-green-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex flex-wrap gap-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="border rounded-lg pl-9 pr-3 py-2 w-72 text-sm"
                placeholder="Search activities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Loading activities…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-sm font-medium">No activities found</div>
              <p className="text-sm text-gray-500 mt-1">
                {rows.length === 0
                  ? "Create your first compliance activity."
                  : "Try changing your search or filters."}
              </p>
              {rows.length === 0 && canCreate && (
                <button
                  onClick={openCreate}
                  className="mt-4 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm"
                >
                  Create Activity
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th className="w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="font-medium text-gray-900">{row.title}</div>
                        {(row as any).frequency && (
                          <div className="text-xs text-gray-400 mt-1">
                            {(row as any).frequency}
                          </div>
                        )}
                      </td>
                      <td>{row.category}</td>
                      <td>{row.owner?.full_name || "Unassigned"}</td>
                      <td>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                          {row.status}
                        </span>
                      </td>
                      <td>{row.priority || "Medium"}</td>
                      <td>{row.due_date || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(row)}
                              title="Edit"
                              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => deleteActivity(row.id)}
                              disabled={deleting === row.id}
                              title="Delete"
                              className="p-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-50"
                            >
                              {deleting === row.id ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b">
                <div>
                  <h2 className="text-lg font-semibold">
                    {editingId ? "Edit Activity" : "New Compliance Activity"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Define the compliance task, owner and schedule.
                  </p>
                </div>
                <button
                  onClick={() => !saving && setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveActivity} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Activity title" required>
                    <input
                      required
                      className="field"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Quarterly access review"
                    />
                  </Field>

                  <Field label="Category" required>
                    <select
                      className="field"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    className="field min-h-24"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the compliance work and expected outcome."
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Owner">
                    <select
                      className="field"
                      value={form.owner_id}
                      onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || "Unnamed user"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Reviewer">
                    <select
                      className="field"
                      value={form.reviewer_id}
                      onChange={(e) => setForm({ ...form, reviewer_id: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || "Unnamed user"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Field label="Status">
                    <select
                      className="field"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value as ActivityStatus })
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      className="field"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    >
                      {PRIORITIES.map((priority) => (
                        <option key={priority}>{priority}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Frequency">
                    <select
                      className="field"
                      value={form.frequency}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    >
                      <option value="">One-time</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Annually</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start date">
                    <input
                      type="date"
                      className="field"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </Field>

                  <Field label="Due date">
                    <input
                      type="date"
                      className="field"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.title.trim()}
                    className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
                  >
                    {saving && <Loader2 size={15} className="animate-spin" />}
                    {editingId ? "Save Changes" : "Create Activity"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <style jsx>{`
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          th,
          td {
            text-align: left;
            padding: 14px 16px;
            border-bottom: 1px solid #eee;
            white-space: nowrap;
          }
          th {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .field {
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 9px 11px;
            font-size: 14px;
            outline: none;
          }
          .field:focus {
            box-shadow: 0 0 0 2px #e5e7eb;
          }
          textarea.field {
            resize: vertical;
          }
        `}</style>
      </main>
    </AppShell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
