//app/[role]/qc/qc-clients/page.tsx
"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
} from "react";
import useSWR from "swr";
import Link from "next/link";
import { useUserSession } from "@/lib/hooks/use-user-session";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Building2,
  Search,
  X,
  Activity,
  RefreshCw,
  Users,
  ListChecks,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  CheckCheck,
  Play,
  Grid,
  List,
  ArrowUpDown,
  Package2,
  Globe,
  ExternalLink,
  MapPin,
  UserCircle2,
} from "lucide-react";

type ClientLite = { id: string; name: string; company?: string };


type TaskRow = {
  id: string;
  status: string;
  completedAt?: string | null;
  dueDate?: string | null;
  client?: { id: string; name: string; company?: string } | null;
  qcTotalScore?: number | null;
  qcReview?: any | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
  return res.json();
};
function pct(total: number, part: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function normStatus(s?: string) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

function statusKey(t: TaskRow) {
  return normStatus(t.status);
}


function isCompleted(t: TaskRow) {
  return statusKey(t) === "completed";
}

function isQCApproved(t: TaskRow) {
  return statusKey(t) === "qc_approved";
}

function isOverdue(t: TaskRow) {
  if (!t?.dueDate) return false;

  const st = statusKey(t);

  
  if (st === "completed") return false;
  if (st === "qc_approved") return false;
  if (st === "cancelled") return false;

  return new Date(t.dueDate).getTime() < Date.now();
}

type ClientStats = {
  client: ClientLite;
  totalTasks: number;
  completed: number;
  pending: number;
  inProgress: number;
  reassigned: number;
  overdue: number;
  qcApproved: number;
  progress: number;
};

type StatusFilter =
  | "all"
  | "has_tasks"
  | "no_tasks"
  | "has_overdue"
  | "has_pending"
  | "has_inprogress"
  | "has_completed"
  | "has_qc_approved";

type ProgressFilter = "all" | "0_25" | "25_50" | "50_75" | "75_100";
type QCFilter = "all" | "needs_qc" | "qc_done";
type SortBy = "name_asc" | "tasks_desc" | "progress_desc" | "qc_desc";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function QCClientsPage() {
  const { user } = useUserSession();
  const qcId = (user as any)?.id ?? null;

  
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [qcFilter, setQcFilter] = useState<QCFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name_asc");

  
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  
  const clientsSWR = useSWR("/api/clients", fetcher);
  const clients: ClientLite[] = Array.isArray(clientsSWR.data?.clients)
    ? clientsSWR.data.clients
    : [];

 
  const tasksUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "5000"); // adjust if needed
    if (qcId) params.set("qcSupervisorId", String(qcId));
    return `/api/tasks?${params.toString()}`;
  }, [qcId]);

  const tasksSWR = useSWR(tasksUrl, fetcher);


  const tasks: TaskRow[] = useMemo(() => {
    const raw = tasksSWR.data;
    if (Array.isArray(raw)) return raw as TaskRow[];
    if (Array.isArray(raw?.tasks)) return raw.tasks as TaskRow[];
    return [];
  }, [tasksSWR.data]);

 
  const statsByClient = useMemo<ClientStats[]>(() => {
    const map = new Map<string, Omit<ClientStats, "progress">>();

    for (const t of tasks) {
      const cid = t?.client?.id;
      if (!cid) continue;

      if (!map.has(cid)) {
        map.set(cid, {
          client: {
            id: cid,
            name: t.client?.name ?? "Unknown Client",
            company: (t.client as any)?.company,
          },
          totalTasks: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          reassigned: 0,
          overdue: 0,
          qcApproved: 0,
        });
      }

      const s = map.get(cid)!;
      s.totalTasks += 1;

      const st = statusKey(t);

      if (st === "completed") s.completed += 1;
      else if (st === "pending") s.pending += 1;
      else if (st === "in_progress") s.inProgress += 1;
      else if (st === "reassigned") s.reassigned += 1;
      else if (st === "qc_approved") s.qcApproved += 1;

      if (isOverdue(t)) s.overdue += 1;
    }

    
    return Array.from(map.values()).map((s) => ({
      ...s,
     
      progress: pct(s.totalTasks, s.qcApproved),
    }));
  }, [clients, tasks]);

  
  const kpis = useMemo(() => {
    let totalTasks = 0;
    let completed = 0;
    let pending = 0;
    let inProgress = 0;
    let overdue = 0;
    let reassigned = 0;
    let qcApproved = 0;

    for (const s of statsByClient) {
      totalTasks += s.totalTasks;
      completed += s.completed;
      pending += s.pending;
      inProgress += s.inProgress;
      overdue += s.overdue;
      reassigned += s.reassigned;
      qcApproved += s.qcApproved;
    }

    return {
      totalClients: statsByClient.length,
      totalTasks,
      completed,
      pending,
      inProgress,
      overdue,
      reassigned,
      qcApproved,
    };
  }, [statsByClient]);

  
  const filtered = useMemo(() => {
    let list = statsByClient;

    if (deferredQuery) {
      list = list.filter((s) =>
        `${s.client.name ?? ""} ${s.client.company ?? ""}`
          .toLowerCase()
          .includes(deferredQuery),
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((s) => {
        if (statusFilter === "has_tasks") return s.totalTasks > 0;
        if (statusFilter === "no_tasks") return s.totalTasks === 0;
        if (statusFilter === "has_overdue") return s.overdue > 0;
        if (statusFilter === "has_pending") return s.pending > 0;
        if (statusFilter === "has_inprogress") return s.inProgress > 0;
        if (statusFilter === "has_completed") return s.completed > 0;
        if (statusFilter === "has_qc_approved") return s.qcApproved > 0;
        return true;
      });
    }

    if (progressFilter !== "all") {
      list = list.filter((s) => {
        const p = s.progress;
        if (progressFilter === "0_25") return p >= 0 && p < 25;
        if (progressFilter === "25_50") return p >= 25 && p < 50;
        if (progressFilter === "50_75") return p >= 50 && p < 75;
        if (progressFilter === "75_100") return p >= 75;
        return true;
      });
    }

    if (qcFilter !== "all") {
      list = list.filter((s) => {
        const needsQC = s.totalTasks > 0 && s.qcApproved < s.totalTasks;
        if (qcFilter === "needs_qc") return needsQC;
        if (qcFilter === "qc_done") return s.totalTasks > 0 && !needsQC;
        return true;
      });
    }

    const out = [...list];
    out.sort((a, b) => {
      if (sortBy === "name_asc")
        return a.client.name.localeCompare(b.client.name);
      if (sortBy === "tasks_desc") return b.totalTasks - a.totalTasks;
      if (sortBy === "progress_desc") return b.progress - a.progress;
      if (sortBy === "qc_desc") return b.qcApproved - a.qcApproved;
      return 0;
    });

    return out;
  }, [
    statsByClient,
    deferredQuery,
    statusFilter,
    progressFilter,
    qcFilter,
    sortBy,
  ]);

  const isLoading = clientsSWR.isLoading || tasksSWR.isLoading;
  const hasError = !!clientsSWR.error || !!tasksSWR.error;

  const refreshAll = () => {
    clientsSWR.mutate();
    tasksSWR.mutate();
  };

  const clearAll = () => {
    setQuery("");
    setStatusFilter("all");
    setProgressFilter("all");
    setQcFilter("all");
    setSortBy("name_asc");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      {/* Header (agent-dashboard style) */}
      <div className="space-y-2 pl-2">
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          QC Clients
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Client quality control overview
        </p>
      </div>

      {/* Stats Cards (agent-dashboard style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mb-8">
        <StatCard
          title="Total Clients"
          value={kpis.totalClients}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Total Tasks"
          value={kpis.totalTasks}
          subtitle={`${kpis.totalTasks ? Math.round((kpis.completed / kpis.totalTasks) * 100) : 0}% completion rate`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="In Progress"
          value={kpis.inProgress}
          icon={<Play className="h-5 w-5" />}
        />
        <StatCard
          title="Overdue"
          value={kpis.overdue}
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Completed"
          value={kpis.completed}
          icon={<CheckCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Pending"
          value={kpis.pending}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Reassigned"
          value={kpis.reassigned}
          icon={<RotateCcw className="h-5 w-5" />}
        />
        <StatCard
          title="QC Approved"
          value={kpis.qcApproved}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {/* Management Card (agent-dashboard style) */}
      <Card className="border-0 shadow-xl bg-white dark:bg-gray-900 overflow-hidden">
        <div className="bg-linear-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                    Client Task's QC Review
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 text-base">
                    Search, filter, and manage your assigned clients
                  </CardDescription>
                </div>
              </div>

              <Badge variant="outline" className="bg-white/70 rounded-xl">
                Showing{" "}
                <span className="mx-1 font-bold text-slate-900">
                  {filtered.length}
                </span>
                of{" "}
                <span className="ml-1 font-bold text-slate-900">
                  {statsByClient.length}
                </span>
              </Badge>
            </div>
          </CardHeader>
        </div>

        <CardContent className="p-6">
          {/* Filters row (same feel as agent dashboard) */}
          <div className="flex flex-col lg:flex-row gap-4 mb-8 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search clients by name or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 pr-12 h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-[190px] h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="has_tasks">Has Tasks</SelectItem>
                  <SelectItem value="no_tasks">No Tasks</SelectItem>
                  <SelectItem value="has_completed">Has Completed</SelectItem>
                  <SelectItem value="has_inprogress">
                    Has In Progress
                  </SelectItem>
                  <SelectItem value="has_pending">Has Pending</SelectItem>
                  <SelectItem value="has_overdue">Has Overdue</SelectItem>
                  <SelectItem value="has_qc_approved">
                    Has QC Approved
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={progressFilter}
                onValueChange={(v) => setProgressFilter(v as ProgressFilter)}
              >
                <SelectTrigger className="w-full sm:w-[170px] h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <SelectValue placeholder="Filter by progress" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Progress</SelectItem>
                  <SelectItem value="0_25">0–24%</SelectItem>
                  <SelectItem value="25_50">25–49%</SelectItem>
                  <SelectItem value="50_75">50–74%</SelectItem>
                  <SelectItem value="75_100">75–100%</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortBy)}
              >
                <SelectTrigger className="w-full sm:w-[170px] h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="name_asc">Sort: Name (A–Z)</SelectItem>
                  <SelectItem value="tasks_desc">Sort: Total Tasks</SelectItem>
                  <SelectItem value="progress_desc">Sort: Progress</SelectItem>
                  <SelectItem value="qc_desc">Sort: QC Approved</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearAll}
                  className="h-12 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Clear
                </Button>

                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={classNames(
                    "h-12 w-12 rounded-xl",
                    viewMode === "list"
                      ? "bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
                  )}
                  aria-label="List view"
                >
                  <List className="h-5 w-5" />
                </Button>

                <Button
                  variant={viewMode === "card" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("card")}
                  className={classNames(
                    "h-12 w-12 rounded-xl",
                    viewMode === "card"
                      ? "bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
                  )}
                  aria-label="Card view"
                >
                  <Grid className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          {hasError ? (
            <div className="text-center py-12">
              <div className="inline-flex flex-col items-center gap-4">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Failed to load clients/tasks
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Please try refreshing
                  </p>
                </div>
                <Button
                  onClick={refreshAll}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyClients onReset={clearAll} />
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((s) => (
                <ClientCard key={s.client.id} stats={s} />
              ))}
            </div>
          ) : (
            <ClientsTable rows={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card
      className="
        bg-white 
        border border-gray-200 
        rounded-xl 
        shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]
        transition-all duration-300 
        p-6
      "
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-sm text-gray-600 font-semibold tracking-wide">
            {title}
          </span>
          <span className="mt-2 text-4xl font-bold text-gray-900 leading-tight">
            {value}
          </span>
          {subtitle && (
            <span className="text-xs mt-1 text-gray-500">{subtitle}</span>
          )}
        </div>
        <div
          className="
            w-12 h-12 
            flex items-center justify-center
            rounded-xl 
            bg-gray-100 
            border border-gray-200
            text-gray-700
          "
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function EmptyClients({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="flex flex-col items-center gap-6">
        <div className="p-4 bg-linear-to-br from-slate-100 to-slate-200 rounded-2xl">
          <Search className="h-12 w-12 text-slate-400" />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-xl font-semibold text-slate-900">
            No clients found
          </h3>
          <p className="text-slate-600">
            Try adjusting your filters or clearing the search
          </p>
        </div>
        <Button
          onClick={onReset}
          variant="outline"
          className="bg-transparent rounded-xl"
        >
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

function ClientCard({ stats }: { stats: ClientStats }) {
  const href = `./qc-review?clientId=${encodeURIComponent(stats.client.id)}`;

  const countsTotal = stats.totalTasks;
  const done = stats.completed + stats.qcApproved;

  return (
    <Card className="border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
      <CardHeader className="pb-0">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
            {stats.client.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-xl">
              {stats.client.name}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats.client.company && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {stats.client.company}
                </span>
              )}
            </div>
          </div>

          <span
            className={classNames(
              "px-2.5 py-1 rounded-full text-xs font-semibold",
              stats.overdue > 0
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
            )}
          >
            {stats.overdue > 0 ? "Needs Attention" : "Active"}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Progress</span>
            <span className="font-medium text-gray-900 dark:text-gray-50">
              {stats.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <StatusChip label="Total" value={stats.totalTasks} tone="default" />
          <StatusChip
            label="Completed"
            value={stats.completed}
            tone="success"
          />
          <StatusChip label="QC Approved" value={stats.qcApproved} tone="sky" />
          <StatusChip
            label="In Progress"
            value={stats.inProgress}
            tone="warn"
          />
          <StatusChip label="Pending" value={stats.pending} tone="muted" />
          <StatusChip
            label="Overdue"
            value={stats.overdue}
            tone={stats.overdue > 0 ? "danger" : "neutral"}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {done}/{countsTotal} done
          </div>

          <Button
            size="sm"
            asChild
            disabled={countsTotal === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link href={href}>QC Review</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientsTable({ rows }: { rows: ClientStats[] }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                Client
              </th>
              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                Progress
              </th>
              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                Breakdown
              </th>
              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.client.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                        {r.client.name.substring(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                        {r.client.name}
                      </div>
                      {r.client.company && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {r.client.company}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-50 min-w-12">
                      {r.progress}%
                    </span>
                  </div>
                </td>

                <td className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Pill label="T" value={r.totalTasks} />
                    <Pill label="C" value={r.completed} tone="success" />
                    <Pill label="IP" value={r.inProgress} tone="warn" />
                    <Pill label="P" value={r.pending} tone="muted" />
                    <Pill label="OD" value={r.overdue} tone="danger" />
                    <Pill label="R" value={r.reassigned} tone="pink" />
                    <Pill label="QC" value={r.qcApproved} tone="sky" />
                  </div>
                </td>

                <td className="p-4">
                  <Button
                    size="sm"
                    asChild
                    disabled={r.totalTasks === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Link
                      href={`./qc-review?clientId=${encodeURIComponent(r.client.id)}`}
                    >
                      QC Review
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({
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
        toneClass,
      )}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2">{value}</span>
    </div>
  );
}

function Pill({
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
        map[tone],
      )}
    >
      {label}: {value}
    </span>
  );
}
