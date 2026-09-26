"use client";

import AppShell from "@/components/app-shell";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { can } from "@/lib/rbac";

interface Category { id: string; name: string; description: string | null; is_active: boolean; }
interface Activity { id: string; title: string; category: string; category_id: string | null; status: string; priority: string; due_date: string | null; }

export default function Activities() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError("");
    const { profile } = await getCurrentProfile();
    setRole(profile?.role || "");
    const sb = createClient();
    const [activities, cats] = await Promise.all([
      sb.from("compliance_activities").select("id,title,category,category_id,status,priority,due_date").order("due_date"),
      fetch("/api/activity-categories", { cache: "no-store" }).then(r => r.json()),
    ]);
    if (activities.error) setError(activities.error.message);
    setRows((activities.data || []) as Activity[]);
    if (cats.error) setError(cats.error); else setCategories(cats.categories || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    const text = `${r.title} ${r.category} ${r.status} ${r.priority}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (!categoryFilter || r.category_id === categoryFilter);
  }), [rows, search, categoryFilter]);

  function openNew() {
    setTitle(""); setDescription(""); setCategoryId(categories.find(c => c.is_active)?.id || ""); setError(""); setModalOpen(true);
  }

  async function createActivity() {
    if (!title.trim() || !categoryId) return;
    const selected = categories.find(c => c.id === categoryId);
    if (!selected) return;
    setSaving(true); setError("");
    const sb = createClient();
    const { profile } = await getCurrentProfile();
    if (!profile) { setError("Your AuditOps profile could not be found."); setSaving(false); return; }
    const { error: insertError } = await sb.from("compliance_activities").insert({
      organization_id: profile.organization_id,
      title: title.trim(),
      description: description.trim() || null,
      category: selected.name,
      category_id: selected.id,
    });
    if (insertError) { setError(insertError.message); setSaving(false); return; }
    setModalOpen(false); setSaving(false); await load();
  }

  const canCreate = can(role, "activities") && role !== "Auditor / Read Only";

  return <AppShell requiredPermission="activities">
    <main className="max-w-6xl mx-auto">
      <a href="/dashboard" className="text-sm text-gray-500">← Dashboard</a>
      <div className="flex justify-between items-end mt-5 mb-6">
        <div><h1 className="text-2xl font-semibold">Compliance Activities</h1><p className="text-sm text-gray-500 mt-1">Track recurring compliance work, ownership and due dates.</p></div>
        {canCreate && <button onClick={openNew} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> New Activity</button>}
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="border rounded-lg pl-9 pr-3 py-2 w-72 text-sm" placeholder="Search activities..."/></div>
          <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (Inactive)" : ""}</option>)}</select>
        </div>
        <div className="overflow-x-auto">{loading ? <div className="p-8 text-sm text-gray-500">Loading activities...</div> : filtered.length === 0 ? <div className="p-8 text-sm text-gray-500">No activities found.</div> : <table className="w-full"><thead><tr><th>Activity</th><th>Category</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.title}</td><td>{r.category}</td><td>{r.status}</td><td>{r.priority}</td><td>{r.due_date || "—"}</td></tr>)}</tbody></table>}</div>
      </div>
      <style jsx>{`table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:14px 16px;border-bottom:1px solid #eee}th{font-size:12px;color:#6b7280;text-transform:uppercase}`}</style>
    </main>

    {modalOpen && <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-xl border shadow-xl w-full max-w-lg"><div className="flex items-center justify-between p-5 border-b"><h2 className="font-semibold">New Compliance Activity</h2><button onClick={()=>setModalOpen(false)}><X size={18}/></button></div><div className="p-5 space-y-4"><div><label className="block text-sm font-medium mb-1">Activity name</label><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Quarterly access review"/></div><div><label className="block text-sm font-medium mb-1">Category</label><select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select category</option>{categories.filter(c=>c.is_active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><p className="text-xs text-gray-400 mt-1">Add or manage categories from Settings → Activity Categories.</p></div><div><label className="block text-sm font-medium mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>{error && <div className="text-sm text-red-600">{error}</div>}</div><div className="p-5 border-t flex justify-end gap-2"><button onClick={()=>setModalOpen(false)} className="border rounded-lg px-4 py-2 text-sm">Cancel</button><button disabled={saving || !title.trim() || !categoryId} onClick={createActivity} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? "Creating..." : "Create Activity"}</button></div></div></div>}
  </AppShell>;
}
