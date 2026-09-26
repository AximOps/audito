export type ActivityStatus =
  | "Not Started"
  | "In Progress"
  | "Pending Review"
  | "Completed"
  | "Overdue"
  | "Cancelled";

export type ActivityPriority =
  | "Critical"
  | "High"
  | "Medium"
  | "Low";

export type Activity = {
  id: string;

  title: string;
  description?: string | null;

  task_type: string;
  task_type_id: string | null;

  category: string;
  category_id: string | null;

  status: ActivityStatus;
  priority: ActivityPriority;

  owner_id: string | null;
  reviewer_id: string | null;

  owner?: {
    full_name: string | null;
  } | null;

  reviewer?: {
    full_name: string | null;
  } | null;

  frequency: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;

  created_at: string;
  updated_at: string;
};


/**
 * Vulnerability
 *
 * Used by the dashboard and vulnerability management module.
 */
export type Vulnerability = {
  id: string;

  title: string;
  description?: string | null;

  cve: string | null;
  severity: string;
  status: string;

  due_date: string | null;

  asset_id?: string | null;

  asset?: {
    name: string | null;
  } | null;

  created_at?: string;
  updated_at?: string;
};