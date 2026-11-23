// app/[role]/distribution/client-agent/tasks/page.tsx

"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutList,
  Search,
  Clock,
  ChevronRight,
  ArrowLeft,
  CalendarDays,
  Timer,
  Link2,
  User,
  Bookmark,
  ClipboardCopy,
  Eye,
  EyeOff,
  Filter,
  BarChart3,
  Hash,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitialsFromName, nameToColor } from "@/utils/avatar";
import { toast } from "sonner";
import { Building2, Package } from "lucide-react";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { CreateNewTaskModal } from "@/components/task-distribution/CreateNewTask";

/* =========================
   Types (w/ richer fields)
   ========================= */
type Task = {
  id: string;
  name: string;
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "overdue"
    | "cancelled"
    | "reassigned"
    | "qc_approved";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  createdAt: string;
  idealDurationMinutes: number | null;

  completionLink: string | null;
  username: string | null;
  email?: string | null; // <- ensure your API includes these
  password?: string | null; // <-
  notes: string | null;

  clientId: string;
  category?: { name: string } | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

type Summary = {
  total: number;
  countsByStatus: Record<string, number>;
  countsByPriority: Record<string, number>;
  countsByCategory: Record<string, number>;
};

type ClientHeader = {
  id: string;
  name: string;
  company: string | null;
  avatar: string | null;
  status: string | null;
  package: { name: string | null } | null;
};

/** Small type for section groups keyed by due date */
type CycleGroup = { key: string; items: Task[]; label: string };

/* =========================
   Helpers
   ========================= */

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/** Format either an ISO datetime or a YYYY-MM-DD string as "October 25, 2025" */
function formatDateLong(input?: string | null) {
  if (!input) return "—";
  // Accept both full ISO ("2025-10-25T12:34:56Z") and date-only ("2025-10-25")
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : dateOnlyISO(input);
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local date
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Return a YYYY-MM-DD date from an ISO string (or null). */
function dateOnlyISO(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

/** Pick the cycle’s representative date:
 *  - most frequent dueDate date (YYYY-MM-DD)
 *  - fallback to createdAt date
 *  - tie-breaker: earliest date
 */
function pickCycleDateISO(items: Task[]): string | null {
  const counts: Record<string, number> = {};
  for (const t of items) {
    const base = dateOnlyISO(t.dueDate) ?? dateOnlyISO(t.createdAt);
    if (!base) continue;
    counts[base] = (counts[base] ?? 0) + 1;
  }
  const keys = Object.keys(counts);
  if (!keys.length) return null;
  keys.sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)); // by freq desc, then earliest
  return keys[0]; // YYYY-MM-DD
}

/** Extract trailing cycle number: “… -1” / “…-1” / “… – 1” etc. */
function extractCycleNumber(name: string): number | null {
  const m = String(name)
    .trim()
    .match(/(?:-|—|\u2013)\s*(\d+)\s*$/);
  if (m && m[1]) return Number(m[1]);
  const m2 = String(name)
    .trim()
    .match(/(?:^|\s)(\d+)$/);
  if (m2 && m2[1]) return Number(m2[1]);
  return null;
}

async function copyToClipboard(v?: string | null, label?: string) {
  if (!v) return;
  try {
    await navigator.clipboard.writeText(v);
    toast.success(label ?? "Copied");
  } catch {
    toast.error("Copy failed");
  }
}

/* Status / priority / category color helpers */
const statusColor = (s: Task["status"]) =>
  ({
    pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    in_progress: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    overdue: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border",
    reassigned: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
    qc_approved: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
  }[s] || "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border");

const priorityColor = (p: Task["priority"]) =>
  ({
    low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border",
    medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
    urgent: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  }[p] || "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border");

const categoryColor = (c?: string) =>
  ({
    "Social Activity": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 dark:border-fuchsia-800",
    "Blog Posting": "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800",
    "Social Communication": "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
    "Content Writing": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    "Guest Posting": "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
    "Content Studio": "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
    Backlinks: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    "Completed Communication": "bg-slate-100 text-slate-800 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border",
    "YouTube Video Optimization": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    Monitoring: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800",
    "Review Removal": "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/40 dark:text-lime-300 dark:border-lime-800",
    "Summary Report": "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-800",
  }[c ?? ""] || "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-foreground dark:border-border");

/* Lighter cycle header gradients */
const cycleGrad = (n: number) => {
  const palette = [
    "from-indigo-100 via-fuchsia-100 to-cyan-100 dark:from-indigo-900/40 dark:via-fuchsia-900/40 dark:to-cyan-900/40",
    "from-emerald-100 via-teal-100 to-cyan-100 dark:from-emerald-900/40 dark:via-teal-900/40 dark:to-cyan-900/40",
    "from-rose-100 via-orange-100 to-amber-100 dark:from-rose-900/40 dark:via-orange-900/40 dark:to-amber-900/40",
    "from-blue-100 via-violet-100 to-pink-100 dark:from-blue-900/40 dark:via-violet-900/40 dark:to-pink-900/40",
  ];
  return palette[(n - 1) % palette.length];
};

export default function CreatedTasksPage() {
  const router = useRouter();
  const params = useSearchParams();
  const roleSegment = useRoleSegment();
  const distributionBasePath = `/${roleSegment}/distribution/client-agent`;

  const [cycleHeaders, setCycleHeaders] = useState<any[]>([]);
  const [cycleTasks, setCycleTasks] = useState<Record<string, Task[]>>({});
  const [loadingCycle, setLoadingCycle] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  // UI State
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"dueAsc" | "dueDesc" | "createdDesc">(
    "dueAsc"
  );

  const [showPasswordIds, setShowPasswordIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedCycles, setExpandedCycles] = useState<Record<string, boolean>>(
    {}
  );
  const cyclesNavRef = useRef<HTMLDivElement | null>(null);

  const [client, setClient] = useState<ClientHeader | null>(null);

  // Modal state for creating manual tasks
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // incoming client selection via query param
  const clientId = params.get("clientId") ?? "";

  const fetcher = async (url: string) => {
    console.log("Fetching:", url);
    try {
      const res = await fetch(url, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch error:", res.status, errorText);
        throw new Error(`Failed to fetch (${res.status}): ${errorText}`);
      }
      const data = await res.json();
      console.log("Fetch success:", data);
      return data;
    } catch (error) {
      console.error("Fetch failed:", error);
      throw error;
    }
  };

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // SWR for cycle headers only
  const cycleHeadersKey = useMemo(() => {
    const qs = new URLSearchParams();
    if (clientId) qs.set("clientId", clientId);
    if (debouncedQ) qs.set("q", debouncedQ);
    if (status !== "all") qs.set("status", status);
    if (priority !== "all") qs.set("priority", priority);
    if (category !== "all") qs.set("category", category);
    qs.set("cycleHeadersOnly", "true");
    return `/api/tasks/created?${qs.toString()}`;
  }, [clientId, debouncedQ, status, priority, category]);

  const {
    data: cycleHeadersResp,
    isLoading: loadingHeaders,
    error: headersError,
    mutate: mutateHeaders,
  } = useSWR(cycleHeadersKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 0, // Remove aggressive deduping
    refreshInterval: 0,   // Remove auto-refresh
    onSuccess: (data) => {
      console.log("Cycle headers loaded:", data);
      setCycleHeaders(data.cycles || []);
      setSummary(data.summary || null);
    },
    onError: (error) => {
      console.error("Failed to load cycle headers:", error);
    },
  });

  // Load tasks for a specific cycle
  const loadCycleTasks = async (cycleKey: string) => {
    if (cycleTasks[cycleKey]) return;

    setLoadingCycle(cycleKey);
    try {
      const qs = new URLSearchParams();
      if (clientId) qs.set("clientId", clientId);
      if (debouncedQ) qs.set("q", debouncedQ);
      if (status !== "all") qs.set("status", status);
      if (priority !== "all") qs.set("priority", priority);
      if (category !== "all") qs.set("category", category);
      qs.set("cycleKey", cycleKey);

      const res = await fetch(`/api/tasks/created?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch cycle tasks (${res.status})`);
      const data = await res.json();

      setCycleTasks((prev) => ({
        ...prev,
        [cycleKey]: data.tasks || [],
      }));
    } catch (error) {
      console.error("Failed to load cycle tasks:", error);
      toast.error("Failed to load tasks for this cycle");
    } finally {
      setLoadingCycle(null);
    }
  };

  const refreshTasks = () => {
    mutateHeaders();
    setCycleTasks({});
    setExpandedCycles({});
  };

  // Fallback client header via SWR if not present from tasks
  const { data: clientFromApi } = useSWR<ClientHeader | null>(
    clientId && !client ? `/api/clients/${clientId}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  useEffect(() => {
    if (clientFromApi && !client) {
      setClient({
        id: clientFromApi.id,
        name: clientFromApi.name,
        company: clientFromApi.company,
        avatar: clientFromApi.avatar,
        status: clientFromApi.status,
        package: clientFromApi.package,
      });
    }
  }, [clientFromApi, client]);

  useEffect(() => {
    // re-derive sorted groups when filters change (SWR handles data)
  }, [q, status, priority, category, sort]);

  // Initialize expanded cycles state when headers load
  useEffect(() => {
    if (cycleHeaders.length > 0) {
      setExpandedCycles((prev) => {
        if (Object.keys(prev).length) return prev;

        const init: Record<string, boolean> = {};
        cycleHeaders.forEach((c: any) => {
          init[c.cycleKey] = false; // ✅ all collapsed initially
        });

        return init;
      });
    }
  }, [cycleHeaders]);

  // Immediate fetch trigger for initial load
  useEffect(() => {
    if (clientId && cycleHeadersKey && !cycleHeadersResp && !loadingHeaders) {
      console.log("Triggering immediate fetch for cycle headers");
      mutateHeaders();
    }
  }, [clientId, cycleHeadersKey, cycleHeadersResp, loadingHeaders, mutateHeaders]);

  const toggleCycle = (key: string) => {
    setExpandedCycles((s) => ({ ...s, [key]: !s[key] }));
    
    // Load tasks if expanding and not already loaded
    if (!expandedCycles[key] && !cycleTasks[key]) {
      loadCycleTasks(key);
    }
  };

  const goBack = () => router.push(distributionBasePath);

  return (
    <div className="min-h-screen bg-linear-to-br from-violet-50 via-white to-cyan-50 dark:from-violet-950/40 dark:via-card dark:to-cyan-950/40">
      <div>
        {/* Lighter Header */}
        <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur dark:bg-card/90">
          <CardHeader className="relative text-slate-800 border-b border-slate-200/60 bg-sky-50 dark:text-foreground dark:border-border/60 dark:bg-sky-950/40">
            <div className="p-6">
              {/* Top-left Back button */}
              <div className="mb-4">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  className="h-9 px-3 -ml-2 text-slate-700 hover:bg-slate-100 dark:text-foreground dark:hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>

              {/* Client information (below back button) */}
              {client && (
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-14 w-14 ring-2 ring-slate-200 dark:ring-border">
                    {client.avatar ? (
                      <AvatarImage src={client.avatar} alt={client.name} />
                    ) : (
                      <AvatarFallback
                        className="text-white font-semibold"
                        style={{ backgroundColor: nameToColor(client.name) }}
                      >
                        {getInitialsFromName(client.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate dark:text-foreground">
                        {client.name}
                      </h2>

                      {client.status && (
                        <Badge
                          variant="outline"
                          className={`rounded-full text-xs border ${
                            client.status === "active"
                              ? "text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700"
                              : "text-slate-600 border-slate-300 dark:text-muted-foreground dark:border-border"
                          }`}
                        >
                          {client.status}
                        </Badge>
                      )}

                      {client.package?.name && (
                        <Badge
                          variant="outline"
                          className="rounded-full text-xs border border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"
                        >
                          <Package className="h-3 w-3 mr-1" />
                          {client.package.name}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1.5 text-sm text-slate-600 flex items-center gap-2 dark:text-muted-foreground">
                      <Building2 className="h-4 w-4 text-slate-400 dark:text-muted-foreground" />
                      <span className="truncate">
                        {client.company || "No company"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                {/* Title & subtitle */}
                <div className="space-y-1">
                  <CardTitle className="text-3xl font-bold flex items-center gap-3 text-slate-800 dark:text-foreground">
                    <div className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center dark:border-border">
                      <LayoutList className="h-6 w-6 text-slate-700 dark:text-foreground" />
                    </div>
                    Created Tasks — Cycle View
                  </CardTitle>
                </div>
                <div
                  className="flex items-center gap-2 p-4 font-bold text-violet-50 cursor-pointer"
                  onClick={() => setIsCreateTaskModalOpen(true)}
                >
                  <BackgroundGradient className="flex items-center gap-2 p-4">
                    <ListTodo />
                    Create Tasks Manually
                  </BackgroundGradient>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Top Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search tasks, notes, usernames, links…"
                  className="pl-9 h-11 rounded-xl"
                />
              </div>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="qc_approved">QC Approved</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="reassigned">Reassigned</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Social Activity">
                    Social Activity
                  </SelectItem>
                  <SelectItem value="Blog Posting">Blog Posting</SelectItem>
                  <SelectItem value="Social Communication">
                    Social Communication
                  </SelectItem>
                  <SelectItem value="Content Writing">
                    Content Writing
                  </SelectItem>
                  <SelectItem value="Guest Posting">Guest Posting</SelectItem>
                  <SelectItem value="Content Studio">Content Studio</SelectItem>
                  <SelectItem value="Backlinks">Backlinks</SelectItem>
                  <SelectItem value="Completed Communication">
                    Completed Communication
                  </SelectItem>
                  <SelectItem value="YouTube Video Optimization">
                    YouTube Video Optimization
                  </SelectItem>
                  <SelectItem value="Monitoring">Monitoring</SelectItem>
                  <SelectItem value="Review Removal">Review Removal</SelectItem>
                  <SelectItem value="Summary Report">Summary Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="rounded-xl border-2 border-indigo-100 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/40">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-indigo-700 dark:text-indigo-300">Total Tasks</div>
                    <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-300">
                      {summary?.total ?? (loadingHeaders ? "…" : 0)}
                    </div>
                  </div>
                  <ListTodo className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border-2 border-fuchsia-100 bg-fuchsia-50/60 dark:border-fuchsia-800 dark:bg-fuchsia-950/40">
                <CardContent className="p-4">
                  <div className="text-sm text-fuchsia-700 mb-2 flex items-center gap-2 dark:text-fuchsia-300">
                    <Filter className="h-4 w-4" />
                    By Status
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary ? (
                      Object.entries(summary.countsByStatus).map(([s, n]) => (
                        <Badge
                          key={s}
                          variant="outline"
                          className="bg-white text-fuchsia-800 border-fuchsia-200 dark:bg-card dark:text-fuchsia-300 dark:border-fuchsia-800"
                        >
                          {s.replaceAll("_", " ")}:{" "}
                          <span className="ml-1 font-semibold">{n}</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-fuchsia-700/70 dark:text-fuchsia-300/70">—</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-2 border-cyan-100 bg-cyan-50/60 dark:border-cyan-800 dark:bg-cyan-950/40">
                <CardContent className="p-4">
                  <div className="text-sm text-cyan-700 mb-2 flex items-center gap-2 dark:text-cyan-300">
                    <BarChart3 className="h-4 w-4" />
                    By Priority
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary ? (
                      Object.entries(summary.countsByPriority).map(([p, n]) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="bg-white text-cyan-800 border-cyan-200 dark:bg-card dark:text-cyan-300 dark:border-cyan-800"
                        >
                          {p}: <span className="ml-1 font-semibold">{n}</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-cyan-700/70 dark:text-cyan-300/70">—</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-6" />

            {/* Sort Tabs */}
            <Tabs
              value={sort}
              onValueChange={(v) => setSort(v as any)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 w-full rounded-xl">
                <TabsTrigger value="dueAsc">Due Date ↑</TabsTrigger>
                <TabsTrigger value="dueDesc">Due Date ↓</TabsTrigger>
                <TabsTrigger value="createdDesc">Newest First</TabsTrigger>
              </TabsList>

              <TabsContent value={sort} className="mt-6">
                {loadingHeaders ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
                    <span className="ml-4 text-lg text-slate-600 dark:text-muted-foreground">
                      Loading cycle headers…
                    </span>
                  </div>
                ) : headersError ? (
                  <div className="text-center py-16">
                    <div className="text-red-600 mb-4 dark:text-red-400">Error loading cycles</div>
                    <Button onClick={refreshTasks}>Retry</Button>
                  </div>
                ) : cycleHeaders.length === 0 ? (
                  <div className="text-center py-16">
                    <LayoutList className="h-16 w-16 mx-auto mb-6 text-slate-400 dark:text-muted-foreground" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2 dark:text-foreground">
                      No tasks found
                    </h3>
                    <p className="text-slate-600 dark:text-muted-foreground">
                      Try adjusting your filters or search.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Quick cycle nav */}
                    <div
                      ref={cyclesNavRef}
                      className="flex flex-wrap gap-2 mb-6"
                    >
                      {cycleHeaders.map((cycle: any, idx: number) => {
                        const { cycleKey: key, label, count } = cycle;
                        const active = expandedCycles[key];
                        return (
                          <Button
                            key={key}
                            variant={active ? "default" : "outline"}
                            onClick={() => {
                              toggleCycle(key);
                              const el = document.getElementById(
                                `cycle-${key}`
                              );
                              if (el)
                                el.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                            className={cn(
                              "h-9 rounded-full",
                              active
                                ? "bg-linear-to-r from-indigo-500 to-purple-500 text-white"
                                : ""
                            )}
                          >
                            <Hash className="h-4 w-4 mr-1" />
                            {label} ({count})
                          </Button>
                        );
                      })}
                    </div>

                    {/* Cycle sections */}
                    <div className="space-y-10">
                      {cycleHeaders.map((cycle: any, idx: number) => {
                        const { cycleKey: key, label, count } = cycle;
                        const open = !!expandedCycles[key];
                        const items = cycleTasks[key] || [];

                        // mini-stats for the cycle header (from loaded items or fallback)
                        const byStatus = items.length > 0 
                          ? items.reduce<Record<string, number>>((acc, t) => {
                              acc[t.status] = (acc[t.status] ?? 0) + 1;
                              return acc;
                            }, {})
                          : {};

                        return (
                          <section
                            key={key}
                            id={`cycle-${key}`}
                            className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl dark:border-border"
                          >
                            {/* Lighter Section Header */}
                            <div
                              className={cn(
                                "px-6 py-5 text-slate-800 bg-linear-to-r dark:text-foreground",
                                cycleGrad(Math.max(1, idx + 1))
                              )}
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-white/70 border border-slate-200 flex items-center justify-center dark:bg-card/70 dark:border-border">
                                    <Bookmark className="h-5 w-5 text-slate-700 dark:text-foreground" />
                                  </div>
                                  <div>
                                    <div className="text-xl font-bold leading-5">
                                      {label}
                                    </div>
                                    <div className="text-slate-600 text-sm dark:text-muted-foreground">
                                      {count} task{count !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {Object.entries(byStatus).map(([s, n]) => (
                                    <Badge
                                      key={s}
                                      variant="outline"
                                      className="border border-slate-300 bg-white/70 text-slate-700 capitalize dark:border-border dark:bg-card/70 dark:text-foreground"
                                    >
                                      {s.replaceAll("_", " ")}:{" "}
                                      <span className="ml-1 font-semibold">
                                        {n}
                                      </span>
                                    </Badge>
                                  ))}
                                  <Button
                                    variant="outline"
                                    className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-card dark:text-foreground dark:border-border dark:hover:bg-muted/40"
                                    onClick={() => toggleCycle(key)}
                                  >
                                    {open ? "Collapse" : "Expand"}
                                    <ChevronRight
                                      className={cn(
                                        "h-4 w-4 ml-1 transition-transform",
                                        open && "rotate-90"
                                      )}
                                    />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Section Body */}
                            {open && (
                              <div className="p-6 bg-white dark:bg-card">
                                {loadingCycle === key ? (
                                  <div className="flex items-center justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mr-3" />
                                    <span className="text-slate-600 dark:text-muted-foreground">Loading tasks...</span>
                                  </div>
                                ) : items.length === 0 ? (
                                  <div className="text-center py-10 text-slate-500 dark:text-muted-foreground">
                                    No tasks found for this cycle
                                  </div>
                                ) : (
                                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {items.map((task) => {
                                      const assignee = task.assignedTo;
                                      const showPwd = !!showPasswordIds[task.id];

                                      return (
                                        <Card
                                          key={task.id}
                                          className="group border-2 hover:border-indigo-300 rounded-2xl transition-all bg-white/90 dark:hover:border-indigo-700 dark:bg-card/90"
                                        >
                                          <CardContent className="p-5">
                                            {/* Title & Badges */}
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "border",
                                                      categoryColor(
                                                        task.category?.name
                                                      )
                                                    )}
                                                  >
                                                    <Bookmark className="h-3 w-3 mr-1" />
                                                    {task.category?.name ??
                                                      "Uncategorized"}
                                                  </Badge>
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "border capitalize",
                                                      statusColor(task.status)
                                                    )}
                                                  >
                                                    {task.status.replaceAll(
                                                      "_",
                                                      " "
                                                    )}
                                                  </Badge>
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "border",
                                                      priorityColor(task.priority)
                                                    )}
                                                  >
                                                    {task.priority}
                                                  </Badge>
                                                </div>
                                                <div
                                                  className="font-semibold text-slate-900 text-base truncate dark:text-foreground"
                                                  title={task.name}
                                                >
                                                  {task.name}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Meta */}
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                                              <div className="flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4" />
                                                <span title={task.dueDate ?? ""}>
                                                  Due: {formatDate(task.dueDate)}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                <span>
                                                  Created:{" "}
                                                  {formatDate(task.createdAt)}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Timer className="h-4 w-4" />
                                                <span>
                                                  Duration:{" "}
                                                  {task.idealDurationMinutes ??
                                                    "—"}{" "}
                                                  min
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                {assignee ? (
                                                  <span
                                                    className="truncate"
                                                    title={assignee.email ?? ""}
                                                  >
                                                    {assignee.name ??
                                                      assignee.email ??
                                                      "—"}
                                                  </span>
                                                ) : (
                                                  <span>Unassigned</span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Credentials (URL / Username / Email / Password) */}
                                            <div className="mt-4 space-y-2 text-sm">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-slate-500 dark:text-muted-foreground">
                                                  URL
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  {task.completionLink ? (
                                                    <>
                                                      <a
                                                        href={task.completionLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
                                                      >
                                                        <Link2 className="h-4 w-4 mr-1" />
                                                        Open
                                                      </a>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                          copyToClipboard(
                                                            task.completionLink,
                                                            "URL copied"
                                                          )
                                                        }
                                                        title="Copy URL"
                                                      >
                                                        <ClipboardCopy className="h-4 w-4" />
                                                      </Button>
                                                    </>
                                                  ) : (
                                                    <span className="text-slate-400 dark:text-muted-foreground">
                                                      —
                                                    </span>
                                                  )}
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-slate-500 dark:text-muted-foreground">
                                                  Username
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  <span
                                                    className="truncate max-w-[170px]"
                                                    title={task.username ?? ""}
                                                  >
                                                    {task.username ?? "—"}
                                                  </span>
                                                  {task.username && (
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8"
                                                      onClick={() =>
                                                        copyToClipboard(
                                                          task.username!,
                                                          "Username copied"
                                                        )
                                                      }
                                                      title="Copy username"
                                                    >
                                                      <ClipboardCopy className="h-4 w-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-slate-500 dark:text-muted-foreground">
                                                  Email
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  <span
                                                    className="truncate max-w-[170px]"
                                                    title={task.email ?? ""}
                                                  >
                                                    {task.email ?? "—"}
                                                  </span>
                                                  {task.email && (
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8"
                                                      onClick={() =>
                                                        copyToClipboard(
                                                          task.email!,
                                                          "Email copied"
                                                        )
                                                      }
                                                      title="Copy email"
                                                    >
                                                      <ClipboardCopy className="h-4 w-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-slate-500 dark:text-muted-foreground">
                                                  Password
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  {task.password ? (
                                                    <>
                                                      <span className="font-mono">
                                                        {showPwd
                                                          ? task.password
                                                          : "•".repeat(
                                                              Math.min(
                                                                12,
                                                                Math.max(
                                                                  6,
                                                                  task.password
                                                                    .length
                                                                )
                                                              )
                                                            )}
                                                      </span>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                          setShowPasswordIds(
                                                            (s) => ({
                                                              ...s,
                                                              [task.id]:
                                                                !s[task.id],
                                                            })
                                                          )
                                                        }
                                                        title={
                                                          showPwd
                                                            ? "Hide password"
                                                            : "Reveal password"
                                                        }
                                                      >
                                                        {showPwd ? (
                                                          <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                          <Eye className="h-4 w-4" />
                                                        )}
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                          copyToClipboard(
                                                            task.password!,
                                                            "Password copied"
                                                          )
                                                        }
                                                        title="Copy password"
                                                      >
                                                        <ClipboardCopy className="h-4 w-4" />
                                                      </Button>
                                                    </>
                                                  ) : (
                                                    <span className="text-slate-400 dark:text-muted-foreground">
                                                      —
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Notes */}
                                            {task.notes ? (
                                              <div className="mt-4 text-sm text-slate-700 dark:text-foreground">
                                                <div className="text-slate-500 mb-1 dark:text-muted-foreground">
                                                  Notes
                                                </div>
                                                <div className="line-clamp-3">
                                                  {task.notes}
                                                </div>
                                              </div>
                                            ) : null}
                                          </CardContent>
                                        </Card>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modal for creating manual tasks */}
      {clientId && (
        <CreateNewTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onSuccess={() => {
            refreshTasks(); // Refresh the tasks list
          }}
          clientId={clientId}
        />
      )}
    </div>
  );
}
// @ts-nocheck
