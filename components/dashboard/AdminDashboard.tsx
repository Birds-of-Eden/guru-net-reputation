// app/components/dashboard/AdminDashboard.tsx
//lint error fixed

"use client";

import { useState, useMemo } from "react";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MoveUp,
  MoveDown,
  BarChart3,
  CheckCircle2,
  Users,
  Layers,
  UserCheck,
  Calendar,
  Target,
  Clock,
  AlertTriangle,
  Bell,
  Activity,
  Briefcase,
  Package as PackageIcon,
  MessageSquare,
  Timer,
  ChevronDown,
  LineChart,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

/* -------------------- Helpers -------------------- */
const numberFmt = (n: number) =>
  Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

// Sanitize HTML to prevent XSS attacks
const sanitizeHtml = (html: string) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["a", "b", "i", "u", "strong", "em", "span"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
};

// Truncate text to 10 words
const truncateToWords = (text: string, maxWords = 10): string => {
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

const RATING_COLOR: Record<string, string> = {
  Excellent: "bg-emerald-500",
  Good: "bg-blue-500",
  Average: "bg-yellow-500",
  Poor: "bg-orange-500",
  Lazy: "bg-red-500",
};

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("this_month");

  // ✅ Use optimized SWR hook with auto-revalidation
  const {
    stats: dashboardData,
    loading,
    error: fetchError,
    getLatestItems,
  } = useDashboardStats(timeRange);

  const error = fetchError ? fetchError.message : null;

  /* ---- ✅ Use helper from hook for latest items ---- */
  const recentTasks = useMemo(
    () => getLatestItems(dashboardData?.recent?.tasks, "createdAt", 5),
    [dashboardData, getLatestItems],
  );
  const recentClients = useMemo(
    () => getLatestItems(dashboardData?.recent?.clients, "createdAt", 5),
    [dashboardData, getLatestItems],
  );
  const recentUsers = useMemo(
    () => getLatestItems(dashboardData?.recent?.users, "createdAt", 5),
    [dashboardData, getLatestItems],
  );
  const recentNotifications = useMemo(
    () => getLatestItems(dashboardData?.recent?.notifications, "createdAt", 5),
    [dashboardData, getLatestItems],
  );
  const recentActivities = useMemo(
    () => getLatestItems(dashboardData?.recent?.activities, "timestamp", 5),
    [dashboardData, getLatestItems],
  );
  // Get all teams without limiting the count
  const allTeams = useMemo(
    () => dashboardData?.teams?.data || [],
    [dashboardData],
  );

  // Get task categories with counts from the API data
  const taskCategories = useMemo(() => {
    // Get all unique categories from tasks
    const categoryMap = new Map<string, number>();

    // Process tasks to count categories
    dashboardData?.recent?.tasks?.forEach((task) => {
      if (task.categoryName) {
        categoryMap.set(
          task.categoryName,
          (categoryMap.get(task.categoryName) || 0) + 1,
        );
      }
    });

    // Convert to array and calculate percentages
    return Array.from(categoryMap.entries()).map(([name, count]) => {
      const percentage = dashboardData?.tasks?.total
        ? ((count / dashboardData.tasks.total) * 100).toFixed(1)
        : "0.0";

      return {
        name,
        count,
        percentage,
        color: getCategoryColor(name),
      };
    });

    // Helper function to get color based on category name
    function getCategoryColor(categoryName: string): string {
      const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-yellow-500",
        "bg-pink-500",
        "bg-indigo-500",
        "bg-teal-500",
        "bg-orange-500",
        "bg-cyan-500",
        "bg-rose-500",
      ];

      // Simple hash function to get consistent color for same category
      let hash = 0;
      for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
      }

      const index = Math.abs(hash) % colors.length;
      return colors[index];
    }
  }, [dashboardData]);

  const rangeLabel = useMemo(() => {
    return dashboardData?.rangeInfo?.label || "This Month";
  }, [dashboardData]);

  if (loading) return <DashboardSkeleton />;
  if (error)
    return (
      <div className="space-y-8 p-6 bg-linear-to-br from-slate-50 to-blue-50 min-h-screen dark:from-background dark:to-blue-950/40">
        <Card className="border-0 shadow-lg rounded-2xl bg-linear-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center dark:bg-red-900/40">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-300">Dashboard Error</h3>
                <p className="text-red-700 text-sm dark:text-red-300">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  if (!dashboardData) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 p-6 bg-linear-to-br from-slate-50 to-blue-50 min-h-screen dark:from-background dark:to-blue-950/40">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
              Dashboard Overview
            </h2>
            <p className="text-muted-foreground mt-2">
              {rangeLabel} • Real-time insights into your operations &
              performance
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
          <Select defaultValue={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px] border-slate-300 bg-white/80 backdrop-blur dark:border-border dark:bg-card/80">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Clients Added"
          value={numberFmt(dashboardData.clients.total)}
          change={`${dashboardData.clients.growthRate >= 0 ? "+" : ""}${
            dashboardData.clients.growthRate
          }%`}
          trend={dashboardData.clients.growthRate >= 0 ? "up" : "down"}
          description="vs previous period"
          icon={<Users className="h-6 w-6" />}
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="Tasks Completed"
          value={numberFmt(dashboardData.tasks.total)}
          change={`${dashboardData.tasks.completionRate}%`}
          trend="up"
          description="completion rate"
          icon={<Layers className="h-6 w-6" />}
          gradient="from-violet-500 to-purple-500"
        />
        <MetricCard
          title="Avg Task Time"
          value={`${dashboardData.tasks.avgCompletionTime}m`}
          change={`${numberFmt(dashboardData.tasks.completed)} done`}
          trend="up"
          description="average completion"
          icon={<Timer className="h-6 w-6" />}
          gradient="from-emerald-500 to-green-500"
        />
        <MetricCard
          title="Active Teams"
          value={numberFmt(dashboardData.overview.totalTeams)}
          change={`${dashboardData.teams.efficiency}`}
          trend="up"
          description="avg tasks / team"
          icon={<UserCheck className="h-6 w-6" />}
          gradient="from-amber-500 to-orange-500"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-linear-to-br from-white/90 to-slate-50/90 backdrop-blur-md shadow-lg border border-white/20 rounded-2xl p-1.5 gap-2 dark:from-card/90 dark:to-background/90 dark:border-border/20">
          <TabsTrigger
            value="tasks"
            className="rounded-xl data-[state=active]:bg-linear-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <Layers className="w-4 h-4 mr-1.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="clients"
            className="rounded-xl data-[state=active]:bg-linear-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <Users className="w-4 h-4 mr-1.5" />
            Clients
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="rounded-xl data-[state=active]:bg-linear-to-br data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <Briefcase className="w-4 h-4 mr-1.5" />
            Teams
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="rounded-xl data-[state=active]:bg-linear-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <LineChart className="w-4 h-4 mr-1.5" />
            Performance
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-xl data-[state=active]:bg-linear-to-br data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <Activity className="w-4 h-4 mr-1.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="rounded-xl data-[state=active]:bg-linear-to-br data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <UserCheck className="w-4 h-4 mr-1.5" />
            Users
          </TabsTrigger>
        </TabsList>

        {/* ---------- TASKS TAB ---------- */}
        <TabsContent value="tasks" className="space-y-8">
          {/* Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* STATUS BREAKDOWN */}
            <Card className="rounded-2xl border border-slate-200/60 bg-linear-to-br from-white to-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 dark:border-border/60 dark:from-card dark:to-background">
              <CardHeader className="border-b border-slate-100 py-5 bg-linear-to-r from-blue-50/70 to-indigo-50/70 backdrop-blur-sm dark:border-border dark:from-blue-950/40 dark:to-indigo-950/40">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Task Status Distribution
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm dark:text-muted-foreground">
                  Overview of current task progress
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-5">
                  {(dashboardData.tasks.byStatus || []).map((g) => {
                    const pct =
                      dashboardData.tasks.total > 0
                        ? (g.count / dashboardData.tasks.total) * 100
                        : 0;
                    const color = STATUS_COLOR[g.status] || "bg-slate-400";
                    return (
                      <div key={g.status} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn("h-3 w-3 rounded-full", color)}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-foreground">
                              {titleCase(g.status)}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-foreground">
                            {g.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn(
                            "h-2.5 bg-slate-200/70 overflow-hidden rounded-full dark:bg-muted/70",
                            `[&>div]:${color}`,
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* PRIORITY BREAKDOWN */}
            <Card className="rounded-2xl border border-slate-200/60 bg-linear-to-br from-white to-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 dark:border-border/60 dark:from-card dark:to-background">
              <CardHeader className="border-b border-slate-100 py-5 bg-linear-to-r from-purple-50/70 to-violet-50/70 backdrop-blur-sm dark:border-border dark:from-purple-950/40 dark:to-violet-950/40">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Task Priority Breakdown
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm dark:text-muted-foreground">
                  Breakdown by urgency and importance
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-5">
                  {(dashboardData.tasks.byPriority || []).map((g) => {
                    const pct =
                      dashboardData.tasks.total > 0
                        ? (g.count / dashboardData.tasks.total) * 100
                        : 0;
                    const color = PRIORITY_COLOR[g.priority] || "bg-slate-400";
                    return (
                      <div key={g.priority} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn("h-3 w-3 rounded-full", color)}
                            />
                            <span className="text-sm font-medium text-slate-700 capitalize dark:text-foreground">
                              {g.priority}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-foreground">
                            {g.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn(
                            "h-2.5 bg-slate-200/70 overflow-hidden rounded-full dark:bg-muted/70",
                            `[&>div]:${color}`,
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TASK CATEGORIES */}
          <Card className="rounded-2xl border border-slate-200/60 bg-linear-to-br from-white to-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 dark:border-border/60 dark:from-card dark:to-background">
            <CardHeader className="border-b border-slate-100 py-5 bg-linear-to-r from-cyan-50/70 to-blue-50/70 backdrop-blur-sm dark:border-border dark:from-cyan-950/40 dark:to-blue-950/40">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                <Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                Task Categories
              </CardTitle>
              <CardDescription className="text-slate-500 text-sm dark:text-muted-foreground">
                Distribution of tasks by category
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {taskCategories.length === 0 ? (
                <p className="text-sm text-slate-500 italic dark:text-muted-foreground">
                  No task categories found.
                </p>
              ) : (
                <div className="space-y-5">
                  {taskCategories.map((category) => {
                    const percentage = parseFloat(category.percentage);
                    return (
                      <div key={category.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-3 w-3 rounded-full",
                                category.color,
                              )}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-foreground">
                              {category.name}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-foreground">
                            {category.count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={percentage}
                          className={cn(
                            "h-2.5 bg-slate-200/70 overflow-hidden rounded-full dark:bg-muted/70",
                            `[&>div]:${category.color}`,
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RECENT TASKS */}
          <Card className="rounded-2xl border border-slate-200/60 bg-linear-to-br from-white to-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 dark:border-border/60 dark:from-card dark:to-background">
            <CardHeader className="border-b border-slate-100 py-5 dark:border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                    <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    Recent Tasks
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-sm dark:text-muted-foreground">
                    Last 5 task updates
                  </CardDescription>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-muted"
                >
                  <Link href="/admin/tasks">
                    View all <ChevronDown className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-3">
                {recentTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 italic dark:text-muted-foreground">
                    No recent tasks.
                  </p>
                ) : (
                  recentTasks.map((task) => {
                    const isCompleted = task.status === "completed";
                    const isInProgress = task.status === "in_progress";
                    const isOverdue = task.status === "overdue";
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200 dark:border-border dark:hover:border-border dark:hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center shadow-inner",
                              isCompleted
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : isInProgress
                                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                                  : isOverdue
                                    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                                    : "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground",
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : isInProgress ? (
                              <Clock className="h-5 w-5" />
                            ) : (
                              <Calendar className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p
                              className="font-medium text-slate-800 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 dark:text-foreground dark:[&_a]:text-blue-400 dark:[&_a:hover]:text-blue-300"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(
                                  truncateToWords(task.name),
                                ),
                              }}
                            />
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
                              {task.clientName && (
                                <span>{task.clientName}</span>
                              )}
                              {task.assignedToName && (
                                <span>• {task.assignedToName}</span>
                              )}
                              {task.categoryName && (
                                <span>• {task.categoryName}</span>
                              )}
                              {task.dueDate && (
                                <span>
                                  • Due{" "}
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium border rounded-md px-2 py-0.5 text-xs tracking-wide",
                              task.priority === "urgent"
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                                : task.priority === "high"
                                  ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
                                  : task.priority === "medium"
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800"
                                    : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
                            )}
                          >
                            {task.priority.toUpperCase()}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium border rounded-md px-2 py-0.5 text-xs tracking-wide",
                              isCompleted
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : isInProgress
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                  : isOverdue
                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                                    : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
                            )}
                          >
                            {titleCase(task.status)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- CLIENTS TAB ---------- */}
        <TabsContent value="clients" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client status */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-emerald-50/60 dark:from-card dark:to-emerald-950/40">
              <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-green-50/70 to-emerald-50/70 dark:border-border/70 dark:from-green-950/40 dark:to-emerald-950/40">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Client Status Overview
                </CardTitle>
                <CardDescription>
                  Distribution of client statuses
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(dashboardData.clients.byStatus || []).map((g) => {
                    const pct =
                      dashboardData.clients.total > 0
                        ? (g.count / dashboardData.clients.total) * 100
                        : 0;
                    return (
                      <div key={g.status} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700 capitalize dark:text-foreground">
                            {g.status}
                          </span>
                          <span className="text-sm font-medium text-slate-900 dark:text-foreground">
                            {g.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className="h-2.5 bg-slate-200 [&>div]:bg-linear-to-r [&>div]:from-green-500 [&>div]:to-emerald-500 [&>div]:rounded-full dark:bg-muted"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Latest 5 clients */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60 dark:from-card dark:to-background/60">
              <CardHeader className="border-b border-slate-200/70 py-5 dark:border-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Recent Clients
                    </CardTitle>
                    <CardDescription>Latest 5 clients</CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href="/admin/clients">
                      View all <ChevronDown className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  {recentClients.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-muted-foreground">
                      No recent clients.
                    </div>
                  )}
                  {recentClients.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100/60 transition-colors dark:hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm dark:border-border">
                          {c.avatar ? (
                            <AvatarImage src={c.avatar} alt={c.name} />
                          ) : null}
                          <AvatarFallback className="bg-linear-to-r from-blue-100 to-cyan-100 text-blue-800 font-medium dark:from-blue-900/40 dark:to-cyan-900/40 dark:text-blue-300">
                            {c.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-foreground">{c.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
                            {c.company && <span>{c.company}</span>}
                            {c.packageName && <span>• {c.packageName}</span>}
                            <span>• {c.taskCount} tasks</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {typeof c.progress === "number" && (
                          <span className="text-xs text-slate-500 dark:text-muted-foreground">
                            {c.progress}%
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            c.status?.toLowerCase() === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border",
                          )}
                        >
                          {c.status?.toUpperCase() || "UNKNOWN"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- TEAMS TAB ---------- */}
        <TabsContent value="teams" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {allTeams.map((team) => (
              <Card
                key={team.id}
                className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-indigo-50/60 dark:from-card dark:to-indigo-950/40"
              >
                <CardHeader className="border-b border-slate-200/70 py-4 dark:border-border/70">
                  <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                    <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    {team.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-muted-foreground">
                      Total Members
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-foreground">
                      {team.totalMembers}
                    </span>
                  </div>
                  <Progress
                    value={
                      team.totalMembers > 0
                        ? Math.min((team.totalMembers / 10) * 100, 100)
                        : 0
                    }
                    className="h-2 bg-slate-200 [&>div]:bg-linear-to-r [&>div]:from-indigo-500 [&>div]:to-purple-500 [&>div]:rounded-full dark:bg-muted"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---------- PERFORMANCE TAB ---------- */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ratings */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-amber-50/60 dark:from-card dark:to-amber-950/40">
              <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-yellow-50/70 to-amber-50/70 dark:border-border/70 dark:from-yellow-950/40 dark:to-amber-950/40">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Performance Ratings (QC Approved)
                </CardTitle>
                <CardDescription>Task performance rating</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(dashboardData.tasks.performanceRatings || []).map((g) => {
                    const total = (
                      dashboardData.tasks.performanceRatings || []
                    ).reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? (g.count / total) * 100 : 0;
                    const color = RATING_COLOR[g.rating] || "bg-slate-400";
                    return (
                      <div key={g.rating} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn("h-3 w-3 rounded-full", color)}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-foreground">
                              {g.rating}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-foreground">
                            {g.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn(
                            "h-2.5 bg-slate-200 [&>div]:rounded-full dark:bg-muted",
                            `[&>div]:${color}`,
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Time metrics */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-cyan-50/60 dark:from-card dark:to-cyan-950/40">
              <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-cyan-50/70 to-blue-50/70 dark:border-border/70 dark:from-cyan-950/40 dark:to-blue-950/40">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <Timer className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  Task Completion Metrics
                </CardTitle>
                <CardDescription>Completion and cadence</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-slate-900 mb-1 dark:text-foreground">
                    {dashboardData.tasks.avgCompletionTime}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-muted-foreground">
                    Average completion time (minutes)
                  </div>
                </div>
                <div className="space-y-4">
                  <Row
                    label="Tasks completed this week"
                    value={dashboardData.timeMetrics.tasksCompletedThisWeek}
                  />
                  <Row
                    label="Tasks completed this month"
                    value={dashboardData.timeMetrics.tasksCompletedThisMonth}
                  />
                  <Row
                    label="Clients added this week"
                    value={dashboardData.timeMetrics.clientsAddedThisWeek}
                  />
                  <Row
                    label="Clients added this month"
                    value={dashboardData.timeMetrics.clientsAddedThisMonth}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- ACTIVITY TAB ---------- */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latest 5 activities */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60 dark:from-card dark:to-background/60">
              <CardHeader className="border-b border-slate-200/70 py-5 dark:border-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                      <Activity className="h-5 w-5 text-slate-600 dark:text-muted-foreground" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Latest 5 system activities
                    </CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href="/admin/activity">
                      All logs <ChevronDown className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  {recentActivities.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-muted-foreground">
                      No recent activity.
                    </div>
                  )}
                  {recentActivities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-100/60 transition-colors dark:hover:bg-muted/60"
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center dark:bg-muted">
                        <Activity className="h-4 w-4 text-slate-600 dark:text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-foreground">
                          {a.action} on {a.entityType}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 dark:text-muted-foreground">
                          {a.userName && <span>by {a.userName}</span>}
                          <span>
                            • {new Date(a.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Latest 5 notifications */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-amber-50/60 dark:from-card dark:to-amber-950/40">
              <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-orange-50/70 to-amber-50/70 dark:border-border/70 dark:from-orange-950/40 dark:to-amber-950/40">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Recent Notifications
                </CardTitle>
                <CardDescription>Latest 5 notifications</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  {recentNotifications.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-muted-foreground">
                      No notifications.
                    </div>
                  )}
                  {recentNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-100/60 transition-colors dark:hover:bg-muted/60"
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center",
                          n.isRead ? "bg-slate-100 dark:bg-muted" : "bg-orange-100 dark:bg-orange-900/40",
                        )}
                      >
                        <Bell
                          className={cn(
                            "h-4 w-4",
                            n.isRead ? "text-slate-600 dark:text-muted-foreground" : "text-orange-600 dark:text-orange-400",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium text-slate-800 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 dark:text-foreground dark:[&_a]:text-blue-400 dark:[&_a:hover]:text-blue-300"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(truncateToWords(n.message)),
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 dark:text-muted-foreground">
                          <span className="capitalize">
                            {titleCase(n.type)}
                          </span>
                          {n.userName && <span>• {n.userName}</span>}
                          <span>
                            • {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-orange-500 mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- USERS TAB ---------- */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Role distribution */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-fuchsia-50/60 dark:from-card dark:to-fuchsia-950/40">
              <CardHeader className="border-b border-slate-200/70 py-5 bg-linear-to-r from-fuchsia-50/70 to-violet-50/70 dark:border-border/70 dark:from-fuchsia-950/40 dark:to-violet-950/40">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                  <UserCheck className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />
                  User Role Distribution
                </CardTitle>
                <CardDescription>Users by role</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(dashboardData.users.roleDistribution || []).map((g) => {
                    const pct =
                      dashboardData.users.total > 0
                        ? (g.count / dashboardData.users.total) * 100
                        : 0;
                    return (
                      <div key={g.role} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700 capitalize dark:text-foreground">
                            {g.role}
                          </span>
                          <span className="text-sm font-medium text-slate-900 dark:text-foreground">
                            {g.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className="h-2.5 bg-slate-200 [&>div]:bg-linear-to-r [&>div]:from-fuchsia-500 [&>div]:to-violet-500 [&>div]:rounded-full dark:bg-muted"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Latest 5 users */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60 dark:from-card dark:to-background/60">
              <CardHeader className="border-b border-slate-200/70 py-5 dark:border-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2 dark:text-foreground">
                      <Users className="h-5 w-5 text-slate-700 dark:text-foreground" />
                      Recent Users
                    </CardTitle>
                    <CardDescription>Latest 5 registered users</CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href="/admin/user">
                      View all <ChevronDown className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  {recentUsers.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-muted-foreground">
                      No recent users.
                    </div>
                  )}
                  {recentUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100/60 transition-colors dark:hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm dark:border-border">
                          {u.image ? (
                            <AvatarImage
                              src={u.image}
                              alt={u.name || u.email}
                            />
                          ) : null}
                          <AvatarFallback className="bg-linear-to-r from-slate-100 to-slate-200 text-slate-800 font-medium dark:from-background dark:to-muted dark:text-foreground">
                            {(u.name || u.email).substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-foreground">
                            {u.name || u.email}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
                            <span>{u.email}</span>
                            {u.roleName && <span>• {u.roleName}</span>}
                            <span>• {u.taskCount} tasks</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          u.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border",
                        )}
                      >
                        {u.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Small pieces -------------------- */
function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-muted-foreground">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-foreground">{numberFmt(value)}</span>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  description: string;
  icon: React.ReactNode;
  gradient?: string;
  subMetric?: string;
}

function MetricCard({
  title,
  value,
  description,
  icon,
  gradient = "from-blue-500 to-cyan-500",
  subMetric,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-border/70 dark:bg-card/90",
        "shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5",
      )}
    >
      <CardContent className="p-6">
        {/* Icon */}
        <div
          className={cn(
            "p-3 rounded-xl text-white shadow-md shadow-slate-300/30 w-fit",
            "bg-linear-to-r",
            gradient,
          )}
        >
          {icon}
        </div>

        {/* Value + Title */}
        <div className="mt-5">
          <h3 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-foreground">
            {value}
          </h3>
          <p className="text-sm text-slate-600 mt-1 font-medium dark:text-muted-foreground">{title}</p>
        </div>

        {/* Description */}
        <div className="mt-6 border-t border-slate-100 pt-3 dark:border-border">
          <p className="text-xs text-slate-500 dark:text-muted-foreground">{description}</p>
          {subMetric && (
            <p className="text-xs text-slate-400 font-semibold mt-1 dark:text-muted-foreground">
              {subMetric}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Skeleton -------------------- */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6 bg-linear-to-br from-slate-50 to-blue-50 min-h-screen dark:from-background dark:to-blue-950/40">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className="overflow-hidden border-0 rounded-2xl bg-linear-to-br from-white to-slate-50/60 dark:from-card dark:to-background/60"
          >
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-xl mb-4" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card
            key={i}
            className="border-0 shadow-lg rounded-2xl overflow-hidden"
          >
            <CardHeader className="border-b border-slate-200/70 py-5 dark:border-border/70">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-5">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-2.5 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
