// components/shared/task-completion-info.tsx
// "Completed on … by …" and "QC approved on … by …" chips for a task.
// Renders nothing unless the task is completed or QC-approved.
"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Person = { name?: string | null; email?: string | null } | null | undefined;

export type TaskCompletionData = {
  status?: string | null;
  completedAt?: string | Date | null;
  assignedTo?: Person;
  qcReviewedAt?: string | null;
  qcReviewer?: Person;
};

const DONE = new Set(["completed", "complete", "done", "finished", "qc_approved", "approved"]);
const QC = new Set(["qc_approved", "approved"]);

const norm = (s?: string | null) => String(s ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const fmt = (d?: string | Date | null) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const who = (p: Person) => p?.name || p?.email || null;

export function TaskCompletionInfo({ task, className }: { task: TaskCompletionData; className?: string }) {
  const status = norm(task.status);
  if (!DONE.has(status)) return null;

  const completedOn = fmt(task.completedAt);
  const completedBy = who(task.assignedTo);
  const isQc = QC.has(status);
  const qcOn = fmt(task.qcReviewedAt);
  const qcBy = who(task.qcReviewer);

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          Completed{completedOn ? <> on <span className="font-semibold">{completedOn}</span></> : " (date not recorded)"}
          {completedBy && <> by <span className="font-semibold">{completedBy}</span></>}
        </span>
      </span>
      {isQc && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            QC approved{qcOn && <> on <span className="font-semibold">{qcOn}</span></>}
            {qcBy && <> by <span className="font-semibold">{qcBy}</span></>}
          </span>
        </span>
      )}
    </div>
  );
}
