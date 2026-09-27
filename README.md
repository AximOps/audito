# AuditOps Tasks + Subscription Enforcement

Overlay patch for the existing AuditOps Tasks module.

## Included

- Server-side active-task usage calculation.
- FREE / Standard / Pro / Enterprise active-task limits from the existing centralized subscription configuration.
- Server-side recurring-task feature gate.
- Server-side automated-reminder feature gate.
- `GET /api/tasks/subscription` for usage/capability information.
- `POST /api/tasks/subscription` for feature validation.
- Integration instructions for the existing task create/update APIs.

## Plan behavior

| Plan | Active Tasks | Recurring Tasks | Automated Reminders |
|---|---:|---|---|
| FREE | 25 | No | No |
| Standard | 250 | Yes | Yes |
| Pro | 2,500 | Yes | Yes |
| Enterprise | Unlimited | Yes | Yes |

## Important

The existing Tasks API is intentionally not overwritten because its current source was not available as a complete project tree when this overlay was prepared. Apply the small integration block in `TASK_ROUTE_INTEGRATION.md` to the existing task POST/PATCH handlers. This avoids replacing unrelated task/RBAC functionality.

No database migration is required.
