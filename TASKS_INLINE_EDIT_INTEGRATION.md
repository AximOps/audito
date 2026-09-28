# Tasks Inline Editing Fix

The screenshot shows the requirement is for the **task list rows themselves** to expose the controls, not only the New/Edit Task form.

Replace the current static Type, Category, Status, Priority and Due cells in each task row with:

```tsx
<InlineTaskEditableCells
  task={task}
  taskTypes={taskTypes}
  categories={categories}
  disabled={readOnly}
  onUpdate={async (taskId, patch) => {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error ?? "Unable to update task.");
    }

    // Refresh/revalidate the existing task list here.
    await loadTasks();
  }}
/>
```

The component intentionally uses the existing task PATCH endpoint and does not create a new API contract.

### Result

The list will show:

- Type → clickable dropdown in the row
- Category → clickable dropdown in the row
- Status → clickable dropdown in the row
- Priority → clickable dropdown in the row
- Due → calendar picker in the row

The existing filter dropdowns at the top remain unchanged.

The controls use transparent styling until hovered/focused so the table retains the current visual design.
