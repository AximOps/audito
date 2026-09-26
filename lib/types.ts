export type ActivityStatus="Not Started"|"In Progress"|"Pending Review"|"Completed"|"Overdue"|"Cancelled";
export type Severity="Critical"|"High"|"Medium"|"Low"|"Informational";
export type Activity={
  id:string;
  title:string;
  description?:string|null;
  category:string;
  status:ActivityStatus;
  priority:string;
  frequency?:string|null;
  start_date?:string|null;
  due_date:string|null;
  owner?:{id?:string;full_name:string|null}|null;
  reviewer?:{id?:string;full_name:string|null}|null;
};
export type Vulnerability={id:string;title:string;cve?:string|null;severity:Severity;status:string;due_date?:string|null;asset?:{name:string}|null};
