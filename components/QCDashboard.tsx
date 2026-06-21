// components/QCDashboard.tsx

"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { useAuth } from "@/context/auth-context";
import DOMPurify from "dompurify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Timer,
  CheckCircle2,
  RotateCcw,
  Gauge,
  BarChart3,
  Users,
  Activity,
} from "lucide-react";

// ---------- Types (loose, aligned to your API) ----------
export type AnyTask = any;

// ---------- Helpers shared with your ProfessionalDashboard ----------
const numberFmt = (n: number | string) =>
  Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    typeof n === "string" ? Number(n) : n
  );

const titleCase = (s: string) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

// Sanitize HTML to prevent XSS attacks
const sanitizeHtml = (html: string) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'u', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
};

// Truncate text to 10 words
const truncateToWords = (text: string, maxWords = 2): string => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}....`;
};

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-emerald-500",
  qc_approved: "bg-teal-500",
  in_progress: "bg-blue-500",
  pending: "bg-amber-500",
  reassigned: "bg-violet-500",
  overdue: "bg-red-500",
  cancelled: "bg-slate-500",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

// ---------- Metric Card (design-matched) ----------
function MetricCard({
  title,
  value,
  change,
  trend,
  description,
  icon,
  gradient = "from-blue-500 to-cyan-500",
  subMetric,
}: {
  title: string;
  value: string | number;
  change?: string | number;
  trend?: "up" | "down";
  description?: string;
  icon: React.ReactNode;
  gradient?: string;
  subMetric?: string;
}) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl border-0 rounded-2xl bg-linear-to-br from-white to-slate-50/60 backdrop-blur-sm group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "p-3 rounded-xl text-white shadow-md",
              "bg-linear-to-r",
              gradient
            )}
          >
            {icon}
          </div>
          {typeof change !== "undefined" && trend && (
            <Badge
              variant="outline"
              className={cn(
                "font-medium group-hover:shadow-sm",
                trend === "up"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              )}
            >
              {change}
            </Badge>
          )}
        </div>
        <div className="mt-5">
          <h3 className="text-3xl font-extrabold text-slate-900">{value}</h3>
          <p className="text-sm text-slate-600 mt-1 font-medium">{title}</p>
        </div>
        {(description || subMetric) && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-500">{description}</p>
            {subMetric && (
              <p className="text-xs text-slate-400 font-medium">{subMetric}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Date Range Controls ----------

type RangeType = "today" | "7" | "30" | "custom";

function RangeControls({
  range,
  setRange,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  range: RangeType;
  setRange: (v: RangeType) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
      <Select value={range} onValueChange={(v: RangeType) => setRange(v)}>
        <SelectTrigger className="h-9 w-full border-slate-300 bg-white/80 backdrop-blur sm:w-44">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {range === "custom" && (
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-end">
          <div className="grid min-w-0 gap-1">
            <Label htmlFor="start" className="text-xs">
              Start
            </Label>
            <Input
              id="start"
              type="date"
              className="h-9"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </div>
          <div className="grid min-w-0 gap-1">
            <Label htmlFor="end" className="text-xs">
              End
            </Label>
            <Input
              id="end"
              type="date"
              className="h-9"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Fetcher for tasks
const tasksFetcher = async (url: string): Promise<AnyTask[]> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

// ---------- Main ----------
export default function QCDashboardPro({
  tasks: initialTasks = [],
}: {
  tasks?: AnyTask[];
}) {
  // --- Auth context
  const { user } = useAuth();

  // --- helpers
  const now = new Date();
  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  const fmt = (d?: string | Date | null) =>
    d ? new Date(d).toLocaleString() : "—";

  const isOverdue = (t: AnyTask) => {
    const due = t?.dueDate ? new Date(t.dueDate) : null;
    const pendingish = ["pending", "reassigned"].includes(
      String(t?.status ?? "")
    );
    return !!(due && pendingish && due.getTime() < now.getTime());
  };

  // --- Date range filter
  const [range, setRange] = useState<RangeType>("today");
  const [customStart, setCustomStart] = useState<string>(toISODate(now));
  const [customEnd, setCustomEnd] = useState<string>(toISODate(now));

  // --- QC detection (match QCReview logic; dashboard always QC-scoped on backend)
  const rawRoleName = (user as any)?.role?.name ?? (user as any)?.roleId ?? "";
  const roleName = String(rawRoleName).toLowerCase?.() || "";
  const isQC =
    (user as any)?.role?.id === "qc" ||
    roleName === "qc" ||
    roleName.includes("qc") ||
    roleName === "quality_controller" ||
    roleName === "quality control";

  const { start, end } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === "7") {
      start.setDate(start.getDate() - 6);
    } else if (range === "30") {
      start.setDate(start.getDate() - 29);
    } else if (range === "custom") {
      const s = new Date(customStart || toISODate(new Date()));
      const e = new Date(customEnd || toISODate(new Date()));
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    return { start, end };
  }, [range, customStart, customEnd]);

  // Build API query so the server window matches the UI window & is ordered by latest activity
  const tasksUrl = useMemo(() => {
    const params = new URLSearchParams({
      sortBy: "updatedAt",
      sortDir: "desc",
      limit: "400",
      rangeBy: "activity", // updated/completed/created within window
      startDate: toISODate(start),
      endDate: toISODate(end),
    });

    // 🔐 HARD QC SCOPING (NO TOGGLE)
    if (isQC && user?.id) {
      params.set("qcSupervisorId", user.id);
    }

    return `/api/tasks?${params.toString()}`;
  }, [start.getTime(), end.getTime(), isQC, user?.id]);

  // ✅ Use SWR for fresher task updates
  const { data: fetchedTasks, isLoading } = useSWR<AnyTask[]>(
    tasksUrl,
    tasksFetcher,
    {
      fallbackData: initialTasks, // Use server data as fallback
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 10000, // poll every 10s to feel more real-time
      keepPreviousData: true,
    }
  );

  const tasks = fetchedTasks || initialTasks;

  // supervisedAgentIds removed; backend scoping makes guessing unnecessary

  // Primary timestamp: updatedAt → completedAt → createdAt
  const withinRange = (t: AnyTask) => {
    const stamp = new Date(
      t?.updatedAt ?? t?.completedAt ?? t?.createdAt ?? now
    );
    return stamp >= start && stamp <= end;
  };

  const rangedTasks = useMemo(
    () => tasks.filter(withinRange),
    [tasks, start.getTime(), end.getTime()]
  );

  // --- derived metrics
  const metrics = useMemo(() => {
    const total = rangedTasks.length;
    const pending = rangedTasks.filter((t) => t.status === "pending").length;
    const qcApproved = rangedTasks.filter(
      (t) => t.status === "qc_approved"
    ).length;
    const completed = rangedTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const overdue = rangedTasks.filter((t) => isOverdue(t)).length;
    const completedToday = rangedTasks.filter(
      (t) =>
        t.completedAt &&
        new Date(t.completedAt).toDateString() === now.toDateString()
    ).length;
    const reassignCount = rangedTasks.filter(
      (t) => String(t.status) === "reassigned"
    ).length;
    const reassignToday = tasks.filter(
      (t) =>
        String(t.status) === "reassigned" &&
        new Date(t.updatedAt).toDateString() === now.toDateString()
    ).length;

    return {
      total,
      pending,
      qcApproved,
      completed,
      overdue,
      completedToday,
      reassignCount,
      reassignToday,
    };
  }, [rangedTasks, tasks, now.toDateString()]);

  // --- group helpers
  const by = (arr: AnyTask[], key: (x: AnyTask) => string) => {
    const m = new Map<string, number>();
    arr.forEach((x) => m.set(key(x), (m.get(key(x)) || 0) + 1));
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };
  // --- search filter (optional quick filter)
  const [q, setQ] = useState("");
  const matches = (t: AnyTask) => {
    const hay = [
      t?.name,
      t?.status,
      t?.priority,
      t?.client?.name,
      t?.category?.name,
      t?.assignedTo?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  };

  // sanitized rows (backend already QC-scoped)
  const rows = useMemo(() => {
    return rangedTasks
      .filter(matches)
      .map((t) => ({
        id: t.id,
        name: t.name,
        client: t?.client?.name,
        category: t?.category?.name,
        assignee: t?.assignedTo?.name,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        ideal: t.idealDurationMinutes,
        actual: t.actualDurationMinutes,
        rating: t.performanceRating,
      }));
  }, [rangedTasks, q]);

  const reassignedRows = rows.filter((r) => {
    const t = rangedTasks.find((x) => x.id === r.id);
    return t ? String(t.status) === "reassigned" : false;
  });

  // --- QC Agents breakdown (backend-safe because tasks already scoped)
  const qcAgentsBreakdown = useMemo(() => {
    return by(rangedTasks, (t) => t?.assignedTo?.name || "Unassigned");
  }, [rangedTasks]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-linear-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-linear-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent">
            QC Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time overview of QC throughput & task health
            {isQC && user?.name && (
              <span className="ml-2 text-sm font-medium text-blue-600">
                • Supervised by {user.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-3 md:w-auto md:justify-end">
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <Input
              placeholder="Quick filter (client / assignee / task)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full min-w-0 border-slate-300 bg-white/80 backdrop-blur sm:w-72"
            />
          </div>
          {!isQC && (
            <Button variant="outline" size="sm" className="h-9 transition-all">
              <Users className="h-4 w-4 mr-2" />
              All Tasks
            </Button>
          )}
          <RangeControls
            range={range}
            setRange={setRange}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
        </div>
      </div>

      {/* Range badge */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
        Date Range:
        <span className="font-mono">
          {start.toLocaleDateString()} → {end.toLocaleDateString()}
        </span>
      </div>

      {/* KPI Row (design language) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <MetricCard
            title="Total"
            value={numberFmt(metrics.total)}
            description="tasks in range"
            icon={<Gauge className="h-6 w-6" />}
            gradient="from-indigo-500 to-purple-500"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <MetricCard
            title="QC Approved"
            value={numberFmt(metrics.qcApproved)}
            description="passed QC"
            icon={<CheckCircle2 className="h-6 w-6" />}
            gradient="from-emerald-500 to-green-500"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
        >
          <MetricCard
            title="Completed Task"
            value={numberFmt(metrics.completed)}
            description="done in range"
            icon={<TrendingUp className="h-6 w-6" />}
            gradient="from-blue-500 to-cyan-500"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <MetricCard
            title="Reassign Task"
            value={numberFmt(metrics.reassignCount)}
            description={`Today: ${numberFmt(metrics.reassignToday)}`}
            icon={<RotateCcw className="h-6 w-6" />}
            gradient="from-pink-500 to-rose-500"
          />
        </motion.div>
      </div>

      {/* QC Agents Breakdown (when in QC supervision mode) */}
      {isQC && qcAgentsBreakdown.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-cyan-50/60">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-cyan-50/70 to-blue-50/70">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              Supervised Agents
            </CardTitle>
            <CardDescription>Task distribution by agent</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {qcAgentsBreakdown.map((g) => {
                const total = rangedTasks.length || 1;
                const pct = (g.value / total) * 100;
                return (
                  <div key={g.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {g.name}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {numberFmt(g.value)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="h-2.5 bg-slate-200 [&>div]:rounded-full [&>div]:bg-linear-to-r [&>div]:from-cyan-500 [&>div]:to-blue-500"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status & Priority breakdown (matches your gradient bars) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status */}
        <Card className="min-w-0 border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-blue-50/60">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-blue-50/70 to-indigo-50/70">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Task Status Distribution
            </CardTitle>
            <CardDescription>Current task status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 pt-6">
            <div className="min-w-0 space-y-4">
              {by(rangedTasks, (t) => String(t.status || "unknown")).map(
                (g) => {
                  const total = rangedTasks.length || 1;
                  const pct = (g.value / total) * 100;
                  const color = STATUS_COLOR[g.name] || "bg-slate-400";
                  return (
                    <div key={g.name} className="min-w-0 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn("h-3 w-3 rounded-full", color)} />
                          <span className="truncate text-sm font-medium text-slate-700">
                            {titleCase(g.name)}
                          </span>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                          {numberFmt(g.value)} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          "h-2.5 bg-slate-200 [&>div]:rounded-full",
                          `[&>div]:${color}`
                        )}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>

        {/* Priority */}
        <Card className="min-w-0 border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-purple-50/60">
          <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-purple-50/70 to-violet-50/70">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Task Priority Breakdown
            </CardTitle>
            <CardDescription>Tasks by urgency</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 pt-6">
            <div className="min-w-0 space-y-4">
              {by(rangedTasks, (t) => String(t.priority || "unknown")).map(
                (g) => {
                  const total = rangedTasks.length || 1;
                  const pct = (g.value / total) * 100;
                  const color = PRIORITY_COLOR[g.name] || "bg-slate-400";
                  return (
                    <div key={g.name} className="min-w-0 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn("h-3 w-3 rounded-full", color)} />
                          <span className="truncate text-sm font-medium text-slate-700 capitalize">
                            {g.name}
                          </span>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                          {numberFmt(g.value)} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          "h-2.5 bg-slate-200 [&>div]:rounded-full",
                          `[&>div]:${color}`
                        )}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <Tabs defaultValue="all" className="w-full min-w-0 space-y-4">
        <TabsList
          className={cn(
            "flex w-full min-w-0 gap-2 overflow-x-auto rounded-2xl border border-slate-200/60 bg-linear-to-r from-white/90 via-slate-50/80 to-white/90 p-2 shadow-lg backdrop-blur-md",
          )}
        >
          <TabsTrigger
            value="all"
            className="min-w-[140px] flex-1 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-100/60 hover:shadow-md"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            All Tasks
          </TabsTrigger>
          <TabsTrigger
            value="qc"
            className="min-w-[140px] flex-1 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-linear-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-100/60 hover:shadow-md"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            QC Approved
          </TabsTrigger>
          <TabsTrigger
            value="overdue"
            className="min-w-[140px] flex-1 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-linear-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-100/60 hover:shadow-md"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reassign
          </TabsTrigger>
          {isQC && (
            <TabsTrigger
              value="agents"
              className="min-w-[140px] flex-1 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-linear-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-100/60 hover:shadow-md"
            >
              <Users className="h-4 w-4 mr-2" />
              Agents
            </TabsTrigger>
          )}
        </TabsList>

        {/* All Tasks */}
        <TabsContent value="all">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60">
            <CardHeader className="border-b border-slate-200/70 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-slate-700" />
                    All Tasks
                  </CardTitle>
                  <CardDescription>
                    Filtered by date range & query
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <ScrollArea className="max-h-[50vh] overflow-y-auto">
                  <Table className="w-full table-fixed text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[14%]">Task</TableHead>
                      <TableHead className="w-[12%]">Client</TableHead>
                      <TableHead className="w-[10%]">Category</TableHead>
                      <TableHead className="w-[10%]">Assignee</TableHead>
                      <TableHead className="w-[9%]">Status</TableHead>
                      <TableHead className="w-[8%]">Priority</TableHead>
                      <TableHead className="w-[10%]">Due</TableHead>
                      <TableHead className="w-[10%]">Completed</TableHead>
                      <TableHead className="w-[6%]">Ideal</TableHead>
                      <TableHead className="w-[6%]">Actual</TableHead>
                      <TableHead className="w-[5%]">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-100/60">
                        <TableCell
                          className="max-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(truncateToWords(r.name)) }}
                        />
                        <TableCell className="truncate">{r.client}</TableCell>
                        <TableCell className="truncate">{r.category}</TableCell>
                        <TableCell className="truncate">{r.assignee}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {titleCase(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="truncate">{r.priority}</TableCell>
                        <TableCell className="truncate">
                          {fmt(r.dueDate)}
                        </TableCell>
                        <TableCell className="truncate">
                          {fmt(r.completedAt)}
                        </TableCell>
                        <TableCell>{r.ideal ?? "—"}</TableCell>
                        <TableCell>{r.actual ?? "—"}</TableCell>
                        <TableCell>{r.rating ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={11}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          No tasks in this range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QC Approved */}
        <TabsContent value="qc">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60">
            <CardHeader className="border-b border-slate-200/70 py-5">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                QC Approved
              </CardTitle>
              <CardDescription>
                Only tasks with status qc_approved
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <ScrollArea className="max-h-[40vh] overflow-y-auto">
                  <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Perf</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows
                      .filter((r) => r.status === "qc_approved")
                      .map((r) => (
                        <TableRow key={r.id} className="hover:bg-slate-100/60">
                          <TableCell
                            className="font-medium [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(truncateToWords(r.name)) }}
                          />
                          <TableCell>{r.client}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.assignee}</TableCell>
                          <TableCell>{fmt(r.completedAt)}</TableCell>
                          <TableCell>{r.rating ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    {rows.filter((r) => r.status === "qc_approved").length ===
                      0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          Nothing approved in this range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overdue */}
        <TabsContent value="overdue">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60">
            <CardHeader className="border-b border-slate-200/70 py-5">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-violet-600" />
                Reassign
              </CardTitle>
              <CardDescription>Pending / reassigned tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <ScrollArea className="max-h-[40vh] overflow-y-auto">
                  <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reassignedRows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-100/60">
                        <TableCell className="font-mono text-[11px]">
                          {String(r.id).slice(0, 8)}…
                        </TableCell>
                        <TableCell
                          className="font-medium [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(truncateToWords(r.name)) }}
                        />
                        <TableCell>{r.client}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.assignee}</TableCell>
                        <TableCell>{fmt(r.dueDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {titleCase(r.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {reassignedRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          No reassigned tasks 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QC Agents Detail Tab */}
        {isQC && (
          <TabsContent value="agents">
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60">
              <CardHeader className="border-b border-slate-200/70 py-5">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-600" />
                  Supervised Agents Details
                </CardTitle>
                <CardDescription>
                  Performance metrics for each supervised agent
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <ScrollArea className="max-h-[50vh] overflow-y-auto">
                    <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent Name</TableHead>
                        <TableHead>Total Tasks</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>QC Approved</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Reassigned</TableHead>
                        <TableHead>Avg Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qcAgentsBreakdown.map((agent) => {
                        const agentTasks = rangedTasks.filter(
                          (t) => t?.assignedTo?.name === agent.name
                        );
                        const completed = agentTasks.filter(
                          (t) => t.status === "completed"
                        ).length;
                        const qcApproved = agentTasks.filter(
                          (t) => t.status === "qc_approved"
                        ).length;
                        const pending = agentTasks.filter(
                          (t) => t.status === "pending"
                        ).length;
                        const reassigned = agentTasks.filter(
                          (t) => t.status === "reassigned"
                        ).length;
                        const avgRating =
                          agentTasks.length > 0
                            ? (
                                agentTasks.reduce(
                                  (sum, t) =>
                                    sum +
                                    (typeof t.performanceRating === "number"
                                      ? t.performanceRating
                                      : 0),
                                  0
                                ) / agentTasks.length
                              ).toFixed(2)
                            : "—";

                        return (
                          <TableRow key={agent.name} className="hover:bg-slate-100/60">
                            <TableCell className="font-medium">
                              {agent.name}
                            </TableCell>
                            <TableCell>{numberFmt(agent.value)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-50">
                                {completed}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-teal-50">
                                {qcApproved}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-50">
                                {pending}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-violet-50">
                                {reassigned}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {avgRating}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {qcAgentsBreakdown.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-sm text-muted-foreground py-8"
                          >
                            No supervised agents in this range.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
