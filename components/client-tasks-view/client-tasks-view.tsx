// apps/components/client-tasks-view/client-tasks-view.tsx

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
  useRef,
} from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Play,
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  RefreshCw,
  Activity,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Client } from "@/types/client";

import TaskList from "@/components/client-tasks-view/TaskList";
import TaskDialogs from "@/components/client-tasks-view/TaskDialogs";
import { BackgroundGradient } from "../ui/background-gradient";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ClientDashboard = lazy(() =>
  import("@/components/clients/clientsID/client-dashboard").then((m) => ({
    default: m.ClientDashboard,
  })),
);

const ClientDashboardSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border border-muted/40">
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  </div>
);

/* =========================
   Types exported for children
========================= */
export interface Task {
  id: string;
  name: string;
  priority: "low" | "medium" | "high" | "urgent";
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "overdue"
    | "cancelled"
    | "reassigned"
    | "qc_approved";
  dueDate: string | null;
  idealDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  performanceRating: "Excellent" | "Good" | "Average" | "Lazy" | null;
  completionLink: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pauseReasons?: Array<{
    reason?: string | null;
    timestamp?: string | null;
    durationInSeconds?: number | null;
    pausedBy?: string | null;
  }> | null;

  // ✅ NEW: reassignment notes from agents endpoint
  reassignNotes?: string | null;
  notes?: string | null; // fallback if your DB uses notes field

  assignment: {
    id: string;
    client: { id: string; name: string; avatar: string | null } | null;
    template: { id: string; name: string } | null;
  } | null;
  templateSiteAsset: {
    id: number;
    name: string;
    type: string;
    url: string | null;
  } | null;
  category: { id: string; name: string } | null;
  assignedTo: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    image: string | null;
  } | null;
  comments: Array<{
    id: string;
    text: string;
    date: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      image: string | null;
    } | null;
  }>;
  qcTotalScore?: number | null;
  qcReview?: {
    timerScore?: number;
    keyword?: number;
    contentQuality?: number;
    image?: number;
    seo?: number;
    grammar?: number;
    humanization?: number;
    total?: number;
    reviewerId?: string | null;
    reviewedAt?: string;
    notes?: string | null;
  } | null;
  email?: string | null;
  username?: string | null;
}
export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  reassigned: number;
  qc_approved: number;
}
export interface TimerState {
  taskId: string;
  remainingSeconds: number;
  isRunning: boolean;
  totalSeconds: number;
  isGloballyLocked: boolean;
  lockedByAgent?: string;
  startedAt?: number;
  pausedAt?: number;
  ownerId?: string;
  baseSpentSeconds?: number; // task.actualDurationMinutes থেকে আসবে (carry progress)
}
interface GlobalTimerLock {
  isLocked: boolean;
  taskId: string | null;
  agentId: string | null;
  taskName: string | null;
}
interface ClientTasksViewProps {
  clientId: string;
  clientName: string;
  agentId: string;
  onBack: () => void;
  isLockedBySelf?: boolean;
  lockedTaskId?: string | null;
  lockedTaskName?: string | null;
  excludedCategories?: string[];
  focusTaskId?: string | null;
}
interface Agent {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

// ===== Storage keys =====
const PAGE_SIZE = 1000; // load all tasks in one request for full lists
const RUN_KEY = "runningTaskTimer"; // only the actively running timer
const PAUSE_KEY = "pausedTaskTimer"; // at most one paused task
const LOCK_KEY = "globalTimerLock"; // navigation lock
const TIMER_EVENT_QUEUE_KEY = "taskTimerEventQueue";
const TIMER_RESUME_REASON = "__RESUME__";
const TIMER_START_REASON = "__START__";
const AUTO_PAUSE_REASON = "__AUTO_PAUSE__";
const AUTO_PAUSE_THRESHOLD_MS = 2 * 60 * 1000;

// Exclude these categories from display
const EXCLUDED_CATEGORIES = ["Social Communication"];

type StoredTimer = TimerState & { savedAt?: number; agentId?: string };
type QueuedTimerEvent = { taskId: string; reason: string; timestamp: string };

/* =========================
   Utils
========================= */
const formatTimerDisplay = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

type TimerEvent = { type: "resume" | "pause"; ts: number };

const parseTimerTimestamp = (value: unknown) => {
  if (!value) return null;
  const ts = new Date(String(value)).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const buildTimerEvents = (
  task: Task | null | undefined,
  fallbackStartMs?: number,
): TimerEvent[] => {
  const events: TimerEvent[] = [];
  if (task?.pauseReasons && Array.isArray(task.pauseReasons)) {
    for (const entry of task.pauseReasons) {
      const ts = parseTimerTimestamp(entry?.timestamp);
      if (ts == null) continue;
      const reason = typeof entry?.reason === "string" ? entry.reason : "";
      if (reason === TIMER_RESUME_REASON || reason === TIMER_START_REASON) {
        events.push({ type: "resume", ts });
      } else {
        events.push({ type: "pause", ts });
      }
    }
  }

  if (fallbackStartMs && !events.some((e) => e.type === "resume")) {
    events.push({ type: "resume", ts: fallbackStartMs });
  }

  events.sort((a, b) => a.ts - b.ts);

  // ✅ FAILSAFE: if last event is resume and it's absurdly old, treat as not running
  const last = events[events.length - 1];
  if (last?.type === "resume") {
    const ageMs = Date.now() - last.ts;
    const MAX_OPEN_RUN_MS = 12 * 60 * 60 * 1000; // 12h
    if (ageMs > MAX_OPEN_RUN_MS) {
      // drop the last resume so it doesn't count huge elapsed
      events.pop();
    }
  }

  return events;

  return events;
};

const calculateElapsedSeconds = (
  task: Task | null | undefined,
  fallbackStartMs: number | undefined,
  nowMs: number,
) => {
  const events = buildTimerEvents(task, fallbackStartMs);
  let runningFrom: number | null = null;
  let elapsedMs = 0;

  for (const event of events) {
    if (event.type === "resume") {
      if (runningFrom == null) runningFrom = event.ts;
    } else if (runningFrom != null) {
      elapsedMs += event.ts - runningFrom;
      runningFrom = null;
    }
  }

  if (runningFrom != null) {
    elapsedMs += nowMs - runningFrom;
  }

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  return Math.floor(elapsedMs / 1000);
};

const calculateRemainingSeconds = (
  task: Task | null | undefined,
  timer: TimerState,
  nowMs: number,
) => {
  const totalSeconds =
    timer.totalSeconds || (task?.idealDurationMinutes ?? 0) * 60;

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return timer.remainingSeconds;
  }

  // ✅ carry progress: DB থেকে actualDurationMinutes
  const baseSpent =
    typeof timer.baseSpentSeconds === "number"
      ? timer.baseSpentSeconds
      : (task?.actualDurationMinutes ?? 0) * 60;

  // ✅ only current run session elapsed (no historical timestamps)
  const sessionElapsed =
    timer.isRunning && timer.startedAt
      ? Math.floor((nowMs - timer.startedAt) / 1000)
      : 0;

  const spent = Math.max(0, baseSpent + sessionElapsed);
  return totalSeconds - spent;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getOrCreateSessionId = () => {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem("taskTimerSessionId");
    if (existing) return existing;
    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem("taskTimerSessionId", generated);
    return generated;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: {
      className:
        "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/50 dark:text-slate-400 border-slate-300 dark:border-slate-700",
      icon: Clock,
      label: "Pending",
    },
    in_progress: {
      className:
        "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800",
      icon: Play,
      label: "In Progress",
    },
    completed: {
      className:
        "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
      icon: CheckCircle,
      label: "Completed",
    },
    qc_approved: {
      className:
        "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800",
      icon: ShieldCheck,
      label: "QC Approved",
    },
    overdue: {
      className:
        "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-800",
      icon: AlertCircle,
      label: "Overdue",
    },
    cancelled: {
      className:
        "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700",
      icon: XCircle,
      label: "Cancelled",
    },
    reassigned: {
      className:
        "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-800",
      icon: TrendingUp,
      label: "Reassigned",
    },
  } as const;

  const config = statusConfig[status as keyof typeof statusConfig];
  if (!config) return <Badge variant="secondary">{status}</Badge>;
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const priorityConfig = {
    low: {
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      label: "Low",
    },
    medium: {
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      label: "Medium",
    },
    high: {
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      label: "High",
    },
    urgent: {
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      label: "Urgent",
    },
  } as const;

  const config = priorityConfig[priority as keyof typeof priorityConfig];
  if (!config) return <Badge variant="secondary">{priority}</Badge>;
  return <Badge className={config.className}>{config.label}</Badge>;
};

/* =========================
   Main Component
========================= */
export function ClientTasksView({
  clientId,
  clientName,
  agentId,
  onBack,
  isLockedBySelf,
  lockedTaskId,
  lockedTaskName,
  excludedCategories,
  focusTaskId = null,
}: ClientTasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const pinnedTaskRef = useRef<Task | null>(null);
  const lastTimerSaveRef = useRef<number>(0);
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [visibleCount, setVisibleCount] = useState(0);
  const [pinnedTask, setPinnedTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [globalTimerLock, setGlobalTimerLock] = useState<GlobalTimerLock>({
    isLocked: false,
    taskId: null,
    agentId: null,
    taskName: null,
  });
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
  });
  const [isCompletionConfirmOpen, setIsCompletionConfirmOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [completionLink, setCompletionLink] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkCompletionOpen, setIsBulkCompletionOpen] = useState(false);
  const [bulkCompletionLink, setBulkCompletionLink] = useState("");
  const [clientData, setClientData] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [pausedTimer, setPausedTimer] = useState<TimerState | null>(null); // new

