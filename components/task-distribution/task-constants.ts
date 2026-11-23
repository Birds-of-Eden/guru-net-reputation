import { Users, Globe, Building2 } from "lucide-react";

// Flatter, minimal color tokens (no gradients) to match the new UI
export const priorityColors = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  urgent: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

export const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

export const statusColors = {
  pending: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  qc_approved: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  overdue: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  cancelled: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
  reassigned: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
};

export const siteTypeIcons = {
  social_site: Users,
  web2_site: Globe,
  other_asset: Building2,
};

export const siteTypeColors = {
  social_site: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  web2_site: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  other_asset: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
};
