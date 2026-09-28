"use client";
import AppShell from "@/components/app-shell";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { can } from "@/lib/rbac";

interface Option { id:string; name:string; description:string|null; is_active:boolean; }
interface Activity { id:string; title:string; description:string|null; task_type:string; task_type_id:string|null; category:string; category_id:string|null; status:string; priority:string; owner_id:string|null; reviewer_id:string|null; frequency:string|null; start_date:string|null; due_date:string|null; completed_at:string|null; }
const STATUS = ["Not Started","In Progress","Pending Review","Completed","Overdue","Cancelled"];
const PRIORITY = ["Critical","High","Medium","Low"];

export default function Activities(){
  const [rows,setRows]=useState<Activity[]>([]),[categories,setCategories]=useState<Option[]>([]),[types,setTypes]=useState<Option[]>([]),[role,setRole]=useState(""),[search,setSearch]=useState(""),[statusFilter,setStatusFilter]=useState(""),[priorityFilter,setPriorityFilter]=useState(""),[categoryFilter,setCategoryFilter]=useState(""),[typeFilter,setTypeFilter]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[savingRow,setSavingRow]=useState<string|null>(null),[title,setTitle]=useState(""),[taskTypeId,setTaskTypeId]=useState(""),[categoryId,setCategoryId]=useState(""),[status,setStatus]=useState("Not Started"),[priority,setPriority]=useState("Medium"),[description,setDescription]=useState(""),[startDate,setStartDate]=useState(""),[dueDate,setDueDate]=useState("");

  async function load(){
    setLoading(true);setError("");
    const {profile}=await getCurrentProfile();setRole(profile?.role||"");
    const sb=createClient();
    const [a,c,t]=await Promise.all([
      sb.from("compliance_activities").select("id,title,description,task_type,task_type_id,category,category_id,status,priority,owner_id,reviewer_id,frequency,start_date,due_date,completed_at").order("due_date",{ascending:true,nullsFirst:false}),
      fetch("/api/activity-categories",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/task-types",{cache:"no-store"}).then(r=>r.json())
    ]);
    if(a.error)setError(a.error.message);setRows((a.data||[]) as Activity[]);
    if(c.error)setError(c.error);else setCategories(c.categories||[]);
    if(t.error)setError(t.error);else setTypes(t.taskTypes||[]);
    setLoading(false)
  }
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>rows.filter(r=>{
    const text=`${r.title} ${r.task_type} ${r.category} ${r.status} ${r.priority}`.toLowerCase();
    return text.includes(search.toLowerCase())&&(!statusFilter||r.status===statusFilter)&&(!priorityFilter||r.priority===priorityFilter)&&(!categoryFilter||r.category_id===categoryFilter)&&(!typeFilter||r.task_type_id===typeFilter)
  }),[rows,search,statusFilter,priorityFilter,categoryFilter,typeFilter]);

  function openNew(){setTitle("");setTaskTypeId(types.find(x=>x.is_active)?.id||"");setCategoryId(categories.find(x=>x.is_active)?.id||"");setStatus("Not Started");setPriority("Medium");setDescription("");setStartDate("");setDueDate("");setError("");setOpen(true)}

  async function createTask(){
    if(!title.trim()||!taskTypeId||!categoryId)return;
    const type=types.find(x=>x.id===taskTypeId),cat=categories.find(x=>x.id===categoryId);if(!type||!cat)return;
    setSaving(true);setError("");const {profile}=await getCurrentProfile();
    if(!profile){setError("Your AuditOps profile could not be found.");setSaving(false);return}
    const sb=createClient();
    const {error:e}=await sb.from("compliance_activities").insert({organization_id:profile.organization_id,title:title.trim(),description:description.trim()||null,task_type:type.name,task_type_id:type.id,category:cat.name,category_id:cat.id,status,priority,start_date:startDate||null,due_date:dueDate||null});
    if(e){setError(e.message);setSaving(false);return}setOpen(false);setSaving(false);await load()
  }

  async function updateInline(id:string, patch:Partial<Activity>){
    setSavingRow(id);setError("");
    const sb=createClient();
    const current=rows.find(r=>r.id===id);if(!current){setSavingRow(null);return}
    const next={...current,...patch};
    const type=types.find(x=>x.id===next.task_type_id);
    const cat=categories.find(x=>x.id===next.category_id);
    const payload={
      task_type:type?.name ?? next.task_type,
      task_type_id:next.task_type_id||null,
      category:cat?.name ?? next.category,
      category_id:next.category_id||null,
      status:next.status,
      priority:next.priority,
      due_date:next.due_date||null,
    };
    const {data,error:e}=await sb.from("compliance_activities").update(payload).eq("id",id).select("id,title,description,task_type,task_type_id,category,category_id,status,priority,owner_id,reviewer_id,frequency,start_date,due_date,completed_at").single();
    if(e){setError(e.message);setSavingRow(null);return}
    setRows(prev=>prev.map(r=>r.id===id?(data as Activity):r));
    setSavingRow(null);
  }

  const canCreate=can(role,"activities")&&role!=="Auditor / Read Only";
  const cellSelect="w-full min-w-[120px] rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-slate-300 hover:bg-white focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60";
  const cellDate="w-full min-w-[125px] rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-slate-300 hover:bg-white focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60";

  return <AppShell requiredPermission="activities"><main className="max-w-7xl mx-auto">
    <a href="/dashboard" className="text-sm text-gray-500">← Dashboard</a>
    <div className="flex justify-between items-end mt-5 mb-6"><div><h1 className="text-2xl font-semibold">Tasks</h1><p className="text-sm text-gray-500 mt-1">Manage compliance tasks, change requests and reviews.</p></div>{canCreate&&<button onClick={openNew} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> New Task</button>}</div>
    {error&&<div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="p-4 border-b flex flex-wrap gap-3">
        <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="border rounded-lg pl-9 pr-3 py-2 w-64 text-sm" placeholder="Search tasks..."/></div>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All types</option>{types.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All categories</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All statuses</option>{STATUS.map(x=><option key={x}>{x}</option>)}</select>
        <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All priorities</option>{PRIORITY.map(x=><option key={x}>{x}</option>)}</select>
      </div>
      {loading?<div className="p-8 text-sm text-gray-500">Loading tasks...</div>:filtered.length===0?<div className="p-8 text-sm text-gray-500">No tasks found.</div>:<div className="overflow-x-auto"><table className="w-full"><thead><tr><th>Task</th><th>Type</th><th>Category</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="hover:bg-gray-50"><td><Link href={`/activities/${r.id}`} className="font-medium text-slate-900 hover:underline">{r.title}</Link></td><td><select disabled={!canCreate||savingRow===r.id} value={r.task_type_id||""} onChange={e=>updateInline(r.id,{task_type_id:e.target.value})} className={cellSelect} title="Task type"><option value="">Select type</option>{types.filter(x=>x.is_active||x.id===r.task_type_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></td><td><select disabled={!canCreate||savingRow===r.id} value={r.category_id||""} onChange={e=>updateInline(r.id,{category_id:e.target.value})} className={cellSelect} title="Category"><option value="">Select category</option>{categories.filter(x=>x.is_active||x.id===r.category_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></td><td><select disabled={!canCreate||savingRow===r.id} value={r.status} onChange={e=>updateInline(r.id,{status:e.target.value})} className={cellSelect} title="Status">{STATUS.map(x=><option key={x}>{x}</option>)}</select></td><td><select disabled={!canCreate||savingRow===r.id} value={r.priority} onChange={e=>updateInline(r.id,{priority:e.target.value})} className={cellSelect} title="Priority">{PRIORITY.map(x=><option key={x}>{x}</option>)}</select></td><td><input disabled={!canCreate||savingRow===r.id} type="date" value={r.due_date||""} onChange={e=>updateInline(r.id,{due_date:e.target.value})} className={cellDate} title="Due date"/></td></tr>)}</tbody></table></div>}
    </div>
    <style jsx>{`table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 16px;border-bottom:1px solid #eee}th{font-size:12px;color:#6b7280;text-transform:uppercase;white-space:nowrap}`}</style>
  </main>
  {open&&<div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50 overflow-y-auto"><div className="bg-white rounded-xl border shadow-xl w-full max-w-2xl my-8"><div className="flex items-center justify-between p-5 border-b"><h2 className="font-semibold">New Task</h2><button onClick={()=>setOpen(false)}><X size={18}/></button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Task name</label><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Quarterly access review"/></div><div><label className="block text-sm font-medium mb-1">Task type</label><select value={taskTypeId} onChange={e=>setTaskTypeId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select type</option>{types.filter(x=>x.is_active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Category</label><select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select category</option>{categories.filter(x=>x.is_active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Status</label><select value={status} onChange={e=>setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{STATUS.map(x=><option key={x}>{x}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Priority</label><select value={priority} onChange={e=>setPriority(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{PRIORITY.map(x=><option key={x}>{x}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Start date</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></div><div><label className="block text-sm font-medium mb-1">Due date</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></div><div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>{error&&<div className="md:col-span-2 text-sm text-red-600">{error}</div>}</div><div className="p-5 border-t flex justify-end gap-2"><button onClick={()=>setOpen(false)} className="border rounded-lg px-4 py-2 text-sm">Cancel</button><button disabled={saving||!title.trim()||!taskTypeId||!categoryId} onClick={createTask} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50">{saving?"Creating...":"Create Task"}</button></div></div></div>}
  </AppShell>
}
