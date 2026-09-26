export type ActivityStatus="Not Started"|"In Progress"|"Pending Review"|"Completed"|"Overdue"|"Cancelled";
export type Severity="Critical"|"High"|"Medium"|"Low"|"Informational";
export type Activity={id:string;title:string;category:string;status:ActivityStatus;priority:string;due_date:string;owner?:{full_name:string}|null};
export type Vulnerability={id:string;title:string;cve?:string|null;severity:Severity;status:string;due_date?:string|null;asset?:{name:string}|null};
