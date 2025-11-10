"use client";

import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { useClients } from "@/lib/hooks/use-clients";
import useSWR from "swr";
import {
  Users,
  Activity,
  CalendarDays,
  Clock,
  TrendingUp,
  AlertTriangle,
  UserCircle2,
  Loader2,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  CartesianGrid,
  Line,
} from "recharts";

import { useUserSession } from "@/lib/hooks/use-user-session";

type ClientLite = {
  id: string;
  name: string;
  status?: string | null;
  progress?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  amId?: string | null;
  packageId?: string | null;
  accountManager?: { id?: string; name?: string | null; email?: string | null } | null;
};

type FetchState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type PackageLite = { id: string; name: string };

// ---------- NEW: type for monthly progress row ----------
type MonthlyProgressRow = {
  id: string;
  name: string;
  progress: number;
  total: number;
  completed: number;
  approved: number;
};

function safeParse<T = unknown>(raw: any): T {
  if (typeof raw === "string") {
    try {
      const once = JSON.parse(raw);
      return typeof once === "string" ? (JSON.parse(once) as T) : (once as T);
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

// Enhanced color palette with professional gradients
const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  accent: "#06b6d4",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  neutral: "#64748b",
  info: "#0ea5e9",
};

const GRADIENTS = {
  indigo: "bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70",
  emerald: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70",
  amber: "bg-gradient-to-br from-amber-50 via-white to-amber-100/70",
  blue: "bg-gradient-to-br from-blue-50 via-white to-blue-100/70",
  slate: "bg-gradient-to-br from-slate-50 via-white to-slate-100/70",
};

// Fetcher for packages
const packagesFetcher = async (url: string): Promise<PackageLite[]> => {
  const res = await fetch(url, { cache: "no-store" });
  const raw = await res.json();
  const list = safeParse<any[]>(raw);
  const packages = (Array.isArray(list) ? list : Array.isArray((raw as any)?.data) ? (raw as any).data : []);
  return packages.map((p: any) => ({
    id: String(p?.id ?? ""),
    name: String(p?.name ?? "Unnamed"),
  }));
};

const AMDashboardComponent = function AMDashboard({ defaultAmId = "" }: { defaultAmId?: string }) {
  const [selectedAmId, setSelectedAmId] = useState<string>(defaultAmId);
  const { user, loading: sessionLoading } = useUserSession();

  // ---- Normalized role ----
  const role = (user?.role ?? "").toLowerCase();
  const isAM = role === "am";

  // Use optimized hooks with SWR
  const { clients: allClients, loading: clientsLoading, error: clientsError } = useClients();
  const { data: packages, isLoading: pkgLoading } = useSWR<PackageLite[]>("/api/packages", packagesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute
    refreshInterval: 300000, // 5 minutes
  });

  // Set selection from session (AM users see their own clients)
  useEffect(() => {
    if (sessionLoading) return;
    if (isAM && user?.id && selectedAmId !== user.id) {
      setSelectedAmId(user.id);
    } else if (!isAM && !selectedAmId && defaultAmId) {
      setSelectedAmId(defaultAmId);
    }
  }, [sessionLoading, isAM, user?.id, defaultAmId, selectedAmId]);

  // Filter clients by selected AM (client-side filtering on cached data)
  const clients = useMemo(() => {
    const data = allClients.filter((c) => {
      if (!selectedAmId) return true;
      const cAmId = c.amId || c.accountManager?.id;
      return cAmId === selectedAmId;
    });

    return {
      data,
      loading: clientsLoading,
      error: clientsError ? clientsError.message : null,
    };
  }, [allClients, selectedAmId, clientsLoading, clientsError]);

  // Create packages map for table display
  const pkgMap = useMemo(() => {
    const map: Record<string, string> = {};
    (packages || []).forEach((p) => {
      if (p?.id) map[p.id] = p.name;
    });
    return map;
  }, [packages]);

  // ---------- Derived metrics with memoization ----------
  const now = useMemo(() => new Date(), []);

  const statusCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of clients.data) {
      const s = (c.status ?? "unknown").toString().toLowerCase();
      acc[s] = (acc[s] ?? 0) + 1;
    }
    return acc;
  }, [clients.data]);

  const totalClients = clients.data.length;
  const activeClients = clients.data.filter((c) => (c.status ?? "").toLowerCase() === "active").length;

  const avgProgress = useMemo(() => {
    if (!clients.data.length) return 0;
    const vals = clients.data.map((c) => Number(c.progress ?? 0));
    const sum = vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return Math.round(sum / clients.data.length);
  }, [clients.data]);

  const dueIn7Days = useMemo(() => {
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    return clients.data.filter((c) => {
      if (!c.dueDate) return false;
      const d = new Date(c.dueDate);
      return d >= now && d <= in7;
    }).length;
  }, [clients.data]);

  const upcomingDueList = useMemo(() => {
    return [...clients.data]
      .filter((c) => !!c.dueDate)
      .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())
      .slice(0, 8);
  }, [clients.data]);

  // Enhanced Charts Data
  const pieData = useMemo(
    () =>
      Object.entries(statusCounts).map(([name, value], index) => ({
        name: name.replace(/_/g, " "),
        value,
        fill: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length],
      })),
    [statusCounts]
  );

  const progressBuckets = useMemo(() => {
    const buckets = [
      { label: "0–20%", min: 0, max: 20 },
      { label: "21–40%", min: 21, max: 40 },
      { label: "41–60%", min: 41, max: 60 },
      { label: "61–80%", min: 61, max: 80 },
      { label: "81–100%", min: 81, max: 100 },
    ];
    const counts = buckets.map((b) => ({ ...b, count: 0 }));
    for (const c of clients.data) {
      const p = Number(c.progress ?? 0);
      const bucket = counts.find((b) => p >= b.min && p <= b.max);
      if (bucket) bucket.count += 1;
    }
    return counts.map((b) => ({ label: b.label, count: b.count }));
  }, [clients.data]);

  // Enhanced progress chart with line overlay
  const enhancedProgressData = useMemo(
    () =>
      progressBuckets.map((bucket, index) => ({
        ...bucket,
        trend: Math.max(0, bucket.count - (progressBuckets[index - 1]?.count || 0)),
      })),
    [progressBuckets]
  );

  const startsByMonth = useMemo(() => {
    const months: { key: string; label: string; count: number }[] = [];
    const d = new Date(now);
    for (let i = 5; i >= 0; i--) {
      const temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}`;
      const label = temp.toLocaleString("en-US", { month: "short" });
      months.push({ key, label, count: 0 });
    }
    for (const c of clients.data) {
      if (!c.startDate) continue;
      const sd = new Date(c.startDate);
      const k = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}`;
      const row = months.find((m) => m.key === k);
      if (row) row.count += 1;
    }
    return months;
  }, [clients.data, now]);

  const amLabel = useMemo(() => {
    if (isAM) {
      if (user?.name && user?.email) return `${user.name}`;
      return user?.name || user?.email || "My Clients";
    }
    const cm = clients.data[0]?.accountManager;
    if (cm?.name && cm?.email) return `${cm.name}`;
    if (cm?.name || cm?.email) return cm.name || cm.email || "All AMs";
    return selectedAmId ? "Selected AM" : "All AMs";
  }, [isAM, user, selectedAmId, clients.data]);

  const formatDate = useCallback(
    (s?: string | null) =>
      s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—",
    []
  );

  // =========================================================
  // 🔹 NEW: Monthly Progress (per client) via /api/clients/[id]
  // =========================================================
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpRows, setMpRows] = useState<MonthlyProgressRow[]>([]);

  // helpers copied from client-dashboard logic (same month window + status rules)
  const monthStart = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  }, []);
  const monthEnd = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() + 1, 1);
  }, []);

  const parseDate = (v?: string | Date | null) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const normalizeStatus = (raw?: string | null) => {
    const s = (raw ?? "").toString().trim().toLowerCase().replace(/[\-\s]+/g, "_");
    if (["done", "complete", "completed", "finished", "qc_approved", "approved"].includes(s)) return "completed";
    if (["in_progress", "in-progress", "progress", "doing", "working"].includes(s)) return "in_progress";
    if (["overdue", "late"].includes(s)) return "overdue";
    if (["pending", "todo", "not_started", "on_hold", "paused", "backlog"].includes(s)) return "pending";
    return s || "pending";
  };
  const rawStatus = (raw?: string | null) => (raw ?? "").toString().trim().toLowerCase().replace(/[\-\s]+/g, "_");

  const getBestDate = (task: any): Date | null =>
    parseDate(task?.createdAt) || parseDate(task?.startDate) || parseDate(task?.dueDate);

  const inThisMonth = (task: any) => {
    const d = getBestDate(task);
    if (!d) return false;
    return d >= monthStart && d < monthEnd;
  };

  // Fetch monthly progress for all visible clients (filtered by selected AM)
  useEffect(() => {
    let isCancelled = false;

    async function run() {
      try {
        setMpLoading(true);
        setMpError(null);

        // nothing to do
        if (!clients.data.length) {
          if (!isCancelled) setMpRows([]);
          return;
        }

        // fetch all client details in parallel
        const results = await Promise.allSettled(
          clients.data.map(async (c) => {
            const res = await fetch(`/api/clients/${c.id}`, { cache: "no-store" });
            const full = await res.json();
            return { c, full };
          })
        );

        const rows: MonthlyProgressRow[] = [];

        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          const { c, full } = r.value as any;
          const tasks: any[] = Array.isArray(full?.tasks) ? full.tasks : [];

          // monthly filter
          const tasksThisMonth = tasks.filter(inThisMonth);
          const totalThisMonth = tasksThisMonth.length;

          // tallies
          let completedThisMonth = 0;
          let approvedThisMonth = 0;

          for (const t of tasksThisMonth) {
            const sRaw = rawStatus(t?.status);
            const sNorm = normalizeStatus(t?.status);
            const completedAt = parseDate(t?.completedAt);

            const isCompleted =
              (completedAt ? completedAt >= monthStart && completedAt < monthEnd : false) ||
              sNorm === "completed";
            const isApproved = sRaw === "qc_approved" || sRaw === "approved";

            if (isCompleted) completedThisMonth++;
            if (isApproved) approvedThisMonth++;
          }

          const progress = totalThisMonth
            ? Math.round(((completedThisMonth + approvedThisMonth) / totalThisMonth) * 100)
            : 0;

          rows.push({
            id: String(c.id),
            name: String(c.name ?? "Unnamed"),
            progress,
            total: totalThisMonth,
            completed: completedThisMonth,
            approved: approvedThisMonth,
          });
        }

        // sort desc by progress, then by name
        rows.sort((a, b) => (b.progress - a.progress) || a.name.localeCompare(b.name));

        if (!isCancelled) setMpRows(rows);
      } catch (e: any) {
        if (!isCancelled) setMpError(e?.message || "Failed to load monthly progress.");
      } finally {
        if (!isCancelled) setMpLoading(false);
      }
    }

    run();
    return () => {
      isCancelled = true;
    };
  }, [clients.data, monthStart, monthEnd]); // re-run if visible clients change

  return (
    <div className="space-y-6 px-4 bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen">
      {/* Enhanced Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            AM's Dashboard
          </h1>
          <p className="text-sm text-slate-600 font-medium">
            {amLabel} • {totalClients} total clients
          </p>
        </div>
      </div>

      {/* Loading / Error States */}
      {clients.loading ? (
        <div className="space-y-6">
          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`kpi-skeleton-${index}`} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-8 w-16" />
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-3 w-3 rounded" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-12 w-12 rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center">
                  <Skeleton className="h-48 w-48 rounded-full" />
                </div>
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-3 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Progress Distribution Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-36" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                      <Skeleton className="h-6 w-full rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline Chart Skeleton */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-48" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full rounded" />
            </CardContent>
          </Card>
        </div>
      ) : clients.error ? (
        <div className="flex items-center justify-center gap-3 py-16 text-rose-600 bg-white rounded-xl shadow-sm border">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{clients.error}</span>
        </div>
      ) : (
        <>
          {/* Enhanced KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className={`border-0 shadow-lg ${GRADIENTS.indigo} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total Clients
                    </p>
                    <p className="text-3xl font-bold text-slate-800">
                      {totalClients}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span>Portfolio size</span>
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-500 rounded-xl shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-lg ${GRADIENTS.emerald} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Active Clients
                    </p>
                    <p className="text-3xl font-bold text-slate-800">
                      {activeClients}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Activity className="w-3 h-3 text-emerald-500" />
                      <span>Currently engaged</span>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500 rounded-xl shadow-lg">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-lg ${GRADIENTS.amber} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Due in 7 Days
                    </p>
                    <p className="text-3xl font-bold text-slate-800">
                      {dueIn7Days}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays className="w-3 h-3 text-amber-500" />
                      <span>Upcoming deadlines</span>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500 rounded-xl shadow-lg">
                    <CalendarDays className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enhanced Status Pie Chart with Donut */}
            <Card className={`border-0 shadow-lg ${GRADIENTS.slate} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                  <div className="p-2 bg-indigo-500 rounded-lg shadow-md">
                    <PieChartIcon className="w-5 h-5 text-white" />
                  </div>
                  <span>Client Status Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {pieData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {pieData.map((entry, index) => (
                          <filter key={index} id={`glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        ))}
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.fill}
                            filter={`url(#glow-${index})`}
                          />
                        ))}
                      </Pie>
                      <RTooltip
                        formatter={(value: number) => [`${value} clients`, "Count"]}
                        contentStyle={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500 font-medium">
                    No status data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Progress Bar Chart with Line Overlay */}
            <Card className={`border-0 shadow-lg ${GRADIENTS.emerald} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                  <div className="p-2 bg-emerald-500 rounded-lg shadow-md">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span>Progress Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enhancedProgressData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                        <stop offset="50%" stopColor="#34d399" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.6} />
                      </linearGradient>
                      <filter id="barShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
                      axisLine={{ stroke: "#e2e8f0", strokeWidth: 1.5 }}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
                      axisLine={{ stroke: "#e2e8f0", strokeWidth: 1.5 }}
                      tickLine={false}
                      tickMargin={10}
                      label={{ value: "Clients", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                    />
                    <RTooltip
                      cursor={{ fill: "#f1f5f9", opacity: 0.3 }}
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: "1.5px solid #10b981",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.3), 0 8px 10px -6px rgba(16, 185, 129, 0.2)",
                        padding: "10px 14px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                      labelStyle={{ color: "#0f172a", fontWeight: 700, marginBottom: "4px" }}
                      formatter={(value: number) => [`${value} clients`, "Count"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="url(#progressGradient)"
                      radius={[8, 8, 0, 0]}
                      barSize={35}
                      filter="url(#barShadow)"
                      animationDuration={1000}
                      animationBegin={0}
                      label={{
                        position: "top",
                        fill: "#059669",
                        fontSize: 12,
                        fontWeight: 700,
                        formatter: (value: number) => value > 0 ? value : "",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="trend"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ fill: "#f59e0b", strokeWidth: 2, r: 5, stroke: "#fff" }}
                      activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 3 }}
                      strokeDasharray="5 5"
                      animationDuration={1200}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Enhanced Area Chart with Gradient */}
            <Card className={`border-0 shadow-lg ${GRADIENTS.blue} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                  <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <span>Client Onboarding Trend</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={startsByMonth} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorStarts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number) => [value, "New Clients"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="url(#colorLine)"
                      strokeWidth={3}
                      fill="url(#colorStarts)"
                      dot={{ fill: "#6366f1", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#6366f1" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Upcoming Due Table */}
          <Card className={`border-0 shadow-lg ${GRADIENTS.amber} hover:shadow-xl transition-all duration-300 mb-8`}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                <div className="p-2 bg-amber-500 rounded-lg shadow-md">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <span>Upcoming Deliverables</span>
                <Badge
                  variant="secondary"
                  className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
                >
                  {upcomingDueList.length}
                </Badge>
                <span className="ml-auto text-sm text-slate-500 font-medium hidden lg:block">
                  Viewing: {amLabel}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {upcomingDueList.length ? (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 text-left text-slate-600 border-b border-slate-200">
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Client</th>
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Status</th>
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Package</th>
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingDueList.map((c, index) => (
                        <tr
                          key={c.id}
                          className={`border-t border-slate-100 hover:bg-white/70 transition-colors duration-150 ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          }`}
                        >
                          <td className="py-4 px-6 font-semibold text-slate-800">
                            {c.name}
                          </td>
                          <td className="py-4 px-6">
                            <Badge
                              variant="outline"
                              className="border-slate-300 text-slate-700 bg-white font-medium capitalize px-3 py-1"
                            >
                              {(c.status ?? "—").toString().replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-medium">
                            {c.packageId
                              ? pkgMap[c.packageId] ??
                                (pkgLoading ? "Loading…" : c.packageId)
                              : "—"}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-amber-500" />
                              <span className="font-medium text-slate-700">
                                {formatDate(c.dueDate)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500 font-medium">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No upcoming deliverables found</p>
                  <p className="text-sm text-slate-400 mt-1">All clients are up to date</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* =========================================================
              🔻 NEW BIG HORIZONTAL BAR CHART (AT THE BOTTOM)
              "This Month Progress by Client" (uses /api/clients/[id])
          ========================================================== */}
          <Card className={`border-0 shadow-lg ${GRADIENTS.indigo} hover:shadow-xl transition-all duration-300 mb-10`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                <div className="p-2 bg-indigo-500 rounded-lg shadow-md">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span>This Month Progress by Client</span>
                {mpLoading && (
                  <span className="ml-2 inline-flex items-center text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Loading…
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[560px] p-6">
              {mpError ? (
                <div className="h-full flex items-center justify-center text-rose-600 font-medium">
                  {mpError}
                </div>
              ) : mpRows.length === 0 && !mpLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500 font-medium">
                  No client activity found for this month.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={mpRows}
                    margin={{ top: 10, right: 60, left: 10, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="mpGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
                        <stop offset="50%" stopColor="#7dd3fc" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#bae6fd" stopOpacity={0.75} />
                      </linearGradient>
                      <filter id="horizontalBarShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.3" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" horizontal={false} opacity={0.4} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
                      axisLine={{ stroke: "#e2e8f0", strokeWidth: 1.5 }}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                      tickMargin={8}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#0f172a", fontWeight: 600, fontSize: 12 }}
                      width={180}
                      axisLine={{ stroke: "#e2e8f0", strokeWidth: 1.5 }}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <RTooltip
                      cursor={{ fill: "#e0f2fe", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: "2px solid #38bdf8",
                        borderRadius: "14px",
                        boxShadow: "0 12px 28px -8px rgba(56, 189, 248, 0.4), 0 10px 12px -8px rgba(56, 189, 248, 0.3)",
                        padding: "12px 16px",
                        fontSize: "14px",
                      }}
                      labelStyle={{ color: "#0f172a", fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}
                      formatter={(value: number, _name: string, props: { payload?: MonthlyProgressRow }) => {
                        const payload = props?.payload;
                        return [
                          <div key="tooltip" className="space-y-1">
                            <div className="font-bold text-sky-600">{value}% Complete</div>
                            {payload && (
                              <div className="text-xs text-slate-600 space-y-0.5 mt-2">
                                <div>✓ Completed: <span className="font-semibold">{payload.completed}</span></div>
                                <div>✓ Approved: <span className="font-semibold">{payload.approved}</span></div>
                                <div>📊 Total Tasks: <span className="font-semibold">{payload.total}</span></div>
                              </div>
                            )}
                          </div>,
                          ""
                        ];
                      }}
                    />
                    <Bar 
                      dataKey="progress" 
                      fill="url(#mpGradient)"
                      radius={[0, 12, 12, 0]} 
                      barSize={30}
                      filter="url(#horizontalBarShadow)"
                      animationDuration={1200}
                      animationBegin={0}
                      label={{
                        position: "right",
                        fill: "#0284c7",
                        fontSize: 12,
                        fontWeight: 700,
                        formatter: (value: number) => `${value}%`,
                        offset: 8,
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// Export memoized version
export const AMDashboard = memo(AMDashboardComponent);
