import * as React from "react";

export type TaskStatus =
  | "Not Started"
  | "In Progress"
  | "Pending Review"
  | "Completed"
  | "Overdue"
  | "Cancelled";

export type TaskPriority = "Critical" | "High" | "Medium" | "Low";

export type InlineTaskRow = {
  id: string;
  task_type_id?: string | null;
  category_id?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
};

export type InlineTaskType = { id: string; name: string };
export type InlineTaskCategory = { id: string; name: string };

type Props = {
  task: InlineTaskRow;
  taskTypes: InlineTaskType[];
  categories: InlineTaskCategory[];
  onUpdate: (
    taskId: string,
    patch: {
      task_type_id?: string | null;
      category_id?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      due_date?: string | null;
    }
  ) => Promise<void> | void;
  disabled?: boolean;
};

const statuses: TaskStatus[] = [
  "Not Started",
  "In Progress",
  "Pending Review",
  "Completed",
  "Overdue",
  "Cancelled",
];

const priorities: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

export function InlineTaskEditableCells({
  task,
  taskTypes,
  categories,
  onUpdate,
  disabled = false,
}: Props) {
  const [saving, setSaving] = React.useState<string | null>(null);

  const update = async (field: string, patch: Parameters<Props["onUpdate"]>[1]) => {
    try {
      setSaving(field);
      await onUpdate(task.id, patch);
    } finally {
      setSaving(null);
    }
  };

  const base =
    "h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm " +
    "hover:border-slate-300 hover:bg-white focus:border-slate-400 focus:bg-white focus:outline-none " +
    "disabled:cursor-not-allowed disabled:opacity-60";

  const typeName =
    taskTypes.find((item) => item.id === task.task_type_id)?.name ?? "";

  const categoryName =
    categories.find((item) => item.id === task.category_id)?.name ?? "";

  return (
    <>
      <td className="px-3 py-2">
        <select
          aria-label={`Task type for ${task.id}`}
          className={base}
          value={task.task_type_id ?? ""}
          disabled={disabled || saving === "type"}
          title={typeName || "Select task type"}
          onChange={(e) =>
            update("type", { task_type_id: e.target.value || null })
          }
        >
          <option value="">Select type</option>
          {taskTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-3 py-2">
        <select
          aria-label={`Task category for ${task.id}`}
          className={base}
          value={task.category_id ?? ""}
          disabled={disabled || saving === "category"}
          title={categoryName || "Select category"}
          onChange={(e) =>
            update("category", { category_id: e.target.value || null })
          }
        >
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-3 py-2">
        <select
          aria-label={`Task status for ${task.id}`}
          className={base}
          value={task.status}
          disabled={disabled || saving === "status"}
          onChange={(e) =>
            update("status", { status: e.target.value as TaskStatus })
          }
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </td>

      <td className="px-3 py-2">
        <select
          aria-label={`Task priority for ${task.id}`}
          className={base}
          value={task.priority}
          disabled={disabled || saving === "priority"}
          onChange={(e) =>
            update("priority", { priority: e.target.value as TaskPriority })
          }
        >
          {priorities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </td>

      <td className="px-3 py-2">
        <input
          aria-label={`Task due date for ${task.id}`}
          type="date"
          className={base}
          value={task.due_date ?? ""}
          disabled={disabled || saving === "due_date"}
          onChange={(e) =>
            update("due_date", { due_date: e.target.value || null })
          }
        />
      </td>
    </>
  );
}
