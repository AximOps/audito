# Tasks Form Controls Fix

Add `components/tasks/task-form-controls.tsx` to the existing New Task/Edit Task form.

It provides dropdowns for Type, Category, Status and Priority, plus a native calendar picker for Due date.

Example:

```tsx
<TaskFormControls
  taskTypeId={taskTypeId}
  setTaskTypeId={setTaskTypeId}
  categoryId={categoryId}
  setCategoryId={setCategoryId}
  status={status}
  setStatus={setStatus}
  priority={priority}
  setPriority={setPriority}
  dueDate={dueDate}
  setDueDate={setDueDate}
  taskTypes={taskTypes}
  categories={categories}
/>
```

No database migration is required. Keep the existing API payload and data-loading logic.
