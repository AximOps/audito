# AuditOps Tasks Inline Dropdown Fix v2

Replace `app/activities/page.tsx` with the included file.

The task table itself now renders native controls in every row: Type, Category, Status and Priority are `<select>` dropdowns and Due is an `<input type="date">` calendar picker. Changes are saved immediately through the existing Supabase `compliance_activities` update path.

This specifically fixes the issue where controls existed only inside the task edit screen.