  useEffect(() => {
    pinnedTaskRef.current = pinnedTask;
  }, [pinnedTask]);

  useEffect(() => {
    if (taskToComplete) {
      setCompletionNotes(taskToComplete.notes ?? "");
    } else {
      setCompletionNotes("");
    }
  }, [taskToComplete]);

  const getTaskById = useCallback((taskId: string) => {
    const fromList = tasksRef.current.find((t) => t.id === taskId);
    if (fromList) return fromList;
    return pinnedTaskRef.current?.id === taskId ? pinnedTaskRef.current : null;
  }, []);

  const applyStatusDelta = useCallback(
    (prevStatus?: string | null, nextStatus?: string | null) => {
      setStats((prev) => {
        const next = { ...prev };
        const dec = (s?: string | null) => {
          if (!s) return;
          switch (s) {
            case "pending":
              next.pending = Math.max(0, next.pending - 1);
              break;
            case "in_progress":
              next.inProgress = Math.max(0, next.inProgress - 1);
              break;
            case "completed":
              next.completed = Math.max(0, next.completed - 1);
              break;
            case "overdue":
              next.overdue = Math.max(0, next.overdue - 1);
              break;
            case "cancelled":
              next.cancelled = Math.max(0, next.cancelled - 1);
              break;
            case "reassigned":
              next.reassigned = Math.max(0, next.reassigned - 1);
              break;
            case "qc_approved":
              next.qc_approved = Math.max(0, next.qc_approved - 1);
              break;
            default:
              break;
          }
        };
        const inc = (s?: string | null) => {
          if (!s) return;
          switch (s) {
            case "pending":
              next.pending += 1;
              break;
            case "in_progress":
              next.inProgress += 1;
              break;
            case "completed":
              next.completed += 1;
              break;
            case "overdue":
              next.overdue += 1;
              break;
            case "cancelled":
              next.cancelled += 1;
              break;
            case "reassigned":
              next.reassigned += 1;
              break;
            case "qc_approved":
              next.qc_approved += 1;
              break;
            default:
              break;
          }
        };
        dec(prevStatus);
        inc(nextStatus);
        return next;
      });
    },
    [],
  );

  const mergedExcludedCategories = useMemo(
    () =>
      Array.from(
        new Set([...(excludedCategories ?? []), ...EXCLUDED_CATEGORIES]),
      ),
    [excludedCategories],
  );

