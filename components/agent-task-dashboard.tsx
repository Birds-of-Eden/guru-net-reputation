
// app/components/agent-task-dashboard.tsx
"use client";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
  lazy,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Search,
  Activity,
  TrendingUp,
  List,
  Grid,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCcw,
  CheckCheck,
  Package2,
  Building2,
  MapPin,
  UserCircle2,
  Globe,
  ExternalLink,
} from "lucide-react";

import { useAgentClients } from "@/lib/hooks/use-agent-clients";
import {
  type TaskCounts,
  type ClientData,
  type AgentDashboardProps,
  type GlobalTimerLock,
  EMPTY_COUNTS,
  pickCounts,
  pickProgress,
  classNames,
  StatCard,
  EmptyClients,
  StatusChip,
  Pill,
} from "./agent-task-dashboard-ui";

// Lazy-load heavy client task view to keep dashboard bundle lean
const ClientTasksView = lazy(() =>
  import("@/components/client-tasks-view/client-tasks-view").then((m) => ({
    default: m.ClientTasksView,
  }))
);

export default function AgentDashboard({ agentId }: AgentDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ⚡ OPTIMIZATION: Use optimized SWR hook with aggressive caching
  const EXCLUDED_CATEGORIES = ["Social Communication"];
  const { clients: rawClients, isLoading, error } = useAgentClients({
    agentId,
    excludeCategories: EXCLUDED_CATEGORIES,
    enableCache: true,
  });

  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "card">("card");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [globalTimerLock, setGlobalTimerLock] = useState<GlobalTimerLock>({
    isLocked: false,
    taskId: null,
    agentId: null,
    taskName: null,
  });

  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ⚡ OPTIMIZATION: Normalize clients data with memoization
  const clients = useMemo(() => {
    return rawClients.map((client) => {
      const counts = pickCounts(client);
      const progress = pickProgress(client);
      return {
        ...client,
        progress,
        taskCounts: counts,
        agentTaskCounts: undefined,
      };
    });
  }, [rawClients]);

  // Preselect from query params
  useEffect(() => {
    const clientId = searchParams.get("clientId");
    const clientName = searchParams.get("clientName");

    if (clientId && clientName) {
      setSelectedClient({ id: clientId, name: clientName });
    }
  }, [searchParams]);

  // Event Handlers
  const handleViewTasks = useCallback(
    (clientId: string, clientName: string) => {
      setSelectedClient({ id: clientId, name: clientName });
      const params = new URLSearchParams();
      params.set("clientId", clientId);
      params.set("clientName", clientName);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const handleBackToClients = useCallback(() => {
    setSelectedClient(null);
    router.push(window.location.pathname, { scroll: false });
  }, [router]);

  // Computed Values
  const filteredClients = useMemo(() => {
    const needle = deferredSearch;
    return clients.filter((client) => {
      const matchesSearch =
        needle.length === 0 ||
        client.name.toLowerCase().includes(needle) ||
        (client.company ?? "").toLowerCase().includes(needle);

      const matchesStatus =
        statusFilter === "all" ||
        (client.status ?? "").toLowerCase() === statusFilter;

      const matchesProgress =
        progressFilter === "all" ||
        (progressFilter === "completed" && client.progress === 100) ||
        (progressFilter === "in_progress" &&
          client.progress > 0 &&
          client.progress < 100) ||
        (progressFilter === "not_started" && client.progress === 0);

      return matchesSearch && matchesStatus && matchesProgress;
    });
  }, [clients, deferredSearch, progressFilter, statusFilter]);

  const visibleClients = useMemo(
    () => filteredClients.slice(0, visibleCount),
    [filteredClients, visibleCount]
  );
  const filteredCount = filteredClients.length;
  const hasMore = filteredCount > visibleCount;

  // Overall stats (aggregate including new fields)
  const totalStats = useMemo(() => {
    return clients.reduce(
      (acc, client) => {
        const c = pickCounts(client);
        acc.totalClients += 1;
        acc.totalTasks += c.total;
        acc.completed += c.completed;
        acc.in_progress += c.in_progress;
        acc.pending += c.pending;
        acc.overdue += c.overdue;
        acc.cancelled += c.cancelled;
        acc.reassigned += c.reassigned;
        acc.qc_approved += c.qc_approved;
        return acc;
      },
      {
        totalClients: 0,
        totalTasks: 0,
        completed: 0,
        in_progress: 0,
        pending: 0,
        overdue: 0,
        cancelled: 0,
        reassigned: 0,
        qc_approved: 0,
      }
    );
  }, [clients]);

  const overallCompletionRate =
    totalStats.totalTasks > 0
      ? Math.round((totalStats.completed / totalStats.totalTasks) * 100)
      : 0;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearch, progressFilter, statusFilter, clients.length]);

  // Load global timer lock from localStorage
  useEffect(() => {
    const loadGlobalLock = () => {
      try {
        const lockSaved = localStorage.getItem("globalTimerLock");
        if (lockSaved) {
          const lockState = JSON.parse(lockSaved) as GlobalTimerLock;
          setGlobalTimerLock(lockState);
        }
      } catch (error) {
        console.error("Failed to load global timer lock:", error);
      }
    };

    loadGlobalLock();

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "globalTimerLock") {
        if (e.newValue) {
          const lockState = JSON.parse(e.newValue) as GlobalTimerLock;
          setGlobalTimerLock(lockState);
        } else {
          setGlobalTimerLock({
            isLocked: false,
            taskId: null,
            agentId: null,
            taskName: null,
          });
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ✅ Only self-lock matters now
  const isLockedBySelf =
    Boolean(globalTimerLock.isLocked) &&
    Boolean(globalTimerLock.agentId) &&
    globalTimerLock.agentId === agentId;

  // If viewing client tasks, route to detail component (unchanged)
  if (selectedClient) {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Loading client tasks...
              </p>
            </div>
          </div>
        }
      >
        <ClientTasksView
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          agentId={agentId!}
          onBack={handleBackToClients}
          isLockedBySelf={isLockedBySelf}
          lockedTaskId={globalTimerLock.taskId}
          lockedTaskName={globalTimerLock.taskName}
          excludedCategories={EXCLUDED_CATEGORIES}
        />
      </Suspense>
    );
  }

  // Loading & error states
  if (!agentId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full w-fit mx-auto">
            <Activity className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-yellow-600 dark:text-yellow-400">
              Agent ID Required
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Please ensure you are properly authenticated
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Loading clients...
          </p>
        </div>
      </div>
    );
  }

  if (error && clients.length === 0) {
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
          </div>
        </div>
      </div>
    );
  }

  //
  // ---------- UI ----------
  //
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent p-3">
            My Clients
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Manage tasks and track progress for your assigned clients
          </p>
        </div>
      </div>

      {/* Expanded Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mb-8">
        <StatCard
          title="Total Clients"
          value={totalStats.totalClients}
          icon={<Activity className="h-5 w-5" />}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Tasks"
          value={totalStats.totalTasks}
          subtitle={`${overallCompletionRate}% completion rate`}
          icon={<CheckCircle className="h-5 w-5" />}
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatCard
          title="In Progress"
          value={totalStats.in_progress}
          icon={<Play className="h-5 w-5" />}
          gradient="from-amber-500 to-amber-600"
        />
        <StatCard
          title="Overdue"
          value={totalStats.overdue}
          icon={<AlertCircle className="h-5 w-5" />}
          gradient="from-red-500 to-red-600"
        />
        <StatCard
          title="Completed"
          value={totalStats.completed}
          icon={<CheckCheck className="h-5 w-5" />}
          gradient="from-emerald-600 to-teal-600"
        />
        <StatCard
          title="Pending"
          value={totalStats.pending}
          icon={<Activity className="h-5 w-5" />}
          gradient="from-indigo-500 to-indigo-600"
        />
        <StatCard
          title="Reassigned"
          value={totalStats.reassigned}
          icon={<RotateCcw className="h-5 w-5" />}
          gradient="from-fuchsia-500 to-pink-600"
        />
        <StatCard
          title="QC Approved"
          value={totalStats.qc_approved}
          icon={<CheckCircle className="h-5 w-5" />}
          gradient="from-cyan-500 to-sky-600"
        />
      </div>

      {/* Management Card */}
      <Card className="border-0 shadow-xl bg-white dark:bg-gray-900 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20">
          <CardHeader className="pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <List className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  Client Management
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400 text-base">
                  Search, filter, and manage your assigned clients
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </div>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-8 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search clients by name or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={progressFilter} onValueChange={setProgressFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-12 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <SelectValue placeholder="Filter by progress" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Progress</SelectItem>
                  <SelectItem value="completed">Completed (100%)</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="not_started">Not Started (0%)</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={classNames(
                    "h-12 w-12 rounded-xl",
                    viewMode === "list"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
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
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <Grid className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Clients Display */}
          {viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCount === 0 ? (
                <EmptyClients />
              ) : (
                visibleClients.map((client) => {
                  const counts = pickCounts(client);
                  return (
                    <Card
                      key={client.id}
                      className="border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden"
                    >
                      <CardHeader className="pb-0">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                            {client.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-xl">
                              {client.name}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {client.company && (
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="h-4 w-4" />
                                  {client.company}
                                </span>
                              )}
                              {client.designation && (
                                <span className="inline-flex items-center gap-1">
                                  <UserCircle2 className="h-4 w-4" />
                                  {client.designation}
                                </span>
                              )}
                              {client.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {client.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={classNames(
                              "px-2.5 py-1 rounded-full text-xs font-semibold",
                              client.status === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : client.status === "inactive"
                                ? "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            )}
                          >
                            {client.status || "Pending"}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">
                              Progress
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-50">
                              {client.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${client.progress}%` }}
                            />
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-4 space-y-4">
                        {/* Status breakdown */}
                        <div className="grid grid-cols-3 gap-3">
                          <StatusChip
                            label="Total"
                            value={counts.total}
                            tone="default"
                          />
                          <StatusChip
                            label="Completed"
                            value={counts.completed}
                            tone="success"
                          />
                          <StatusChip
                            label="In Progress"
                            value={counts.in_progress}
                            tone="warn"
                          />
                          <StatusChip
                            label="Pending"
                            value={counts.pending}
                            tone="muted"
                          />
                          <StatusChip
                            label="Overdue"
                            value={counts.overdue}
                            tone="danger"
                          />
                          <StatusChip
                            label="Cancelled"
                            value={counts.cancelled}
                            tone="neutral"
                          />
                          <StatusChip
                            label="Reassigned"
                            value={counts.reassigned}
                            tone="pink"
                          />
                          <StatusChip
                            label="QC Approved"
                            value={counts.qc_approved}
                            tone="sky"
                          />
                        </div>

                        {/* Package & links */}
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Package2 className="h-4 w-4" />
                            <span className="font-medium">Package:</span>
                            <span>{client.package?.name ?? "No Package"}</span>
                          </div>

                          {/* Websites (only if present) */}
                          {client.websites?.map((url, idx) => (
                            <a
                              key={`${client.id}-w${idx}`}
                              href={String(url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Globe className="h-4 w-4" />
                              <span className="truncate">{url}</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {counts.completed}/{counts.total} done
                          </div>
                          <Button
                            size="sm"
                            onClick={() =>
                              handleViewTasks(client.id, client.name)
                            }
                            disabled={counts.total === 0}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            View Tasks ({counts.total})
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Client
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Progress
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Breakdown
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Package
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCount === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12">
                          <EmptyClients />
                        </td>
                      </tr>
                    ) : (
                      visibleClients.map((client) => {
                        const c = pickCounts(client);
                        return (
                          <tr
                            key={client.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                  <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                                    {client.name.substring(0, 2)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                                    {client.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    {client.company && (
                                      <span className="inline-flex items-center gap-1">
                                        <Building2 className="h-3.5 w-3.5" />
                                        {client.company}
                                      </span>
                                    )}
                                    {client.location && (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {client.location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span
                                className={classNames(
                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                  client.status === "active"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : client.status === "inactive"
                                    ? "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                )}
                              >
                                {client.status || "Pending"}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${client.progress}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-50 min-w-[3rem]">
                                  {client.progress}%
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1.5">
                                <Pill label="T" value={c.total} />
                                <Pill label="C" value={c.completed} tone="success" />
                                <Pill label="IP" value={c.in_progress} tone="warn" />
                                <Pill label="P" value={c.pending} tone="muted" />
                                <Pill label="OD" value={c.overdue} tone="danger" />
                                <Pill label="X" value={c.cancelled} tone="neutral" />
                                <Pill label="R" value={c.reassigned} tone="pink" />
                                <Pill label="QC" value={c.qc_approved} tone="sky" />
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-900 dark:text-gray-50">
                                {client.package?.name || "No Package"}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleViewTasks(client.id, client.name)
                                  }
                                  disabled={c.total === 0}
                                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  View Tasks ({c.total})
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results Summary */}
          {filteredCount > 0 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {Math.min(visibleCount, filteredCount)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {filteredCount}
                </span>{" "}
                matched clients
              </p>
              <div className="flex items-center gap-2">
                {hasMore && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setVisibleCount((c) =>
                        Math.min(filteredCount, c + PAGE_SIZE)
                      )
                    }
                  >
                    Load more
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  Back to top
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
