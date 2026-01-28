// app/[role]/qc_tasks/QCReview.tsx

"use client";

import { useEffect, useMemo, useState, lazy, Suspense, memo } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCircle,
  ExternalLink,
  TrendingUp,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";

const TaskCard = lazy(() =>
  import("@/components/qc-review/task-card").then((m) => ({
    default: m.TaskCard,
  })),
);

/* =========================
   Skeletons
========================= */

const FilterSkeleton = memo(function FilterSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl rounded-2xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-200 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-10 bg-slate-200 rounded animate-pulse" />
    </div>
  );
});

const TaskCardSkeleton = memo(function TaskCardSkeleton() {
  return <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />;
});

/* =========================
   Types
========================= */

type AgentLite = {
  id: string;
  name: string | null;
  firstName?: string;
  lastName?: string;
  email: string;
  category?: string;
};

type ClientLite = { id: string; name: string; company?: string };
type CategoryLite = { id: string; name: string };

type Perf = "Excellent" | "Good" | "Average" | "Lazy";

type QCReviewBlob = {
  timerScore: number;
  keyword: number;
  contentQuality: number;
  image: number;
  seo: number;
  grammar: number;
  humanization: number;
  total: number;
  reviewerId?: string | null;
  reviewedAt?: string;
  notes?: string | null;
} | null;

export type QCScores = {
  keyword: number;
  contentQuality: number;
  image: number;
  seo: number;
  grammar: number;
  humanization: number;
};

type TaskRow = {
  id: string;
  name: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  completionLink: string | null;
  performanceRating: Perf | null;
  idealDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  completionPercentage: number;
  assignedTo: AgentLite | null;
  client: ClientLite | null;
  category: CategoryLite | null;
  assignment?: { template?: { name: string; package?: { name: string } } };
  templateSiteAsset?: { name: string; type: string };

  qcTotalScore?: number | null;
  qcReview?: QCReviewBlob;
};

/* =========================
   Helpers
========================= */

const defaultScores: QCScores = {
  keyword: 0,
  contentQuality: 0,
  image: 0,
  seo: 0,
  grammar: 0,
  humanization: 0,
};

const timerScoreFromRating = (r?: Perf | null) =>
  r === "Excellent"
    ? 70
    : r === "Good"
      ? 60
      : r === "Average"
        ? 50
        : r === "Lazy"
          ? 40
          : 0;

function derivePerformanceRating(
  ideal?: number | null,
  actual?: number | null,
): Perf | undefined {
  if (!ideal || !actual || ideal <= 0) return undefined;
  if (actual <= ideal * 0.9) return "Excellent";
  if (actual <= ideal * 0.95) return "Good";
  if (actual <= ideal) return "Average";
  return "Lazy";
}

/* =========================
   Data Fetchers (SWR)
========================= */

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
  return res.json();
};

function useTasks(params: URLSearchParams) {
  const key = `/api/tasks?${params.toString()}`;

  const {
    data = [],
    error,
    isLoading,
    mutate,
  } = useSWR<TaskRow[]>(key, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
    errorRetryCount: 3,
    errorRetryInterval: 2000,
  });

  return {
    tasks: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

function useAgents(qcSupervisorId: string | null) {
  const url = qcSupervisorId
    ? `/api/tasks/agents?qcSupervisorId=${encodeURIComponent(qcSupervisorId)}`
    : "/api/tasks/agents";

  const { data = [], error } = useSWR<AgentLite[]>(url, fetcher, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    refreshInterval: 0,
    dedupingInterval: 60000,
  });
  return { agents: data, error };
}

function useClients() {
  const { data, error } = useSWR("/api/clients", fetcher, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    refreshInterval: 0,
    dedupingInterval: 60000,
  });
  const clients: ClientLite[] = Array.isArray(data?.clients)
    ? data.clients
    : [];
  return { clients, error };
}

function useCategories() {
  const { data = [], error } = useSWR<CategoryLite[]>("/api/teams", fetcher, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    refreshInterval: 0,
    dedupingInterval: 60000,
  });
  return { categories: data, error };
}

/* =========================
   Virtual Task List
========================= */