  const buildQueryString = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set("agentId", agentId);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (mergedExcludedCategories.length > 0) {
        params.set("excludeCategories", mergedExcludedCategories.join(","));
      }
      if (deferredSearch) params.set("search", deferredSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      return params.toString();
    },
    [
      agentId,
      deferredSearch,
      mergedExcludedCategories,
      priorityFilter,
      statusFilter,
    ],
  );

  const buildCompletedTasksQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("agentId", agentId);
    params.set("status", "completed");
    params.set("pageSize", "1000"); // Large number to get all completed tasks
    if (mergedExcludedCategories.length > 0) {
      params.set("excludeCategories", mergedExcludedCategories.join(","));
    }
    return params.toString();
  }, [agentId, mergedExcludedCategories]);

  const taskKey = agentId
    ? `/api/tasks/client/${clientId}?${buildQueryString(page)}`
    : null;

  // Separate query for completed tasks to get all of them
  const completedTasksKey = agentId
    ? `/api/tasks/client/${clientId}?${buildCompletedTasksQuery()}`
    : null;

  const {
    data: taskResponse,
    error: fetchError,
    isLoading: swrLoading,
    isValidating,
    mutate,
  } = useSWR(
    taskKey,
    async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message =
          payload?.error ||
          payload?.message ||
          `Failed to fetch tasks (${res.status})`;
        throw new Error(message);
      }
      return res.json();
    },
    {
      keepPreviousData: true,
    },
  );

  const {
    data: completedTasksResponse,
    error: completedTasksError,
    isLoading: isLoadingCompletedTasks,
    mutate: mutateCompletedTasks,
  } = useSWR(completedTasksKey, async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const message =
        payload?.error ||
        payload?.message ||
        `Failed to fetch completed tasks (${res.status})`;
      throw new Error(message);
    }
    return res.json();
  });

  const tasksFromServer = useMemo(
    () => (taskResponse?.tasks as Task[]) ?? [],
    [taskResponse],
  );

  const completedTasksFromServer = useMemo(
    () => (completedTasksResponse?.tasks as Task[]) ?? [],
    [completedTasksResponse],
  );

  useEffect(() => {
    tasksRef.current = tasksFromServer;
    setTasks(tasksFromServer);
  }, [tasksFromServer]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (
      typeof taskResponse?.page === "number" &&
      taskResponse.page !== pageRef.current
    ) {
      setPage(taskResponse.page);
    }
  }, [taskResponse?.page]);

  const pinnedTaskId =
    focusTaskId ?? timerState?.taskId ?? pausedTimer?.taskId ?? null;

  useEffect(() => {
    if (!pinnedTaskId) {
      setPinnedTask(null);
      return;
    }

    const inPage = tasksFromServer.find((t) => t.id === pinnedTaskId) ?? null;
    if (inPage) {
      setPinnedTask(inPage);
      return;
    }

    let isActive = true;
    const loadPinnedTask = async () => {
      try {
        const params = new URLSearchParams({ taskId: pinnedTaskId });
        if (agentId) params.set("agentId", agentId);
        const res = await fetch(
          `/api/tasks/client/${clientId}?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const payload = await res.json();
        const task = payload?.tasks?.[0] ?? null;
        if (isActive) {
          setPinnedTask(task);
        }
      } catch (err) {
        console.error("Failed to load pinned task:", err);
      }
    };

    void loadPinnedTask();
    return () => {
      isActive = false;
    };
  }, [agentId, clientId, pinnedTaskId, tasksFromServer]);

  // Keep ref in sync with local mutations so status deltas use current data
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const serverCounts = useMemo(
    () => (taskResponse?.counts as any) ?? null,
    [taskResponse],
  );

  useEffect(() => {
    if (!serverCounts) return;
    setStats({
      total: serverCounts.total ?? 0,
      pending: serverCounts.pending ?? 0,
      inProgress: serverCounts.in_progress ?? 0,
      completed: serverCounts.completed ?? 0,
      overdue: serverCounts.overdue ?? 0,
      cancelled: serverCounts.cancelled ?? 0,
      reassigned: serverCounts.reassigned ?? 0,
      qc_approved: serverCounts.qc_approved ?? 0,
    });
  }, [serverCounts]);

  const totalTasks = taskResponse?.total ?? 0;
  const isInitialLoading = swrLoading && !taskResponse;
  const isRefreshing = isValidating && !isInitialLoading;
  const refreshTasks = useCallback(async () => {
    // Revalidate both the paged list and the completed list so the tabs stay up to date
    await Promise.all([
      mutate(),
      mutateCompletedTasks ? mutateCompletedTasks() : Promise.resolve(),
    ]);
  }, [mutate, mutateCompletedTasks]);

  useEffect(() => {
    setPage(1);
  }, [
    agentId,
    clientId,
    searchTerm,
    priorityFilter,
    statusFilter,
    mergedExcludedCategories,
  ]);

  const loadPausedFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem("pausedTaskTimer"); // PAUSE_KEY
      if (raw) {
        const p = JSON.parse(raw) as TimerState & {
          savedAt?: number;
          agentId?: string;
        };
        const startedAt = Number.isFinite(p.startedAt)
          ? p.startedAt
          : Number.isFinite(p.savedAt)
            ? p.savedAt
            : undefined;

        const pausedAt = Number.isFinite(p.pausedAt)
          ? p.pausedAt
          : Number.isFinite(p.savedAt)
            ? p.savedAt
            : Date.now();

        const totalSeconds = isFiniteNumber(p.totalSeconds) ? p.totalSeconds : 0;
        const remainingSeconds = isFiniteNumber(p.remainingSeconds)
          ? p.remainingSeconds
          : 0;
        const baseSpentSeconds = isFiniteNumber(p.baseSpentSeconds)
          ? p.baseSpentSeconds
          : Math.max(0, totalSeconds - remainingSeconds);

        setPausedTimer({
          taskId: p.taskId,
          remainingSeconds,
          isRunning: false,
          totalSeconds,
          isGloballyLocked: false,
          lockedByAgent: p.lockedByAgent,
          startedAt,
          pausedAt,
          ownerId: p.ownerId,
          baseSpentSeconds,
        });
      } else {
        setPausedTimer(null);
      }
    } catch {
      setPausedTimer(null);
    }
  }, []);

  // Normalize and fetch full client data for the modal
  const normalizeClientData = useCallback((apiData: any): Client => {
    const uncategorized = {
      id: "uncategorized",
      name: "Uncategorized",
      description: "",
    } as any;
    return {
      ...apiData,
      companywebsite:
        apiData?.companywebsite && typeof apiData.companywebsite === "string"
          ? apiData.companywebsite
          : "",
      tasks: (apiData?.tasks ?? []).map((t: any) => ({
        ...t,
        categoryId: t?.category?.id ?? t?.categoryId ?? "uncategorized",
        category: t?.category ?? uncategorized,
        name: String(t?.name ?? ""),
        priority: String(t?.priority ?? "medium"),
        status: String(t?.status ?? "pending"),
        templateSiteAsset: {
          ...t?.templateSiteAsset,
          type: String(t?.templateSiteAsset?.type ?? ""),
          name: String(t?.templateSiteAsset?.name ?? ""),
          url: String(t?.templateSiteAsset?.url ?? ""),
        },
      })),
    } as Client;
  }, []);

  const fetchClientData = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const raw = await res.json();
      const normalized = normalizeClientData(raw);
      setClientData(normalized);
    } catch (e) {
      console.error("Failed to fetch client data:", e);
    }
  }, [clientId, normalizeClientData]);

  useEffect(() => {
    if (isClientModalOpen || isCompletionConfirmOpen) {
      fetchClientData();
    }
  }, [isClientModalOpen, isCompletionConfirmOpen, fetchClientData]);

  const applyLocalTaskPatch = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id === taskId ? ({ ...t, ...updates } as Task) : t,
        );
        tasksRef.current = next;
        return next;
      });
      setPinnedTask((prev) =>
        prev && prev.id === taskId ? ({ ...prev, ...updates } as Task) : prev,
      );
    },
    [],
  );

  // ✅ PATCH merge-guard
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: any) => {
      try {
        const response = await fetch(`/api/tasks/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, ...updates }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`,
          );
        }
        const updatedTask = await response.json();

        setTasks((prev) => {
          const next = prev.map((t) => {
            if (t.id !== taskId) return t;

            const merged: any = { ...t, ...updatedTask };

            if (updatedTask.templateSiteAsset == null)
              merged.templateSiteAsset = t.templateSiteAsset;
            if (updatedTask.assignment == null)
              merged.assignment = t.assignment;
            if (updatedTask.category == null) merged.category = t.category;
            if (updatedTask.completionLink == null)
              merged.completionLink = t.completionLink;
            if (updatedTask.email == null) merged.email = t.email;
            if (updatedTask.username == null) merged.username = t.username;
            if (updatedTask.reassignNotes == null)
              merged.reassignNotes = t.reassignNotes; // keep old note if patch doesn't return it
            if (updatedTask.notes == null) merged.notes = t.notes;

            return merged as Task;
          });
          tasksRef.current = next;
          return next;
        });
        setPinnedTask((prev) => {
          if (!prev || prev.id !== taskId) return prev;
          const merged: any = { ...prev, ...updatedTask };
          if (updatedTask.templateSiteAsset == null)
            merged.templateSiteAsset = prev.templateSiteAsset;
          if (updatedTask.assignment == null)
            merged.assignment = prev.assignment;
          if (updatedTask.category == null) merged.category = prev.category;
          if (updatedTask.completionLink == null)
            merged.completionLink = prev.completionLink;
          if (updatedTask.email == null) merged.email = prev.email;
          if (updatedTask.username == null) merged.username = prev.username;
          if (updatedTask.reassignNotes == null)
            merged.reassignNotes = prev.reassignNotes;
          if (updatedTask.notes == null) merged.notes = prev.notes;
          return merged as Task;
        });
        // Optimistic stats update if status changed
        const prevStatus =
          tasksRef.current.find((t) => t.id === taskId)?.status ??
          updatedTask?.status;
        if (updatedTask?.status) {
          applyStatusDelta(prevStatus, updatedTask.status);
        }
        return updatedTask;
      } catch (err: any) {
        console.error("Failed to update task:", err);
        throw err;
      }
    },
    [agentId, applyStatusDelta],
  );

  const saveTimerToStorage = useCallback(
    (timer: TimerState | null) => {
      try {
        if (timer === null) {
          localStorage.removeItem(RUN_KEY);

          const unlock: GlobalTimerLock = {
            isLocked: false,
            taskId: null,
            agentId: null,
            taskName: null,
          };
          localStorage.setItem(LOCK_KEY, JSON.stringify(unlock));
          setGlobalTimerLock(unlock);

          localStorage.removeItem("taskTimer");
          localStorage.removeItem("globalTimerLock");
          return;
        }

        const now = Date.now();

        if (timer.isRunning) {
          const runningData: StoredTimer = { ...timer, savedAt: now, agentId };
          localStorage.setItem(RUN_KEY, JSON.stringify(runningData));

          try {
            const pausedRaw = localStorage.getItem(PAUSE_KEY);
            if (pausedRaw) {
              const paused: StoredTimer = JSON.parse(pausedRaw);
              if (paused.taskId === timer.taskId) {
                localStorage.removeItem(PAUSE_KEY);
              }
            }
          } catch {}

          const lockState: GlobalTimerLock = {
            isLocked: true,
            taskId: timer.taskId,
            agentId,
            taskName: tasks.find((t) => t.id === timer.taskId)?.name || null,
          };
          localStorage.setItem(LOCK_KEY, JSON.stringify(lockState));
          setGlobalTimerLock(lockState);

          localStorage.setItem("taskTimer", JSON.stringify(runningData));
          localStorage.setItem("globalTimerLock", JSON.stringify(lockState));
          return;
        }

        const pausedData: StoredTimer = { ...timer, savedAt: now, agentId };
        localStorage.setItem(PAUSE_KEY, JSON.stringify(pausedData));

        localStorage.removeItem(RUN_KEY);
        const unlock: GlobalTimerLock = {
          isLocked: false,
          taskId: null,
          agentId: null,
          taskName: null,
        };
        localStorage.setItem(LOCK_KEY, JSON.stringify(unlock));
        setGlobalTimerLock(unlock);

        localStorage.setItem("taskTimer", JSON.stringify(pausedData));
        localStorage.setItem("globalTimerLock", JSON.stringify(unlock));
      } catch (e) {
        console.error("Failed to save timer to storage:", e);
      }
    },
    [agentId, tasks, setGlobalTimerLock],
  );

  const enqueueTimerEvent = useCallback((event: QueuedTimerEvent) => {
    try {
      const raw = localStorage.getItem(TIMER_EVENT_QUEUE_KEY);
      const parsed = raw ? (JSON.parse(raw) as QueuedTimerEvent[]) : [];
      const queue = Array.isArray(parsed) ? parsed : [];
      queue.push(event);
      localStorage.setItem(TIMER_EVENT_QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  }, []);

  const flushTimerEventQueue = useCallback(async () => {
    try {
      const raw = localStorage.getItem(TIMER_EVENT_QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as QueuedTimerEvent[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const remaining: QueuedTimerEvent[] = [];
      for (const event of parsed) {
        try {
          const res = await fetch(`/api/tasks/${event.taskId}/pause`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: event.reason,
              timestamp: event.timestamp,
            }),
          });
          if (!res.ok) throw new Error("Failed to persist timer event");
        } catch {
          remaining.push(event);
        }
      }

      if (remaining.length === 0) {
        localStorage.removeItem(TIMER_EVENT_QUEUE_KEY);
      } else {
        localStorage.setItem(TIMER_EVENT_QUEUE_KEY, JSON.stringify(remaining));
      }
    } catch {}
  }, []);

  const logTimerEvent = useCallback(
    async (
      taskId: string,
      reason: string,
      timestampMs?: number,
      options?: { preferBeacon?: boolean },
    ) => {
      const timestamp = new Date(timestampMs ?? Date.now()).toISOString();
      const payload = { reason, timestamp };
      try {
        if (
          options?.preferBeacon &&
          typeof navigator !== "undefined" &&
          typeof navigator.sendBeacon === "function"
        ) {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          const ok = navigator.sendBeacon(`/api/tasks/${taskId}/pause`, blob);
          if (ok) return;
        }

        const res = await fetch(`/api/tasks/${taskId}/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to log timer event");
      } catch (error) {
        enqueueTimerEvent({ taskId, reason, timestamp });
        console.warn("Failed to log timer event:", reason, error);
      }
    },
    [enqueueTimerEvent],
  );

  const autoPauseActiveTimer = useCallback(
    (
      reason: string,
      pausedAt?: number,
      options?: { preferBeacon?: boolean },
    ) => {
      if (!timerState?.isRunning) return;
      if (timerState.ownerId && timerState.ownerId !== sessionIdRef.current) {
        return;
      }

      const nowMs = pausedAt ?? Date.now();
      const task = getTaskById(timerState.taskId);
      const baseTimer: TimerState = {
        ...timerState,
        isRunning: false,
        isGloballyLocked: false,
        pausedAt: nowMs,
      };
      const updatedTimer: TimerState = {
        ...baseTimer,
        remainingSeconds: calculateRemainingSeconds(task, baseTimer, nowMs),
      };

      setTimerState(updatedTimer);
      setPausedTimer(updatedTimer);
      saveTimerToStorage(updatedTimer);
      void logTimerEvent(timerState.taskId, reason, nowMs, options);
    },
    [getTaskById, logTimerEvent, saveTimerToStorage, timerState],
  );

  useEffect(() => {
    flushTimerEventQueue();
  }, [flushTimerEventQueue]);

  useEffect(() => {
    const handleOnline = () => {
      flushTimerEventQueue();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushTimerEventQueue]);

  const loadTimerFromStorage = useCallback(() => {
    try {
      const raw =
        localStorage.getItem(RUN_KEY) ?? localStorage.getItem("taskTimer");
      const lockRaw =
        localStorage.getItem(LOCK_KEY) ??
        localStorage.getItem("globalTimerLock");

      if (raw) {
        const timerData = JSON.parse(raw) as StoredTimer;
        const savedAt = timerData.savedAt ?? Date.now();
        const ownedByThisTab =
          !!timerData.ownerId && timerData.ownerId === sessionIdRef.current;
        const allowAutoPause = !timerData.ownerId || ownedByThisTab;

        let remaining = isFiniteNumber(timerData.remainingSeconds)
          ? timerData.remainingSeconds
          : 0;
        if (timerData.isRunning) {
          const elapsed = Math.floor((Date.now() - savedAt) / 1000);
          remaining -= elapsed;
        }

        const totalSeconds =
          isFiniteNumber(timerData.totalSeconds) && timerData.totalSeconds > 0
            ? timerData.totalSeconds
            : Math.max(
                0,
                remaining +
                  Math.max(
                    0,
                    isFiniteNumber(timerData.baseSpentSeconds)
                      ? timerData.baseSpentSeconds
                      : 0,
                  ),
              );
        const baseSpentSeconds = isFiniteNumber(timerData.baseSpentSeconds)
          ? timerData.baseSpentSeconds
          : Math.max(0, totalSeconds - remaining);

        const pausedAt = timerData.isRunning
          ? undefined
          : (timerData.pausedAt ?? timerData.savedAt ?? Date.now());

        if (
          timerData.isRunning &&
          allowAutoPause &&
          Date.now() - savedAt > AUTO_PAUSE_THRESHOLD_MS
        ) {
          const baseTimer: TimerState = {
            taskId: timerData.taskId,
            remainingSeconds: isFiniteNumber(timerData.remainingSeconds)
              ? timerData.remainingSeconds
              : remaining,
            isRunning: false,
            totalSeconds,
            isGloballyLocked: false,
            lockedByAgent: timerData.lockedByAgent,
            startedAt: timerData.startedAt || savedAt,
            pausedAt: savedAt,
            ownerId: timerData.ownerId,
            baseSpentSeconds,
          };
          const task = getTaskById(timerData.taskId);
          const autoPaused: TimerState = {
            ...baseTimer,
            remainingSeconds: calculateRemainingSeconds(
              task,
              baseTimer,
              savedAt,
            ),
          };

          setTimerState(autoPaused);
          setPausedTimer(autoPaused);
          saveTimerToStorage(autoPaused);
          void logTimerEvent(
            timerData.taskId,
            `${AUTO_PAUSE_REASON}_RECOVERY`,
            savedAt,
          );

          const taskName = task?.name || "Unknown Task";
          toast.info(`Timer auto-paused for "${taskName}".`);
          return autoPaused;
        }

        const restored: TimerState = {
          taskId: timerData.taskId,
          remainingSeconds: remaining,
          isRunning: !!timerData.isRunning,
          totalSeconds,
          isGloballyLocked: !!timerData.isGloballyLocked,
          lockedByAgent: timerData.lockedByAgent,
          startedAt: timerData.startedAt || Date.now(),
          pausedAt,
          ownerId: timerData.ownerId,
          baseSpentSeconds,
        };

        setTimerState(restored);
        if (restored.isRunning && timerData.savedAt) {
          lastTimerSaveRef.current = timerData.savedAt;
        }

        const lock = lockRaw ? (JSON.parse(lockRaw) as GlobalTimerLock) : null;
        if (lock) {
          setGlobalTimerLock(lock);
        }

        const task =
          tasksRef.current.find((t) => t.id === restored.taskId) ?? undefined;
        const taskName = task?.name || lock?.taskName || "Unknown Task";
        toast.info(
          restored.isRunning
            ? `Timer restored for "${taskName}".`
            : `Paused timer data available for "${taskName}".`,
        );
        return restored;
      }
    } catch (e) {
      console.error("Failed to load timer:", e);
    }
    return null;
  }, [getTaskById, logTimerEvent, saveTimerToStorage, setGlobalTimerLock]);

  useEffect(() => {
    loadTimerFromStorage();
    loadPausedFromStorage();
  }, [loadPausedFromStorage, loadTimerFromStorage]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (
        event.key === RUN_KEY ||
        event.key === PAUSE_KEY ||
        event.key === LOCK_KEY ||
        event.key === "taskTimer" ||
        event.key === "globalTimerLock"
      ) {
        loadTimerFromStorage();
        loadPausedFromStorage();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadPausedFromStorage, loadTimerFromStorage]);

  useEffect(() => {
    const syncFromVisibility = () => {
      if (document.visibilityState !== "visible") return;
      loadTimerFromStorage();
      loadPausedFromStorage();
    };

    window.addEventListener("focus", syncFromVisibility);
    document.addEventListener("visibilitychange", syncFromVisibility);
    return () => {
      window.removeEventListener("focus", syncFromVisibility);
      document.removeEventListener("visibilitychange", syncFromVisibility);
    };
  }, [loadPausedFromStorage, loadTimerFromStorage]);

  useEffect(() => {
    const handleOffline = () => {
      autoPauseActiveTimer(`${AUTO_PAUSE_REASON}_OFFLINE`);
    };
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [autoPauseActiveTimer]);

  useEffect(() => {
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      autoPauseActiveTimer(`${AUTO_PAUSE_REASON}_UNLOAD`, Date.now(), {
        preferBeacon: true,
      });
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide as any);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide as any);
    };
  }, [autoPauseActiveTimer]);

  useEffect(() => {
    if (!timerState) return;
    const task = getTaskById(timerState.taskId);
    if (!task) return;
    const nowMs = timerState.isRunning
      ? Date.now()
      : (timerState.pausedAt ?? Date.now());
    const nextRemaining = calculateRemainingSeconds(task, timerState, nowMs);
    if (nextRemaining !== timerState.remainingSeconds) {
      setTimerState((prev) => {
        if (!prev || prev.taskId !== timerState.taskId) return prev;
        if (prev.remainingSeconds === nextRemaining) return prev;
        return { ...prev, remainingSeconds: nextRemaining };
      });
    }
  }, [
    timerState,
    timerState?.taskId,
    timerState?.isRunning,
    timerState?.pausedAt,
    tasksFromServer,
    pinnedTask,
    getTaskById,
  ]);

  useEffect(() => {
    if (!pausedTimer) return;
    const task = getTaskById(pausedTimer.taskId);
    if (!task) return;
    const nowMs = pausedTimer.pausedAt ?? Date.now();
    const nextRemaining = calculateRemainingSeconds(task, pausedTimer, nowMs);
    if (nextRemaining !== pausedTimer.remainingSeconds) {
      setPausedTimer((prev) => {
        if (!prev || prev.taskId !== pausedTimer.taskId) return prev;
        if (prev.remainingSeconds === nextRemaining) return prev;
        return { ...prev, remainingSeconds: nextRemaining };
      });
    }
  }, [
    pausedTimer,
    pausedTimer?.taskId,
    pausedTimer?.pausedAt,
    tasksFromServer,
    pinnedTask,
    getTaskById,
  ]);

  const isTaskDisabled = useCallback((_taskId: string) => false, []);
  const isAnyTimerRunning = globalTimerLock.isLocked;
  const isBackButtonDisabled = isAnyTimerRunning;

  const handleStartTimer = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task?.idealDurationMinutes) return;

      if (globalTimerLock.isLocked && timerState?.taskId !== taskId) {
        toast.error("Please Pause the current running task!!!");
        return;
      }

      if (
        pausedTimer &&
        !pausedTimer.isRunning &&
        pausedTimer.taskId !== taskId
      ) {
        toast.error(
          "Another task is already paused. Resume or complete it before starting a new task.",
        );
        return;
      }

      try {
        const pausedRaw = localStorage.getItem(PAUSE_KEY);
        if (pausedRaw) {
          const paused = JSON.parse(pausedRaw) as StoredTimer;
          const pausedTaskId =
            typeof paused?.taskId === "string" ? paused.taskId : null;
          const isPausedSnapshot =
            !!pausedTaskId &&
            (paused.isRunning === false || paused.isRunning === undefined);

          if (!isPausedSnapshot) {
            localStorage.removeItem(PAUSE_KEY);
          } else if (pausedTaskId !== taskId) {
            toast.error(
              "Another task is already paused. Resume or complete it before starting a new task.",
            );
            return;
          }
        }
      } catch {
        localStorage.removeItem(PAUSE_KEY);
      }

      try {
        await handleUpdateTask(taskId, { status: "in_progress" });

        // ✅ If task was reassigned/completed earlier, ignore old pauseReasons history locally
        // (এটা UI clean রাখতে পারে, কিন্তু timer logic এ লাগবে না)
        if (task.status === "reassigned" || task.status === "completed") {
          applyLocalTaskPatch(taskId, { pauseReasons: [] });
        }

        const pausedSnapshot =
          pausedTimer?.taskId === taskId && !pausedTimer.isRunning
            ? pausedTimer
            : null;
        const fallbackTotalSeconds = (task.idealDurationMinutes ?? 0) * 60;
        const totalSeconds =
          pausedSnapshot &&
          isFiniteNumber(pausedSnapshot.totalSeconds) &&
          pausedSnapshot.totalSeconds > 0
            ? pausedSnapshot.totalSeconds
            : fallbackTotalSeconds;

        // Prefer paused snapshot progress for resume, fallback to DB minutes.
        const pausedBaseSpent =
          pausedSnapshot && isFiniteNumber(pausedSnapshot.baseSpentSeconds)
            ? pausedSnapshot.baseSpentSeconds
            : pausedSnapshot && isFiniteNumber(pausedSnapshot.remainingSeconds)
              ? Math.max(0, totalSeconds - pausedSnapshot.remainingSeconds)
              : undefined;
        const baseSpentSeconds = Math.max(
          0,
          pausedBaseSpent ?? (task.actualDurationMinutes ?? 0) * 60,
        );

        const remainingSeconds =
          pausedSnapshot && isFiniteNumber(pausedSnapshot.remainingSeconds)
            ? pausedSnapshot.remainingSeconds
            : totalSeconds - baseSpentSeconds;

        const resumeAt = Date.now();

        const newTimer: TimerState = {
          taskId,
          remainingSeconds,
          isRunning: true,
          totalSeconds:
            totalSeconds > 0 ? totalSeconds : Math.max(1, Math.abs(remainingSeconds)),
          isGloballyLocked: true,
          lockedByAgent: agentId,

          // ✅ important
          baseSpentSeconds,
          startedAt: resumeAt,
          pausedAt: undefined,
          ownerId: sessionIdRef.current,
        };

        setPausedTimer(null);
        setTimerState(newTimer);
        saveTimerToStorage(newTimer);
        lastTimerSaveRef.current = resumeAt;

        // optional log (ok)
        void logTimerEvent(taskId, TIMER_START_REASON, resumeAt);

        toast.success(`Timer started for "${task.name}".`);
      } catch {
        toast.error("Failed to start timer");
      }
    },
    [
      tasks,
      timerState,
      globalTimerLock.isLocked,
      pausedTimer,
      saveTimerToStorage,
      handleUpdateTask,
      agentId,
      logTimerEvent,
      applyLocalTaskPatch,
    ],
  );

  const handlePauseTimer = useCallback(
    (taskId: string, pausedAt?: number) => {
      if (!timerState || timerState.taskId !== taskId) return;
      const taskInfo = tasks.find((t) => t.id === taskId);

      try {
        const existing = localStorage.getItem(PAUSE_KEY);
        if (existing) {
          const paused: StoredTimer = JSON.parse(existing);
          const pausedTaskId =
            typeof paused?.taskId === "string" ? paused.taskId : null;
          const hasOtherPausedTask = !!(
            pausedTaskId &&
            pausedTaskId !== taskId &&
            pausedTimer &&
            !pausedTimer.isRunning &&
            pausedTimer.taskId === pausedTaskId
          );

          if (hasOtherPausedTask) {
            toast.error(
              "Another task is already paused. Resume or complete it before pausing this task.",
            );
            return;
          }

          if (pausedTaskId && pausedTaskId !== taskId) {
            // Orphaned/stale pause key should not block valid pause actions.
            localStorage.removeItem(PAUSE_KEY);
          }
        }
      } catch {}

      const nowMs = pausedAt ?? Date.now();
      const totalSeconds =
        isFiniteNumber(timerState.totalSeconds) && timerState.totalSeconds > 0
          ? timerState.totalSeconds
          : (taskInfo?.idealDurationMinutes ?? 0) * 60;
      const derivedBaseFromRemaining = Math.max(
        0,
        totalSeconds - (isFiniteNumber(timerState.remainingSeconds) ? timerState.remainingSeconds : 0),
      );

      // ✅ Accumulate spent time WITHOUT DATE HISTORY
      const prevBase = isFiniteNumber(timerState.baseSpentSeconds)
        ? timerState.baseSpentSeconds
        : derivedBaseFromRemaining;
      const sessionElapsed = timerState.startedAt
        ? Math.floor((nowMs - timerState.startedAt) / 1000)
        : 0;

      const nextBaseSpentSeconds = Math.max(0, prevBase + sessionElapsed);

      const nextRemainingSeconds = totalSeconds - nextBaseSpentSeconds;

      const updatedTimer: TimerState = {
        ...timerState,
        isRunning: false,
        isGloballyLocked: false,
        pausedAt: nowMs,
        totalSeconds,

        // ✅ important
        baseSpentSeconds: nextBaseSpentSeconds,
        startedAt: undefined, // ✅ clear current session start
        remainingSeconds: nextRemainingSeconds,
      };

      setTimerState(updatedTimer);
      setPausedTimer(updatedTimer);
      saveTimerToStorage(updatedTimer);

      toast.info(
        `Timer paused for "${taskInfo?.name}". All tasks are now unlocked.`,
      );
    },
    [timerState, tasks, pausedTimer, saveTimerToStorage],
  );

  const handleResetTimer = useCallback(
    (taskId: string) => {
      if (timerState?.taskId === taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task?.idealDurationMinutes) return;

        const totalSeconds = task.idealDurationMinutes * 60;

        try {
          const pausedRaw = localStorage.getItem(PAUSE_KEY);
          if (pausedRaw) {
            const paused: StoredTimer = JSON.parse(pausedRaw);
            if (paused.taskId === taskId) {
              localStorage.removeItem(PAUSE_KEY);
            }
          }
        } catch {}

        const updatedTimer: TimerState = {
          taskId,
          remainingSeconds: totalSeconds,
          isRunning: false,
          totalSeconds,
          isGloballyLocked: false,
          startedAt: undefined,
          pausedAt: undefined,
        };

        setTimerState(updatedTimer);
        saveTimerToStorage(null);

        if (pausedTimer?.taskId === taskId) {
          setPausedTimer(null);
          try {
            localStorage.removeItem("pausedTaskTimer");
          } catch {}
        }

        toast.info(`Timer reset for "${task?.name}".`);
      }
    },
    [timerState, tasks, saveTimerToStorage, pausedTimer],
  );

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const stopTimerNow = useCallback(
    (taskId: string) => {
      if (timerState?.taskId !== taskId) return;

      const snapshot = timerState;
      setTimerState(null);
      saveTimerToStorage(null);
      try {
        localStorage.removeItem(PAUSE_KEY);
      } catch {}
      try {
        localStorage.removeItem(RUN_KEY);
      } catch {}

      try {
        localStorage.removeItem("pausedTaskTimer");
      } catch {}

      return snapshot;
    },
    [timerState, saveTimerToStorage],
  );

  const completeTaskWithActualDuration = useCallback(
    async (
      actualDurationMinutes: number | undefined,
      performanceRating: "Excellent" | "Good" | "Average" | "Poor" | "Lazy",
      remainingAtComplete: number | null,
    ) => {
      const rollback = stopTimerNow(taskToComplete.id);

      try {
        const updates: any = {
          status: "completed",
          completedAt: new Date().toISOString(),
        };
        if (completionLink?.trim())
          updates.completionLink = completionLink.trim();
        if (username?.trim()) updates.username = username.trim();
        if (email?.trim()) updates.email = email.trim();
        if (password?.trim()) updates.password = password;
        if (completionNotes.trim() || completionNotes === "") {
          updates.notes = completionNotes.trim() || null;
        }
        if (typeof actualDurationMinutes === "number") {
          updates.actualDurationMinutes = actualDurationMinutes;
          updates.performanceRating = performanceRating;
        }

        await handleUpdateTask(taskToComplete.id, updates);

        applyLocalTaskPatch(taskToComplete.id, updates);

        setIsCompletionConfirmOpen(false);
        setTaskToComplete(null);
        setCompletionLink("");
        setUsername("");
        setEmail("");
        setPassword("");
        setCompletionNotes("");

        // Refresh tasks to get real-time completion status
        await refreshTasks();

        if (
          timerState?.taskId === taskToComplete.id &&
          taskToComplete.idealDurationMinutes
        ) {
          if ((remainingAtComplete ?? timerState?.remainingSeconds ?? 0) <= 0) {
            toast.success(
              `Task "${taskToComplete.name}" completed with overtime!`,
            );
          } else {
            toast.success(
              `Task "${taskToComplete.name}" completed ahead of schedule!`,
            );
          }
        } else {
          toast.success(`Task "${taskToComplete.name}" marked as completed!`);
        }
      } catch (e) {
        if (rollback) {
          setTimerState(rollback);
          if (rollback.isRunning) saveTimerToStorage(rollback);
        }
        console.error("Failed to complete task:", e);
        toast.error("Failed to complete task. Please try again.");
      }
    },
    [
      taskToComplete,
      timerState,
      completionLink,
      username,
      email,
      password,
      completionNotes,
      stopTimerNow,
      handleUpdateTask,
      applyLocalTaskPatch,
      saveTimerToStorage,
      refreshTasks,
    ],
  );

  const handleTaskCompletion = useCallback(async () => {
    if (!taskToComplete) return;

    let actualDurationMinutes = taskToComplete.actualDurationMinutes;
    let remainingAtComplete: number | null = null;
    let performanceRating: "Excellent" | "Good" | "Average" | "Poor" | "Lazy" =
      "Average";

    if (
      timerState?.taskId === taskToComplete.id &&
      taskToComplete.idealDurationMinutes
    ) {
      const nowMs = Date.now();
      const taskForTimer = getTaskById(taskToComplete.id);
      const effectiveRemaining = calculateRemainingSeconds(
        taskForTimer,
        timerState,
        nowMs,
      );
      remainingAtComplete = effectiveRemaining;
      const totalTimeUsedSeconds =
        (timerState.totalSeconds || 0) - (effectiveRemaining || 0);
      const mins = Math.ceil(totalTimeUsedSeconds / 60);
      actualDurationMinutes = Math.max(1, mins || 0);

      const ratio = actualDurationMinutes / taskToComplete.idealDurationMinutes;
      if (ratio <= 1.2) performanceRating = "Excellent";
      else if (ratio <= 1.5) performanceRating = "Good";
      else if (ratio <= 2.0) performanceRating = "Average";
      else if (ratio <= 3.0) performanceRating = "Poor";
      else performanceRating = "Lazy";
    }

    await completeTaskWithActualDuration(
      actualDurationMinutes,
      performanceRating,
      remainingAtComplete,
    );
  }, [
    taskToComplete,
    timerState,
    completeTaskWithActualDuration,
    stopTimerNow,
    getTaskById,
    handleUpdateTask,
    applyLocalTaskPatch,
  ]);

  const handleTaskCompletionWithElapsed = useCallback(
    async (elapsedMinutes?: number) => {
      if (!taskToComplete) return;

      let actualDurationMinutes = taskToComplete.actualDurationMinutes;
      let performanceRating:
        | "Excellent"
        | "Good"
        | "Average"
        | "Poor"
        | "Lazy" = "Average";

      if (elapsedMinutes !== undefined) {
        // Use elapsed minutes from CompletionDialog
        actualDurationMinutes = elapsedMinutes;

        // Calculate performance rating if we have ideal duration
        if (taskToComplete.idealDurationMinutes) {
          const ratio =
            actualDurationMinutes / taskToComplete.idealDurationMinutes;
          if (ratio <= 1.2) performanceRating = "Excellent";
          else if (ratio <= 1.5) performanceRating = "Good";
          else if (ratio <= 2.0) performanceRating = "Average";
          else if (ratio <= 3.0) performanceRating = "Poor";
          else performanceRating = "Lazy";
        }
      } else if (
        timerState?.taskId === taskToComplete.id &&
        taskToComplete.idealDurationMinutes
      ) {
        // Original logic: calculate from timer state
        const nowMs = Date.now();
        const taskForTimer = getTaskById(taskToComplete.id);
        const effectiveRemaining = calculateRemainingSeconds(
          taskForTimer,
          timerState,
          nowMs,
        );
        const remainingAtComplete = effectiveRemaining;
        const totalTimeUsedSeconds =
          (timerState.totalSeconds || 0) - (effectiveRemaining || 0);
        const mins = Math.ceil(totalTimeUsedSeconds / 60);
        actualDurationMinutes = Math.max(1, mins || 0);

        const ratio =
          actualDurationMinutes / taskToComplete.idealDurationMinutes;
        if (ratio <= 1.2) performanceRating = "Excellent";
        else if (ratio <= 1.5) performanceRating = "Good";
        else if (ratio <= 2.0) performanceRating = "Average";
        else if (ratio <= 3.0) performanceRating = "Poor";
        else performanceRating = "Lazy";
      }

      await completeTaskWithActualDuration(
        actualDurationMinutes,
        performanceRating,
        null,
      );
    },
    [
      taskToComplete,
      timerState,
      completeTaskWithActualDuration,
      stopTimerNow,
      getTaskById,
      handleUpdateTask,
      applyLocalTaskPatch,
    ],
  );

  const handleCompletionCancel = useCallback(() => {
    setIsCompletionConfirmOpen(false);
    setTaskToComplete(null);
    setCompletionLink("");
    setCompletionNotes("");
  }, []);

  const handleUpdateSelectedTasks = useCallback(
    async (
      action: "completed" | "pending" | "reassigned",
      completionLink?: string,
    ) => {
      if (action === "completed") {
        const tasksToComplete = selectedTasks
          .map((id) => tasks.find((t) => t.id === id))
          .filter(
            (t): t is Task => t !== undefined && t.status !== "completed",
          );

        if (tasksToComplete.length === 1) {
          setTaskToComplete(tasksToComplete[0]);
          setIsCompletionConfirmOpen(true);
          return;
        } else if (tasksToComplete.length > 1) {
          setIsBulkCompletionOpen(true);
          return;
        }
      }

      setIsUpdating(true);
      try {
        let successCount = 0;
        let errorCount = 0;

        for (const taskId of selectedTasks) {
          try {
            const updates: any = { status: action };

            if (action === "completed") {
              updates.completedAt = new Date().toISOString();
              if (completionLink && completionLink.trim()) {
                updates.completionLink = completionLink.trim();
              }
              const task = tasks.find((t) => t.id === taskId);
              if (timerState?.taskId === taskId && task?.idealDurationMinutes) {
                const nowMs = Date.now();
                const taskForTimer = getTaskById(taskId);
                const effectiveRemaining = calculateRemainingSeconds(
                  taskForTimer,
                  timerState,
                  nowMs,
                );
                const totalTimeUsedSeconds =
                  timerState.totalSeconds - effectiveRemaining;
                const actualDurationMinutes = Math.ceil(
                  totalTimeUsedSeconds / 60,
                );

                if (actualDurationMinutes > 0) {
                  updates.actualDurationMinutes = actualDurationMinutes;

                  const ratio =
                    actualDurationMinutes / task.idealDurationMinutes;
                  if (ratio <= 1.2) updates.performanceRating = "Excellent";
                  else if (ratio <= 1.5) updates.performanceRating = "Good";
                  else if (ratio <= 2.0) updates.performanceRating = "Average";
                  else if (ratio <= 3.0) updates.performanceRating = "Poor";
                  else updates.performanceRating = "Lazy";
                }
              }
            }

            const prevStatus =
              tasksRef.current.find((t) => t.id === taskId)?.status ?? null;
            await handleUpdateTask(taskId, updates);
            applyLocalTaskPatch(taskId, updates);
            if (updates.status) {
              applyStatusDelta(prevStatus, updates.status);
            }
            successCount++;

            if (action === "completed" && timerState?.taskId === taskId) {
              setTimerState(null);
              saveTimerToStorage(null);
            }
          } catch {
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(
            `Successfully updated ${successCount} task${
              successCount !== 1 ? "s" : ""
            } to ${action === "completed" ? "completed" : action}`,
          );
          // Refresh tasks to get real-time status updates
          await refreshTasks();
        }
        if (errorCount > 0) {
          toast.error(
            `Failed to update ${errorCount} task${errorCount !== 1 ? "s" : ""}`,
          );
        }
        setSelectedTasks([]);
        setIsStatusModalOpen(false);
        setIsBulkCompletionOpen(false);
        setBulkCompletionLink("");
      } catch (err: any) {
        console.error("Failed to update tasks:", err);
        toast.error("Failed to update tasks. Please try again.");
      } finally {
        setIsUpdating(false);
      }
    },
    [
      selectedTasks,
      handleUpdateTask,
      applyLocalTaskPatch,
      tasks,
      timerState,
      getTaskById,
      saveTimerToStorage,
      refreshTasks,
    ],
  );

  const handleBulkCompletion = useCallback(() => {
    handleUpdateSelectedTasks("completed", bulkCompletionLink);
  }, [handleUpdateSelectedTasks, bulkCompletionLink]);

  const handleBulkCompletionCancel = useCallback(() => {
    setIsBulkCompletionOpen(false);
    setBulkCompletionLink("");
  }, []);

  const filteredTasks = useMemo(() => tasks, [tasks]);

  const overdueCount = stats.overdue;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerState?.isRunning) {
      interval = setInterval(() => {
        const nowMs = Date.now();
        setTimerState((prev) => {
          if (!prev || !prev.isRunning) return prev;
          const task = getTaskById(prev.taskId);
          const nextRemaining = calculateRemainingSeconds(task, prev, nowMs);
          if (nextRemaining === prev.remainingSeconds) {
            return prev;
          }

          const updatedTimer = {
            ...prev,
            remainingSeconds: nextRemaining,
          };

          const crossedOverdue =
            prev.remainingSeconds > 0 && nextRemaining <= 0;
          if (crossedOverdue) {
            if (task && task.status === "in_progress") {
              handleUpdateTask(prev.taskId, { status: "overdue" })
                .then(() => {
                  toast.warning(`Task "${task.name}" is now overdue!`, {
                    description: "Timer has exceeded the ideal duration",
                    duration: 4000,
                  });
                })
                .catch(() => console.error("Failed to set overdue"));
            }
          }

          const shouldSave =
            crossedOverdue || nowMs - lastTimerSaveRef.current >= 5000;
          if (shouldSave) {
            lastTimerSaveRef.current = nowMs;
            saveTimerToStorage(updatedTimer);
          }
          return updatedTimer;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    timerState?.isRunning,
    saveTimerToStorage,
    handleUpdateTask,
    getTaskById,
  ]);

  const error = fetchError ? fetchError.message : null;

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Loading tasks...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto">
            <Activity className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-red-600 dark:text-red-400">
              Error: {error}
            </p>
            <Button
              onClick={refreshTasks}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const onBackToClients = () => {
    if (isAnyTimerRunning) {
      toast.error(
        "Cannot navigate back while a timer is running. Please pause or complete the task first.",
      );
      return;
    }
    onBack();
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-linear-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-4 lg:p-8">
      <div className="space-y-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={onBackToClients}
              className={`hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-xl p-3 ${
                isBackButtonDisabled
                  ? "opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent"
                  : ""
              }`}
              disabled={isBackButtonDisabled}
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Clients
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                {clientName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Task Management Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end text-right">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {visibleCount} of {totalTasks} tasks
            </span>
            <Button
              onClick={refreshTasks}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
              disabled={isRefreshing}
            >
              <RefreshCw className="h-4 w-4" />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg bg-linear-to-br from-blue-500 to-blue-600 text-white">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">
                Total Tasks
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <p className="text-xs text-blue-100 mt-1">All assigned tasks</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-linear-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">
                Completed
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.completed}
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-linear-to-br from-amber-500 to-amber-600 text-white">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-100">
                In Progress
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <Play className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.inProgress}
              </div>
              <p className="text-xs text-amber-100 mt-1">
                Currently working on
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-linear-to-br from-red-500 to-red-600 text-white">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-100">
                Overdue
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {overdueCount}
              </div>
              <p className="text-xs text-red-100 mt-1">
                Need immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-linear-to-br from-purple-500 to-purple-600 text-white">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">
                QC Approved
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.qc_approved}
              </div>
              <p className="text-xs text-purple-100 mt-1">Approved by QC</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
            <DialogTrigger asChild>
              <Button className="relative rounded-2xl p-0 bg-transparent hover:bg-transparent overflow-hidden isolate">
                <BackgroundGradient className="rounded-2xl">
                  <div className="rounded-2xl px-5 py-2.5 text-white">
                    Open Client&apos;s Information
                  </div>
                </BackgroundGradient>
              </Button>
            </DialogTrigger>

            <DialogContent className="w-[95vw] max-w-6xl h-[90vh] overflow-y-auto overflow-x-hidden bg-transparent p-0">
              <div className="bg-card p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle>{clientName}</DialogTitle>
                </DialogHeader>

                {clientData ? (
                  <Suspense fallback={<ClientDashboardSkeleton />}>
                    <ClientDashboard clientData={clientData} />
                  </Suspense>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Loading client info...
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="max-w-full overflow-x-hidden">
          <TaskList
            clientName={clientName}
            tasks={tasks}
            filteredTasks={filteredTasks}
            pinnedTask={pinnedTask}
            focusTaskId={focusTaskId}
            overdueCount={overdueCount}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            totalTasks={totalTasks}
            onVisibleCountChange={setVisibleCount}
            selectedTasks={selectedTasks}
            setSelectedTasks={setSelectedTasks}
            timerState={timerState}
            handleStartTimer={handleStartTimer}
            handlePauseTimer={handlePauseTimer}
            isTaskDisabled={isTaskDisabled}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onOpenStatusModal={() => setIsStatusModalOpen(true)}
            taskToComplete={taskToComplete}
            setTaskToComplete={setTaskToComplete}
            isCompletionConfirmOpen={isCompletionConfirmOpen}
            setIsCompletionConfirmOpen={setIsCompletionConfirmOpen}
            getStatusBadge={getStatusBadge}
            onTaskComplete={handleTaskCompletion}
            getPriorityBadge={getPriorityBadge}
            formatTimerDisplay={formatTimerDisplay}
            pausedTimer={pausedTimer}
            refreshTasks={refreshTasks}
            stopTimer={stopTimerNow}
            completedTasks={completedTasksFromServer}
          />
        </div>

        <TaskDialogs
          isStatusModalOpen={isStatusModalOpen}
          setIsStatusModalOpen={setIsStatusModalOpen}
          selectedTasks={selectedTasks}
          isUpdating={isUpdating}
          handleUpdateSelectedTasks={handleUpdateSelectedTasks}
          isCompletionConfirmOpen={isCompletionConfirmOpen}
          setIsCompletionConfirmOpen={setIsCompletionConfirmOpen}
          taskToComplete={taskToComplete}
          setTaskToComplete={setTaskToComplete}
          completionLink={completionLink}
          setCompletionLink={setCompletionLink}
          username={username}
          setUsername={setUsername}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          completionNotes={completionNotes}
          setCompletionNotes={setCompletionNotes}
          timerState={timerState}
          handleTaskCompletion={handleTaskCompletionWithElapsed}
          handleCompletionCancel={handleCompletionCancel}
          isBulkCompletionOpen={isBulkCompletionOpen}
          setIsBulkCompletionOpen={setIsBulkCompletionOpen}
          bulkCompletionLink={bulkCompletionLink}
          setBulkCompletionLink={setBulkCompletionLink}
          handleBulkCompletion={handleBulkCompletion}
          handleBulkCompletionCancel={handleBulkCompletionCancel}
          tasks={tasks}
          formatTimerDisplay={formatTimerDisplay}
          clientId={clientId}
          clientName={clientName}
          clientEmail={clientData?.email}
          pausedTimer={pausedTimer}
          refreshTasks={refreshTasks}
          stopTimer={stopTimerNow}
        />
      </div>
    </div>
  );
}
