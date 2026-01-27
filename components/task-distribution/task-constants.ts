import { Users, Globe, Building2 } from "lucide-react";

// Flatter, minimal color tokens (no gradients) to match the new UI
export const priorityColors = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
};

export const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

export const statusColors = {
  pending: "bg-slate-50 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  qc_approved: "bg-purple-50 text-purple-700 border-purple-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-gray-50 text-gray-700 border-gray-200",
  reassigned: "bg-amber-50 text-amber-700 border-amber-200",
};

export const siteTypeIcons = {
  social_site: Users,
  web2_site: Globe,
  other_asset: Building2,
};

export const siteTypeColors = {
  social_site: "bg-indigo-50 text-indigo-700 border-indigo-200",
  web2_site: "bg-sky-50 text-sky-700 border-sky-200",
  other_asset: "bg-slate-50 text-slate-700 border-slate-200",
};
