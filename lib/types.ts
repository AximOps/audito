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

  // Task type
  task_type: string;
  task_type_id: string | null;

  // Task category
  category: string;
  category_id: string | null;

  // Task status and priority
  status: ActivityStatus;
  priority: ActivityPriority;

  // Assignment
  owner_id: string | null;
  reviewer_id: string | null;

  // Supabase relationships
  owner?: {
    full_name: string | null;
  } | null;

  reviewer?: {
    full_name: string | null;
  } | null;

  // Scheduling
  frequency: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;

  created_at: string;
  updated_at: string;
};