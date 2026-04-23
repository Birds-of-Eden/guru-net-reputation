"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Search,
  Users,
  List,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock as ClockIcon,
  Flag,
  Calendar,
  ExternalLink,
  Filter,
  X,
} from "lucide-react";

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
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  name: string;
  priority: "low" | "medium" | "high" | "urgent";
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "overdue"
    | "cancelled"
    | "qc_approved"
    | "reassigned";
  dueDate: string | null;
  createdAt: string;
  assignedTo?: { id: string; name?: string | null };
  client?: { id: string; name: string; packageId: string };
  category?: { id: string; name: string } | null;
  completionLink?: string | null; // 👈 NEW
};

type ClientStats = {
  id: string;
  name: string;
  packageId: string;
  totalTasks: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
};

type DashboardStats = {
  totalClients: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
};

// Sanitize HTML to prevent XSS attacks
const sanitizeHtml = (html: string) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["a", "b", "i", "u", "strong", "em", "span", "p", "br"],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
  });
};

// Strip HTML tags for plain text display
const stripHtml = (html: string) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

export default function TasksPage() {
  const searchParams = useSearchParams();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [modalTasks, setModalTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientStats[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientModalLoading, setClientModalLoading] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateQuickFilter, setDateQuickFilter] = useState<string>("today");

  // ---------- helpers
  const calculateStats = (tasks: Task[]) => {
    const clientMap: Record<string, ClientStats> = {};
    const s: DashboardStats = {
      totalClients: 0,
      totalTasks: tasks.length,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    };

    for (const t of tasks) {
      if (t.status === "completed" || t.status === "qc_approved")
        s.completedTasks++;
      else if (t.status === "in_progress") s.inProgressTasks++;
      else if (t.status === "pending") s.pendingTasks++;
      else if (t.status === "overdue") s.overdueTasks++;

      if (t.client) {
        const id = t.client.id;
        if (!clientMap[id]) {
          clientMap[id] = {
            id,
            name: t.client.name,
            packageId: t.client.packageId,
            totalTasks: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            overdue: 0,
          };
        }
        const c = clientMap[id];
        c.totalTasks++;
        if (t.status === "completed" || t.status === "qc_approved")
          c.completed++;
        else if (t.status === "in_progress") c.inProgress++;
        else if (t.status === "pending") c.pending++;
        else if (t.status === "overdue") c.overdue++;
      }
    }

    s.totalClients = Object.keys(clientMap).length;
    setStats(s);
    setClients(Object.values(clientMap));
  };

  const fetchAllTasks = useCallback(
    async (startDateParam?: string, endDateParam?: string) => {
      const s = startDateParam ?? startDate;
      const e = endDateParam ?? endDate;
      try {
        setLoading(true);
        const url = `/api/tasks?${s ? `startDate=${s}&` : ""}${e ? `endDate=${e}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch tasks");
        const data: Task[] = await res.json();
        setAllTasks(data);
        calculateStats(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  const fetchTasksForClient = useCallback(
    async (clientId: string, ignoreDateFilter: boolean = false) => {
      try {
        setClientModalLoading(true);
        const url = ignoreDateFilter
          ? `/api/tasks?clientId=${clientId}`
          : `/api/tasks?${startDate ? `startDate=${startDate}&` : ""}${
              endDate ? `endDate=${endDate}&` : ""
            }clientId=${clientId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch client tasks");
        const data: Task[] = await res.json();
        setModalTasks(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load client tasks");
      } finally {
        setClientModalLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  const clientIdParam = searchParams.get("clientId");
  const clientNameParam = searchParams.get("clientName") ?? "";
  const focusTaskIdParam = searchParams.get("taskId");

  useEffect(() => {
    if (!clientIdParam) return;
    setSelectedClient(clientIdParam);
    setSelectedClientName(clientNameParam);
    setClientModalOpen(true);
    setFocusTaskId(focusTaskIdParam);
    void fetchTasksForClient(clientIdParam, Boolean(focusTaskIdParam));
  }, [clientIdParam, clientNameParam, focusTaskIdParam, fetchTasksForClient]);

  useEffect(() => {
    if (!clientModalOpen || clientModalLoading || !focusTaskId) return;
    const node = document.getElementById(`task-${focusTaskId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [clientModalOpen, clientModalLoading, modalTasks, focusTaskId]);

  // ---------- filtering for Clients list
  const filteredClients = useMemo(
    () =>
      clients.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [clients, searchQuery],
  );

  // ---------- grouping for modal
  const STATUS_ORDER: Task["status"][] = [
    "qc_approved",
    "completed",
    "in_progress",
    "pending",
    "overdue",
    "cancelled",
    "reassigned",
  ];

  const prettyStatus = (s: Task["status"]) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const statusBadgeClass = (status: Task["status"]) =>
    status === "completed"
      ? "bg-green-600 text-white hover:bg-green-700 transition-colors"
      : status === "qc_approved"
        ? "bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
        : status === "in_progress"
          ? "bg-sky-600 text-white hover:bg-sky-700 transition-colors"
          : status === "pending"
            ? "bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
            : status === "overdue"
              ? "bg-red-600 text-white hover:bg-red-700 transition-colors"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors";

  const normalizeCategory = (
    t: Task,
  ): "Social Asset" | "Web 2.0" | "Additional Asset" | "Other" => {
    const name = t.category?.name || null;
    if (!name) return "Additional Asset";
    if (/^social activity$/i.test(name)) return "Social Asset";
    if (/^web 2\.0 creation$/i.test(name)) return "Web 2.0";
    return "Other";
  };

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, Task[]> = {};

    // Filter modalTasks based on filters
    const filteredTasks = modalTasks.filter((task) => {
      // Task name search
      if (
        taskSearchQuery &&
        !stripHtml(task.name)
          .toLowerCase()
          .includes(taskSearchQuery.toLowerCase())
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "all") {
        const normalized = normalizeCategory(task);
        if (normalized !== categoryFilter) {
          return false;
        }
      }

      return true;
    });

    for (const t of filteredTasks) {
      const key = normalizeCategory(t);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    // sort each category by status (Completed → In Progress → Pending → Overdue → Cancelled), then by due date asc
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(a.status);
        const sb = STATUS_ORDER.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        const da = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Number.POSITIVE_INFINITY;
        const db = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }
    return groups;
  }, [
    modalTasks,
    taskSearchQuery,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const orderedCategories: Array<keyof typeof groupedByCategory> = [
    "Social Asset" as any,
    "Web 2.0" as any,
    "Additional Asset" as any,
    "Other" as any,
  ];

  // ---------- UI
  if (loading) {
    return (
      <div className="py-8 px-4 md:px-6">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg mb-8 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex gap-6">
              <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="flex gap-4 mb-6">
            <div className="h-10 w-64 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Client Cards Grid Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-700/60 p-6"
            >
              {/* Client Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-gray-200 rounded animate-pulse mb-4"></div>

              {/* View Button */}
              <div className="h-8 w-full bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header / Filters */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_left,rgba(16,185,129,0.10),transparent_24%)] pointer-events-none" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 mb-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Task Overview
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Task Dashboard
                </h1>
                <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
                  Monitor client activity, track task progress, and filter work
                  by date ranges from one unified workspace.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 w-full xl:w-auto">
              <Kpi
                title="Total Clients"
                value={stats.totalClients}
                icon={<Users className="h-5 w-5" />}
                color="text-blue-600 dark:text-blue-400"
                bg="bg-blue-50 dark:bg-blue-500/10"
              />
              <Kpi
                title="Total Tasks"
                value={stats.totalTasks}
                icon={<List className="h-5 w-5" />}
                color="text-violet-600 dark:text-violet-400"
                bg="bg-violet-50 dark:bg-violet-500/10"
              />
              <Kpi
                title="Completed"
                value={stats.completedTasks}
                icon={<CheckCircle className="h-5 w-5" />}
                color="text-emerald-600 dark:text-emerald-400"
                bg="bg-emerald-50 dark:bg-emerald-500/10"
              />
              <Kpi
                title="In Progress"
                value={stats.inProgressTasks}
                icon={<ClockIcon className="h-5 w-5" />}
                color="text-amber-600 dark:text-amber-400"
                bg="bg-amber-50 dark:bg-amber-500/10"
              />
              <Kpi
                title="Pending"
                value={stats.pendingTasks}
                icon={<AlertCircle className="h-5 w-5" />}
                color="text-orange-600 dark:text-orange-400"
                bg="bg-orange-50 dark:bg-orange-500/10"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/60 backdrop-blur-sm p-4 md:p-5">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="relative w-full xl:max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search clients, tasks, or package..."
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-11 pr-4 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full xl:w-auto">
                <Select
                  value={dateQuickFilter}
                  onValueChange={(value) => {
                    const now = new Date();
                    setDateQuickFilter(value);

                    if (value === "today") {
                      const d = format(now, "yyyy-MM-dd");
                      setStartDate(d);
                      setEndDate(d);
                      void fetchAllTasks(d, d);
                    } else if (value === "yesterday") {
                      const d = format(subDays(now, 1), "yyyy-MM-dd");
                      setStartDate(d);
                      setEndDate(d);
                      void fetchAllTasks(d, d);
                    } else if (value === "tomorrow") {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const d = format(tomorrow, "yyyy-MM-dd");
                      setStartDate(d);
                      setEndDate(d);
                      void fetchAllTasks(d, d);
                    } else if (value === "last_7") {
                      const s = format(subDays(now, 7), "yyyy-MM-dd");
                      const e = format(now, "yyyy-MM-dd");
                      setStartDate(s);
                      setEndDate(e);
                      void fetchAllTasks(s, e);
                    }
                  }}
                >
                  <SelectTrigger className="h-11 min-w-[180px] rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <SelectValue placeholder="Select date" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="tomorrow">Tomorrow</SelectItem>
                    <SelectItem value="last_7">Last 7 Days</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                {dateQuickFilter === "custom" && (
                  <div className="flex flex-col md:flex-row md:items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-10 w-full md:w-[155px] rounded-lg"
                      />
                    </div>

                    <span className="hidden md:inline text-slate-400">to</span>

                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10 w-full md:w-[155px] rounded-lg"
                    />

                    <Button
                      onClick={() => fetchAllTasks()}
                      className="h-10 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      Apply Filter
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clients */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-200/60 dark:border-slate-700/60">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" /> Clients ({filteredClients.length})
        </h2>

        {filteredClients.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-lg font-medium mb-2">No clients found.</p>
            <p className="text-sm">Try adjusting filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onClick={async () => {
                  setSelectedClient(client.id);
                  setSelectedClientName(client.name);
                  setClientModalOpen(true);
                  await fetchTasksForClient(client.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* No "All Tasks" section per your request */}

      {/* Client Tasks Modal */}
      <Dialog
        open={clientModalOpen}
        onOpenChange={(o) => {
          setClientModalOpen(o);
          if (!o) {
            setSelectedClient(null);
            setModalTasks([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl md:max-w-5xl lg:max-w-6xl h-[85vh] overflow-y-auto p-0">
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b bg-linear-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between w-full">
                  <span className="text-xl">
                    Tasks for{" "}
                    <span className="font-bold">
                      {selectedClientName || "Client"}
                    </span>
                    {modalTasks.length ? (
                      <span className="text-slate-500 font-normal">
                        {" "}
                        — {modalTasks.length} total
                      </span>
                    ) : null}
                  </span>
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Filter Section */}
            <div className="px-6 py-4 border-b bg-linear-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
              <div className="flex flex-wrap gap-3 pt-1">
                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">
                    Status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="qc_approved">QC Approved</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="reassigned">Reassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">
                    Priority
                  </Label>
                  <Select
                    value={priorityFilter}
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">
                    Category
                  </Label>
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Social Asset">Social Asset</SelectItem>
                      <SelectItem value="Web 2.0">Web 2.0</SelectItem>
                      <SelectItem value="Additional Asset">
                        Additional Asset
                      </SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(taskSearchQuery ||
                  statusFilter !== "all" ||
                  priorityFilter !== "all" ||
                  categoryFilter !== "all") && (
                  <div className="flex items-end pb-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTaskSearchQuery("");
                        setStatusFilter("all");
                        setPriorityFilter("all");
                        setCategoryFilter("all");
                      }}
                      className="h-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reset Filters
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {clientModalLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : modalTasks.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  No tasks for this client in the selected date range.
                </div>
              ) : (
                <div className="space-y-8">
                  {orderedCategories
                    .filter((key) => groupedByCategory[key as any]?.length)
                    .map((key) => {
                      const list = groupedByCategory[key as any] || [];
                      // further split by status order
                      const byStatus: Record<Task["status"], Task[]> = {
                        qc_approved: [],
                        completed: [],
                        in_progress: [],
                        pending: [],
                        overdue: [],
                        cancelled: [],
                        reassigned: [],
                      };
                      for (const t of list) byStatus[t.status].push(t);

                      const nonEmptyStatuses = STATUS_ORDER.filter(
                        (s) => byStatus[s].length > 0,
                      );

                      return (
                        <section key={String(key)}>
                          <header className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">
                              {String(key)}{" "}
                              <span className="text-slate-500 font-normal">
                                ({list.length})
                              </span>
                            </h3>
                          </header>

                          <div className="space-y-5">
                            {nonEmptyStatuses.map((s) => (
                              <div key={s}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={statusBadgeClass(s)}>
                                    {prettyStatus(s)}
                                  </Badge>
                                  <span className="text-sm text-slate-500">
                                    {byStatus[s].length}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                  {byStatus[s].map((task) => (
                                    <TaskMiniCard
                                      key={task.id}
                                      task={task}
                                      isFocused={focusTaskId === task.id}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900">
              <Button
                variant="outline"
                onClick={() => setClientModalOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- small, elegant UI bits ---------- */

function Kpi({
  title,
  value,
  icon,
  color,
  bg,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h3>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${color} shadow-sm`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function ClientCard({
  client,
  onClick,
}: {
  client: ClientStats;
  onClick: () => void;
}) {
  const initials = client.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const completionPct =
    client.totalTasks > 0
      ? Math.round((client.completed / client.totalTasks) * 100)
      : 0;

  const accent =
    completionPct >= 70
      ? {
          ring: "from-emerald-500/20 via-emerald-400/10 to-transparent",
          line: "from-emerald-500 to-teal-500",
          badge:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
          avatar:
            "from-emerald-500 to-teal-500 text-white shadow-emerald-500/20",
          progress: "from-emerald-500 to-teal-500",
          glow: "group-hover:shadow-emerald-500/10",
        }
      : completionPct >= 35
        ? {
            ring: "from-blue-500/20 via-sky-400/10 to-transparent",
            line: "from-blue-500 to-sky-500",
            badge:
              "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
            avatar: "from-blue-500 to-sky-500 text-white shadow-blue-500/20",
            progress: "from-blue-500 to-sky-500",
            glow: "group-hover:shadow-blue-500/10",
          }
        : {
            ring: "from-violet-500/20 via-purple-400/10 to-transparent",
            line: "from-violet-500 to-purple-500",
            badge:
              "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
            avatar:
              "from-violet-500 to-purple-500 text-white shadow-violet-500/20",
            progress: "from-violet-500 to-purple-500",
            glow: "group-hover:shadow-violet-500/10",
          };

  const stats = [
    {
      label: "Completed",
      value: client.completed,
      tone: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50/80 dark:bg-emerald-500/10",
    },
    {
      label: "In Progress",
      value: client.inProgress,
      tone: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50/80 dark:bg-blue-500/10",
    },
    {
      label: "Pending",
      value: client.pending,
      tone: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50/80 dark:bg-amber-500/10",
    },
    {
      label: "Overdue",
      value: client.overdue,
      tone: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50/80 dark:bg-rose-500/10",
    },
  ];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/60",
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur",
        "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]",
        "transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-2xl",
        accent.glow,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_left,rgba(16,185,129,0.10),transparent_24%)]" />

      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-linear-to-r",
          accent.line,
        )}
      />

      <CardHeader className="relative px-5 pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-sm font-bold shadow-lg",
              accent.avatar,
            )}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-black dark:text-slate-100 dark:group-hover:text-white">
                  {client.name}
                </h3>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  Package ID: {client.packageId}
                </p>
              </div>

              <div
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  accent.badge,
                )}
              >
                {completionPct}% Done
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative px-5 pb-4">
        <div className="mb-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Overall Progress
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {client.completed}/{client.totalTasks}
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <div
              className={cn(
                "h-full rounded-full bg-linear-to-r transition-all duration-700",
                accent.progress,
              )}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-2xl border border-slate-200/70 px-3.5 py-3 dark:border-slate-800",
                item.bg,
              )}
            >
              <div className={cn("text-xl font-bold leading-none", item.tone)}>
                {item.value}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="relative flex items-center justify-between border-t border-slate-200/70 px-5 py-3.5 dark:border-slate-800">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {client.totalTasks}
          </span>{" "}
          total tasks tracked
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 transition-all group-hover:translate-x-0.5 dark:text-slate-200">
          View details
          <ChevronRight className="h-4 w-4" />
        </div>
      </CardFooter>
    </Card>
  );
}

function TaskMiniCard({
  task,
  isFocused,
}: {
  task: Task;
  isFocused?: boolean;
}) {
  const href =
    task.completionLink && /^https?:\/\//i.test(task.completionLink)
      ? task.completionLink
      : undefined;
  const clickable = Boolean(href);

  const handleClick = () => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  const due = task.dueDate ? (
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
      <Calendar className="h-3.5 w-3.5 text-slate-400" />
      {format(new Date(task.dueDate), "MMM d, yyyy")}
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
      <Calendar className="h-3.5 w-3.5" />
      No due date
    </div>
  );

  const priorityConfig = {
    urgent: {
      bg: "bg-rose-50 text-rose-700 border-rose-100",
      icon: <AlertCircle className="h-3 w-3" />,
    },
    high: {
      bg: "bg-orange-50 text-orange-700 border-orange-100",
      icon: <Flag className="h-3 w-3" />,
    },
    medium: {
      bg: "bg-blue-50 text-blue-700 border-blue-100",
      icon: <ClockIcon className="h-3 w-3" />,
    },
    low: {
      bg: "bg-slate-50 text-slate-600 border-slate-100",
      icon: <List className="h-3 w-3" />,
    },
  };

  const p = priorityConfig[task.priority] || priorityConfig.low;

  const statusColors: Record<Task["status"], string> = {
    completed: "emerald",
    qc_approved: "teal",
    in_progress: "sky",
    pending: "amber",
    overdue: "rose",
    cancelled: "slate",
    reassigned: "indigo",
  };

  const color = statusColors[task.status] || "slate";

  return (
    <Card
      id={`task-${task.id}`}
      onClick={handleClick}
      className={cn(
        "relative h-full flex flex-col overflow-hidden border transition-all duration-300 rounded-2xl",
        "bg-linear-to-br from-white via-indigo-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-slate-200/80 dark:border-slate-800",
        "hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-1",
        clickable ? "cursor-pointer group" : "",
        isFocused ? "ring-2 ring-blue-500 ring-offset-2" : "",
      )}
    >
      {/* Top Color Accent (linear per status) */}
      {(() => {
        const statuslinear: Record<string, string> = {
          completed: "from-emerald-400 to-emerald-600",
          qc_approved: "from-teal-400 to-emerald-500",
          in_progress: "from-sky-400 to-indigo-500",
          pending: "from-amber-300 to-amber-500",
          overdue: "from-rose-400 to-rose-600",
          cancelled: "from-slate-300 to-slate-500",
          reassigned: "from-indigo-400 to-purple-500",
        };
        const g = statuslinear[task.status] || "from-slate-300 to-slate-500";
        return <div className={cn("h-1.5 w-full bg-linear-to-r", g)} />;
      })()}

      <CardHeader className="p-4 pb-2 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border",
              p.bg,
            )}
          >
            <span className="mr-1">{p.icon}</span>
            {task.priority}
          </Badge>

          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
              clickable
                ? "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                : "bg-slate-50 text-slate-400",
            )}
          >
            {clickable ? (
              <ExternalLink className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </div>
        </div>

        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-3 group-hover:text-blue-600 transition-colors">
          {stripHtml(task.name)}
        </h4>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-end">
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            {due}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 max-w-[120px]">
              <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium">
                {task.assignedTo?.name || "Unassigned"}
              </span>
            </div>
          </div>

          {href && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 group-hover:bg-blue-50 transition-colors">
              <span className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-widest">
                Action Link
              </span>
              <div className="text-[11px] text-blue-600 font-medium truncate flex items-center gap-1">
                <ExternalLink className="h-3 w-3 shrink-0" />
                {href}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