const VirtualTaskList = memo(function VirtualTaskList({
  tasks,
  approvedMap,
  onApprove,
  onReject,
  qcScoresByTask,
  onChangeScores,
  defaultScores,
  setNotePreview,
}: {
  tasks: TaskRow[];
  approvedMap: Record<string, boolean>;
  onApprove: (task: TaskRow) => void;
  onReject: (task: TaskRow) => void;
  qcScoresByTask: Record<string, QCScores>;
  onChangeScores: (taskId: string, scores: QCScores) => void;
  defaultScores: QCScores;
  setNotePreview: (preview: { open: boolean; note: string; taskName: string }) => void;
}) {
  if (!tasks.length) return null;

  const renderTask = (task: TaskRow, index: number) => (
    <div
      key={task.id}
      className="animate-in fade-in-0 slide-in-from-bottom-4"
      style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
    >
      <Suspense fallback={<TaskCardSkeleton />}>
        <TaskCard
          task={task}
          approvedMap={approvedMap}
          onApprove={onApprove}
          onReject={onReject}
          setNotePreview={setNotePreview}
          scores={qcScoresByTask[task.id] ?? defaultScores}
          onChangeScores={(next) => onChangeScores(task.id, next)}
        />
      </Suspense>
    </div>
  );

  if (tasks.length > 10) {
    return (
      <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
        {tasks.map(renderTask)}
      </div>
    );
  }

  return <div className="space-y-4">{tasks.map(renderTask)}</div>;
});

/* =========================
   Component
========================= */

