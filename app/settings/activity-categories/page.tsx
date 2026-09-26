"use client";

import AppShell from "@/components/app-shell";
import { useEffect, useState } from "react";
import { Plus, Pencil, Power, Trash2, X } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { can } from "@/lib/rbac";

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function ActivityCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    setLoading(true);
    const { profile } = await getCurrentProfile();
    setRole(profile?.role || "");
    const res = await fetch("/api/activity-categories", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Unable to load categories.");
    else setCategories(json.categories || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setName(""); setDescription(""); setError(""); setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category); setName(category.name); setDescription(category.description || ""); setError(""); setModalOpen(true);
  }

  async function save() {
    setSaving(true); setError("");
    const res = await fetch(editing ? `/api/activity-categories/${editing.id}` : "/api/activity-categories", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, ...(editing ? { is_active: editing.is_active } : {}) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Unable to save category."); setSaving(false); return; }
    setModalOpen(false); setSaving(false); await load();
  }

  async function toggle(category: Category) {
    const res = await fetch(`/api/activity-categories/${category.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: category.name, description: category.description || "", is_active: !category.is_active }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Unable to update category."); else await load();
  }

  async function remove(category: Category) {
    if (!window.confirm(`Delete “${category.name}”? Existing activities will keep their category name.`)) return;
    const res = await fetch(`/api/activity-categories/${category.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Unable to delete category."); else await load();
  }

  const filtered = categories.filter(c => `${c.name} ${c.description || ""}`.toLowerCase().includes(search.toLowerCase()));
  const canManage = can(role, "activityCategories");
  const canDelete = role === "Organization Admin";

  return (
    <AppShell requiredPermission="activityCategories">
      <div className="max-w-5xl mx-auto">
        <a href="/dashboard" className="text-sm text-gray-500">← Dashboard</a>
        <div className="flex justify-between items-end mt-5 mb-6">
          <div><h1 className="text-2xl font-semibold">Task Categories</h1><p className="text-sm text-gray-500 mt-1">Manage the categories available when creating Tasks.</p></div>
          {canManage && <button onClick={openNew} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> Add Category</button>}
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b"><input value={search} onChange={e=>setSearch(e.target.value)} className="border rounded-lg px-3 py-2 w-80 text-sm" placeholder="Search categories..." /></div>
          {loading ? <div className="p-8 text-sm text-gray-500">Loading categories...</div> : filtered.length === 0 ? <div className="p-8 text-sm text-gray-500">No categories found.</div> : (
            <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="text-left p-4">Category</th><th className="text-left p-4">Description</th><th className="text-left p-4">Status</th>{canManage && <th className="text-right p-4">Actions</th>}</tr></thead>
              <tbody>{filtered.map(c => <tr key={c.id} className="border-b last:border-0"><td className="p-4 font-medium">{c.name}</td><td className="p-4 text-gray-500">{c.description || "—"}</td><td className="p-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${c.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.is_active ? "Active" : "Inactive"}</span></td>{canManage && <td className="p-4"><div className="flex justify-end gap-1"><button title="Edit" onClick={()=>openEdit(c)} className="p-2 rounded-lg hover:bg-gray-100"><Pencil size={15}/></button><button title={c.is_active ? "Disable" : "Enable"} onClick={()=>toggle(c)} className="p-2 rounded-lg hover:bg-gray-100"><Power size={15}/></button>{canDelete && <button title="Delete" onClick={()=>remove(c)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15}/></button>}</div></td>}</tr>)}</tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-xl border shadow-xl w-full max-w-lg"><div className="flex items-center justify-between p-5 border-b"><h2 className="font-semibold">{editing ? "Edit Category" : "Add Category"}</h2><button onClick={()=>setModalOpen(false)}><X size={18}/></button></div><div className="p-5 space-y-4"><div><label className="block text-sm font-medium mb-1">Category name</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={100} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Security Awareness" /></div><div><label className="block text-sm font-medium mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="What activities belong in this category?" /></div>{error && <div className="text-sm text-red-600">{error}</div>}</div><div className="p-5 border-t flex justify-end gap-2"><button onClick={()=>setModalOpen(false)} className="border rounded-lg px-4 py-2 text-sm">Cancel</button><button disabled={saving || !name.trim()} onClick={save} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? "Saving..." : editing ? "Save Changes" : "Create Category"}</button></div></div></div>}
    </AppShell>
  );
}
