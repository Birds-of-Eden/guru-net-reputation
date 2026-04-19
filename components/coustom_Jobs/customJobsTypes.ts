// ================================
// FILE: components/custom-jobs/types.ts
// ================================
export type CustomJob = {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  amId?: string;
  amName?: string;
  name: string;
  assignedToId?: string | null;
  assignedToName?: string;
  issueStatus?: string;
  qcStatus?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status:
    | "requested"
    | "approved"
    | "pending"
    | "in_progress"
    | "paused"
    | "completed"
    | "overdue"
    | "cancelled"
    | "reassigned"
    | "qc_approved"
    | "data_entered";
  notes?: string;
  link?: string;
  createdAt?: string;
  updatedAt?: string;
  taskCompletionJson?: {
    count?: number;
    links?: string;
    link?: string;
  };
};

export type ClientOption = {
  id: string;
  name: string;
  company?: string;
};

export type UserOption = {
  id: string;
  name: string;
  email?: string;
  category?: string;
  image?: string | null;
};
