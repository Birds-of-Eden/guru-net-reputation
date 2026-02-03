// app/components/agent-task-dashboard-ui.tsx

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

//
// ---------- Types ----------
//
export interface TaskCounts {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  reassigned: number;
  qc_approved: number;
}

export interface PackageLite {
  id: string;
  name: string;
}

export interface ClientData {
  id: string;
  name: string;
  company: string | null;
  designation: string | null;
  location: string | null;
  avatar: string | null;
  status: string | null;
  websites?: string[] | null;

  // Overall (DB-saved) progress:
  progress: number;

  // Optional agent-scoped fields coming from API:
  agentProgress?: number;
  agentTaskCounts?: Partial<TaskCounts>;

  // Overall counts (some APIs already send this; keep optional to be safe):
  taskCounts?: Partial<TaskCounts>;

  package: PackageLite | null;
}

export interface AgentDashboardProps {
  agentId: string | undefined;
}

export interface GlobalTimerLock {
  isLocked: boolean;
  taskId: string | null;
  agentId: string | null;
  taskName: string | null;
}

//
// ---------- Safe helpers ----------
//
export const EMPTY_COUNTS: TaskCounts = {
  total: 0,
  pending: 0,
  in_progress: 0,
  completed: 0,
  overdue: 0,
  cancelled: 0,
  reassigned: 0,
  qc_approved: 0,
};

export function mergeCounts(partial?: Partial<TaskCounts>): TaskCounts {
  return {
    total: partial?.total ?? 0,
    pending: partial?.pending ?? 0,
    in_progress: partial?.in_progress ?? 0,
    completed: partial?.completed ?? 0,
    overdue: partial?.overdue ?? 0,
    cancelled: partial?.cancelled ?? 0,
    reassigned: partial?.reassigned ?? 0,
    qc_approved: partial?.qc_approved ?? 0,
  };
}

export function pickCounts(c: ClientData): TaskCounts {
  // Priority: taskCounts -> agentTaskCounts -> EMPTY
  if (c.taskCounts) return mergeCounts(c.taskCounts);
  if (c.agentTaskCounts) return mergeCounts(c.agentTaskCounts);
  return EMPTY_COUNTS;
}

export function pickProgress(c: ClientData): number {
  // Always use agent-specific progress or compute from agent's task counts
  if (typeof c.agentProgress === "number") return c.agentProgress;

  const counts = pickCounts(c);
  if (counts.total > 0) {
    // Consider both completed and qc_approved tasks as completed for progress
    const completedCount = counts.completed + counts.qc_approved;
    return Math.round((completedCount / counts.total) * 100);
  }

  // Fallback to overall progress only if no agent-specific tasks exist
  return typeof c.progress === "number" ? c.progress : 0;
}

export function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

//
// ---------- Small UI helpers ----------
//
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card
      className={classNames(
        "relative overflow-hidden border-0 shadow-lg text-white",
        `bg-linear-to-br ${gradient}`
      )}
    >
      <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-white/90">
          {title}
        </CardTitle>
        <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-bold text-white">{value}</div>
        {subtitle && <p className="text-xs text-white/90 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function EmptyClients() {
  return (
    <div className="col-span-full text-center py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Activity className="h-8 w-8 text-gray-400" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-50">
            No clients found
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      </div>
    </div>
  );
}

export function StatusChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?:
    | "default"
    | "success"
    | "warn"
    | "danger"
    | "neutral"
    | "muted"
    | "pink"
    | "sky";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : tone === "warn"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : tone === "danger"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : tone === "neutral"
      ? "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
      : tone === "muted"
      ? "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
      : tone === "pink"
      ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
      : tone === "sky"
      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

  return (
    <div
      className={classNames(
        "rounded-xl px-3 py-2 text-sm font-medium flex items-center justify-between",
        toneClass
      )}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2">{value}</span>
    </div>
  );
}

export function Pill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?:
    | "default"
    | "success"
    | "warn"
    | "danger"
    | "neutral"
    | "muted"
    | "pink"
    | "sky";
}) {
  const map: Record<string, string> = {
    default: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    success:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    warn: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    neutral: "bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
    muted:
      "bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    pink: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  };
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
        map[tone]
      )}
    >
      {label}: {value}
    </span>
  );
}