export const QCReview = memo(function QCReview({
  forceQcId,
}: {
  forceQcId?: string | null;
}) {
  // Filters
  const [agentId, setAgentId] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const debouncedQ = useDebounce(q, 300);

  const { user } = useUserSession();

  const rawRoleName =
    (user as any)?.role?.name ?? (user as any)?.roleName ?? "";
  const roleName = String(rawRoleName).toLowerCase?.() || "";

  // More robust QC detection: seeded roles use id/name = "qc"
  const isQC =
    (user as any)?.role?.id === "qc" ||
    roleName === "qc" ||
    roleName.includes("qc") ||
    roleName === "quality_controller" ||
    roleName === "quality control";

  // If forceQcId is provided (e.g. on qc/qc-review route), always use that
  const qcSupervisorId = forceQcId ?? (isQC ? (user as any)?.id || null : null);

  // Build query params (QC-only enforced here)
  const taskParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", "completed");

    if (agentId !== "all") params.set("assignedToId", agentId);
    if (clientId !== "all") params.set("clientId", clientId);
    if (categoryId !== "all") params.set("categoryId", categoryId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    // 🔐 QC-only: backend should respect this and return only
    // tasks whose assignedTo.qcId = qcSupervisorId
    if (qcSupervisorId) params.set("qcSupervisorId", qcSupervisorId);

    // Light default sorting
    params.set("sortBy", "activity");
    params.set("sortDir", "desc");
    params.set("limit", "250");

    return params;
  }, [agentId, clientId, categoryId, startDate, endDate, qcSupervisorId]);

  const {
    tasks,
    loading,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks(taskParams);
  const { agents } = useAgents(qcSupervisorId);
  const { clients } = useClients();
  const { categories } = useCategories();

  const [qcScoresByTask, setQcScoresByTask] = useState<
    Record<string, QCScores>
  >({});

  const [approvedMap, setApprovedMap] = useState<Record<string, boolean>>({});

  const [approveDialog, setApproveDialog] = useState<{
    open: boolean;
    task: TaskRow | null;
    loading: boolean;
  }>({ open: false, task: null, loading: false });

  const [notePreview, setNotePreview] = useState<{
    open: boolean;
    note: string;
    taskName: string;
  }>({ open: false, note: "", taskName: "" });

  const [qcNotes, setQcNotes] = useState<string>("");

  const [reassignDialog, setReassignDialog] = useState<{
    open: boolean;
    task: TaskRow | null;
    reassignNotes: string;
    loading: boolean;
  }>({ open: false, task: null, reassignNotes: "", loading: false });

  useEffect(() => {
    if (tasksError) {
      console.error("Tasks fetch error:", tasksError);
      toast.error("Failed to load tasks data.");
    }
  }, [tasksError]);

  // QC-only client-side safety net (if backend not yet filtered)
  const qcScopedTasks = useMemo(() => {
    if (!qcSupervisorId) return tasks;
    return tasks;
  }, [tasks, qcSupervisorId]);

  const filteredTasks = useMemo(() => {
    if (!debouncedQ.trim()) return qcScopedTasks;

    const needle = debouncedQ.toLowerCase();
    return qcScopedTasks.filter((t) => {
      const searchString = [
        t.name,
        t.notes ?? "",
        t.completionLink ?? "",
        t.assignedTo?.name ?? "",
        t.assignedTo?.email ?? "",
        t.client?.name ?? "",
        t.category?.name ?? "",
        t.assignment?.template?.name ?? "",
        t.templateSiteAsset?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchString.includes(needle);
    });
  }, [debouncedQ, qcScopedTasks]);

  const clearFilters = () => {
    setAgentId("all");
    setClientId("all");
    setCategoryId("all");
    setStartDate("");
    setEndDate("");
    setQ("");
  };

  // ✅ NEW: Bulk open completion links (from currently filtered tasks)
  const bulkCompletionLinks = useMemo(() => {
    // unique, non-empty, trimmed
    const set = new Set<string>();
    for (const t of filteredTasks) {
      const link = (t.completionLink ?? "").trim();
      if (link) set.add(link);
    }
    return Array.from(set);
  }, [filteredTasks]);

  const handleBulkOpenCompletionLinks = () => {
    if (!bulkCompletionLinks.length) {
      toast.info("No completion links found in the current list.");
      return;
    }

    // open each link in a new tab/window
    // Note: some browsers may block many popups; this still opens as many as allowed.
    let opened = 0;
    bulkCompletionLinks.forEach((url) => {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (w) opened++;
    });
  };

  const handleReassignTask = async () => {
    if (!reassignDialog.task) {
      toast.error("No task selected to reassign.");
      return;
    }

    setReassignDialog((p) => ({ ...p, loading: true }));
    try {
      const taskId = reassignDialog.task.id;
      const res = await fetch(`/api/tasks/${taskId}/reassign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAgentId: reassignDialog.task.assignedTo?.id ?? undefined,
          reassignNotes: reassignDialog.reassignNotes || "",
          reassignedById: (user as any)?.id,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to reassign task");
      }

      await res.json();

      // Activity log
      try {
        await fetch(`/api/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "task",
            entityId: taskId,
            action: "qc_reassigned",
            qcReassigned: true,
            reason: reassignDialog.reassignNotes || undefined,
            userId: (user as any)?.id,
            details: {
              taskName: reassignDialog.task.name,
              previousAgentId: reassignDialog.task.assignedTo?.id ?? null,
              previousAgentName:
                reassignDialog.task.assignedTo?.name ||
                reassignDialog.task.assignedTo?.email ||
                null,
              reassignNotes: reassignDialog.reassignNotes || null,
            },
          }),
        });
      } catch (logErr) {
        console.warn("Activity log (qc_reassigned) failed:", logErr);
      }

      toast.success(
        `Task "${reassignDialog.task.name}" re-assigned successfully.`,
      );
      setReassignDialog({
        open: false,
        task: null,
        reassignNotes: "",
        loading: false,
      });
      refetchTasks();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reassign task");
      setReassignDialog((p) => ({ ...p, loading: false }));
    }
  };

  const handleApprove = (task: TaskRow) => {
    setApproveDialog({ open: true, task, loading: false });
    setQcNotes("");
  };

  const handleApproveTask = async () => {
    if (!approveDialog.task) return;

    const sysRating =
      approveDialog.task.performanceRating ??
      derivePerformanceRating(
        approveDialog.task.idealDurationMinutes,
        approveDialog.task.actualDurationMinutes,
      );

    const finalRating: Perf =
      (sysRating as Perf | undefined) !== undefined
        ? (sysRating as Perf)
        : "Average";

    setApproveDialog((p) => ({ ...p, loading: true }));
    try {
      const scores = qcScoresByTask[approveDialog.task.id] ?? {
        ...defaultScores,
      };

      const total =
        Math.min(
          100,
          timerScoreFromRating(finalRating) +
            scores.keyword +
            scores.contentQuality +
            scores.image +
            scores.seo +
            scores.grammar +
            scores.humanization,
        ) || 0;

      const r = await fetch(`/api/tasks/${approveDialog.task.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performanceRating: finalRating,
          keyword: scores.keyword,
          contentQuality: scores.contentQuality,
          image: scores.image,
          seo: scores.seo,
          grammar: scores.grammar,
          humanization: scores.humanization,
          total,
          reviewerId: (user as any)?.id,
          notes: qcNotes || undefined,
        }),
      });

      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json.error || "Failed to approve task");
      }

      await r.json();

      // Activity log
      try {
        await fetch(`/api/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "task",
            entityId: approveDialog.task.id,
            action: "qc_approved",
            qcApproved: true,
            qcNotes: qcNotes || undefined,
            userId: (user as any)?.id,
            details: {
              taskName: approveDialog.task.name,
              agentId: approveDialog.task.assignedTo?.id ?? null,
              agentName:
                approveDialog.task.assignedTo?.name ||
                approveDialog.task.assignedTo?.email ||
                null,
              clientId: approveDialog.task.client?.id ?? null,
              clientName: approveDialog.task.client?.name ?? null,
              scores,
              total,
              performanceRating: finalRating,
            },
          }),
        });
      } catch (logErr) {
        console.warn("Activity log (qc_approved) failed:", logErr);
      }

      toast.success(
        `Task "${approveDialog.task.name}" approved. Rating: ${finalRating}.`,
      );
      setApprovedMap((m) => ({ ...m, [approveDialog.task!.id]: true }));
      setQcScoresByTask((m) => {
        const next = { ...m };
        delete next[approveDialog.task!.id];
        return next;
      });

      setApproveDialog({ open: false, task: null, loading: false });
      setQcNotes("");
      refetchTasks();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve task");
      setApproveDialog((p) => ({ ...p, loading: false }));
    }
  };

  const searchParams = useSearchParams();

  useEffect(() => {
    const cid = searchParams.get("clientId");
    if (cid) setClientId(cid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="mx-auto w-full p-6 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                QC Review
              </h1>
              <p className="text-slate-600 font-medium">
                Review completed tasks assigned to your agents and approve or
                reassign with precision
              </p>
            </div>
          </div>
        </div>
         {/* ✅ Header actions */}
<div className="flex gap-3">
  <Button
    onClick={handleBulkOpenCompletionLinks}
    disabled={loading || bulkCompletionLinks.length === 0}
    title={
      bulkCompletionLinks.length
        ? `Open ${bulkCompletionLinks.length} completion link(s)`
        : "No completion links available"
    }
    className={[
      "rounded-xl px-4",
      "bg-[#00BC89] text-white border border-transparent",
      "hover:bg-[#00A97A] active:bg-[#00966D]",
      "transition-all duration-200 shadow-sm hover:shadow-md",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BC89]/30",
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm",
    ].join(" ")}
  >
    <ExternalLink className="h-4 w-4 mr-2 text-white" />
    <span className="font-semibold">Open Bulk All Completion Links</span>

    {bulkCompletionLinks.length ? (
      <span className="ml-2 inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
        {bulkCompletionLinks.length}
      </span>
    ) : null}
  </Button>
</div>



      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">
                  Task Results
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium">
                  Quality control dashboard for your completed tasks
                </CardDescription>
              </div>
            </div>
 
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <Award className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">
                {filteredTasks.length} of {qcScopedTasks.length} tasks
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-200 rounded-full animate-pulse" />
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 absolute top-4 left-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-700 font-medium">Loading tasks...</p>
                  <p className="text-slate-500 text-sm">
                    Please wait while we fetch the latest data
                  </p>
                </div>
              </div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl">
                  <CheckCircle className="h-12 w-12 text-emerald-500" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-semibold text-slate-900">
                    🎉 All Tasks Reviewed!
                  </h3>
                  <p className="text-slate-600">
                    Great job! You've successfully completed QC review for all
                    available tasks. Take a well-deserved break!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <VirtualTaskList
              tasks={filteredTasks}
              approvedMap={approvedMap}
              onApprove={(t) => {
                // NOTE: keep existing behavior
                setApproveDialog({ open: true, task: t, loading: false });
                setQcNotes("");
              }}
              onReject={(t) =>
                setReassignDialog({
                  open: true,
                  task: t,
                  reassignNotes: "",
                  loading: false,
                })
              }
              qcScoresByTask={qcScoresByTask}
              onChangeScores={(taskId, scores) =>
                setQcScoresByTask((m) => ({ ...m, [taskId]: scores }))
              }
              defaultScores={defaultScores}
              setNotePreview={setNotePreview}
            />
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialog.open}
        onOpenChange={(open) => setApproveDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl rounded-2xl">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-sm">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Approve Task
              </DialogTitle>
            </div>
          </DialogHeader>

          {approveDialog.task && (
            <div className="space-y-4 py-1">
              <div className="rounded-2xl p-3 border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {approveDialog.task.name}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="text-slate-600">Agent:</span>
                        <span className="font-medium text-slate-900">
                          {approveDialog.task.assignedTo?.name ||
                            approveDialog.task.assignedTo?.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span className="text-slate-600">Client:</span>
                        <span className="font-medium text-slate-900">
                          {approveDialog.task.client?.name}
                        </span>
                      </div>
                    </div>
                    {approveDialog.task.completionLink && (
                      <div className="mt-2">
                        <Button
                          onClick={() =>
                            window.open(
                              approveDialog.task!.completionLink!,
                              "_blank",
                            )
                          }
                          variant="outline"
                          size="sm"
                          className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 transition-all duration-200"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Completion
                        </Button>
                      </div>
                    )}

                    {approveDialog.task.notes && (
                      <div className="mt-3">
                        <Button
                          onClick={() =>
                            setNotePreview({
                              open: true,
                              note: approveDialog.task?.notes || "",
                              taskName: approveDialog.task?.name || "",
                            })
                          }
                          variant="outline"
                          size="sm"
                          className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 transition-all duration-200 flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Notes
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full" />
                  Additional Notes (Optional)
                </label>
                <Textarea
                  rows={3}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="resize-none border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
                  placeholder="Add any specific feedback or observations about this task..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setApproveDialog((p) => ({ ...p, open: false }))}
              disabled={approveDialog.loading}
              className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveTask}
              disabled={approveDialog.loading || !approveDialog.task}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {approveDialog.loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Preview Dialog */}
      <Dialog
        open={notePreview.open}
        onOpenChange={(open) => setNotePreview((p) => ({ ...p, open }))}
      >
        <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl rounded-2xl">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Task Notes
              </DialogTitle>
            </div>
            <p className="text-sm text-slate-600 pt-1">
              {notePreview.taskName || "Note"}
            </p>
          </DialogHeader>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {notePreview.note || "No notes provided."}
          </div>
          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
              onClick={() => setNotePreview((p) => ({ ...p, open: false }))}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog
        open={reassignDialog.open}
        onOpenChange={(open) => setReassignDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl rounded-2xl">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-sm">
                <RotateCcw className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Reassign Task
              </DialogTitle>
            </div>
          </DialogHeader>

          {reassignDialog.task && (
            <div className="space-y-3">
              <div className="rounded-xl p-3 border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50">
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-900">
                    {reassignDialog.task.name}
                  </h3>
                  <div className="text-sm text-slate-600 flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    Current agent:{" "}
                    <span className="font-medium text-slate-900">
                      {reassignDialog.task.assignedTo?.name ||
                        reassignDialog.task.assignedTo?.email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Reassignment Notes
                </label>
                <Textarea
                  rows={3}
                  value={reassignDialog.reassignNotes}
                  onChange={(e) =>
                    setReassignDialog((p) => ({
                      ...p,
                      reassignNotes: e.target.value,
                    }))
                  }
                  className="resize-none border-slate-200 focus:border-orange-300 focus:ring-orange-200 rounded-xl"
                  placeholder="Explain why this task needs to be reassigned..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setReassignDialog((p) => ({ ...p, open: false }))}
              disabled={reassignDialog.loading}
              className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReassignTask}
              disabled={reassignDialog.loading || !reassignDialog.task}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {reassignDialog.loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
