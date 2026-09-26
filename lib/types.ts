export type ActivityStatus="Not Started"|"In Progress"|"Pending Review"|"Completed"|"Overdue"|"Cancelled";
export type ActivityPriority="Critical"|"High"|"Medium"|"Low";
export type Severity="Critical"|"High"|"Medium"|"Low"|"Informational";
export type Activity={id:string;title:string;description?:string|null;task_type:string;task_type_id:string|null;category:string;category_id:string|null;status:ActivityStatus;priority:ActivityPriority;owner_id:string|null;reviewer_id:string|null;frequency:string|null;start_date:string|null;due_date:string|null;completed_at:string|null;created_at:string;updated_at:string;};
export type Vulnerability={id:string;title:string;cve?:string|null;severity:Severity;status:string;due_date?:string|null;asset?:{name:string}|null};
