import * as React from "react";

export type TaskStatus = "Not Started" | "In Progress" | "Pending Review" | "Completed" | "Overdue" | "Cancelled";
export type TaskPriority = "Critical" | "High" | "Medium" | "Low";
export type TaskTypeOption = { id: string; name: string };
export type TaskCategoryOption = { id: string; name: string };

type Props = {
  taskTypeId: string; setTaskTypeId: (value: string) => void;
  categoryId: string; setCategoryId: (value: string) => void;
  status: TaskStatus; setStatus: (value: TaskStatus) => void;
  priority: TaskPriority; setPriority: (value: TaskPriority) => void;
  dueDate: string; setDueDate: (value: string) => void;
  taskTypes: TaskTypeOption[]; categories: TaskCategoryOption[]; disabled?: boolean;
};

const statuses: TaskStatus[] = ["Not Started", "In Progress", "Pending Review", "Completed", "Overdue", "Cancelled"];
const priorities: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

export function TaskFormControls({ taskTypeId, setTaskTypeId, categoryId, setCategoryId, status, setStatus, priority, setPriority, dueDate, setDueDate, taskTypes, categories, disabled = false }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div><label htmlFor="task-type" className="mb-1.5 block text-sm font-medium">Type</label><select id="task-type" value={taskTypeId} onChange={e => setTaskTypeId(e.target.value)} disabled={disabled} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">Select type</option>{taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div><label htmlFor="task-category" className="mb-1.5 block text-sm font-medium">Category</label><select id="task-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={disabled} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label htmlFor="task-status" className="mb-1.5 block text-sm font-medium">Status</label><select id="task-status" value={status} onChange={e => setStatus(e.target.value as TaskStatus)} disabled={disabled} className="h-10 w-full rounded-md border bg-white px-3 text-sm">{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      <div><label htmlFor="task-priority" className="mb-1.5 block text-sm font-medium">Priority</label><select id="task-priority" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} disabled={disabled} className="h-10 w-full rounded-md border bg-white px-3 text-sm">{priorities.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
      <div><label htmlFor="task-due-date" className="mb-1.5 block text-sm font-medium">Due date</label><input id="task-due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={disabled} className="h-10 w-full rounded-md border bg-white px-3 text-sm" /><p className="mt-1 text-xs text-slate-500">Select the task due date from the calendar.</p></div>
    </div>
  );
}
