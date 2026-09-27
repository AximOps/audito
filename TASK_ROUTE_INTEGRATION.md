# Tasks subscription enforcement integration

This overlay adds reusable server-side enforcement for the existing `compliance_activities` task module.

## 1. Active task counting

`lib/task-subscription-enforcement.ts` counts these statuses as active:

- Not Started
- In Progress
- Pending Review
- Overdue

Completed and Cancelled tasks do not consume the active-task allowance.

## 2. Enforce task capacity in the existing task-create API

At the beginning of the existing POST task-create handler, after the organization has been resolved and authorized, call:

```ts
import {
  requireTaskCapacity,
  taskSubscriptionErrorResponse,
} from "@/lib/task-subscription-enforcement";

try {
  await requireTaskCapacity(organizationId, 1);
} catch (error) {
  const response = taskSubscriptionErrorResponse(error);
  if (response) {
    return NextResponse.json(response.body, { status: response.status });
  }
  throw error;
}
```

This prevents creation of a new active task after the organization's active-task allowance is reached.

## 3. Important: only count a task against the limit when it is active

If the existing task API allows creation directly in `Completed` or `Cancelled` status, use:

```ts
if (!["Completed", "Cancelled"].includes(status)) {
  await requireTaskCapacity(organizationId, 1);
}
```

When changing an existing task from Completed/Cancelled to an active status, perform the same check before the update.

Do not run the capacity check when changing one active status to another active status.

## 4. Recurring tasks

Before creating or enabling a recurring task:

```ts
import { requireTaskFeature } from "@/lib/task-subscription-enforcement";
await requireTaskFeature(organizationId, "recurringTasks");
```

Included plans:

- Standard
- Pro
- Enterprise

Not included:

- FREE

## 5. Automated reminders

Before enabling an automated task reminder:

```ts
await requireTaskFeature(organizationId, "automatedReminders");
```

Included plans:

- Standard
- Pro
- Enterprise

## 6. Usage endpoint

`GET /api/tasks/subscription` returns current task usage and plan information.

`POST /api/tasks/subscription` accepts:

```json
{ "feature": "recurringTasks" }
```

or:

```json
{ "feature": "automatedReminders" }
```

The endpoint is intended for UI capability checks. The actual task-create/update APIs must still enforce the rules server-side.

## 7. No database migration

This overlay does not add a new task table or alter `compliance_activities`. It uses the existing task statuses and `organization_id`.
