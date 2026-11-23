// app/[role]/distribution/client-agent/client/[clientId]/page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Repeat,
  Users,
  Building2,
  CheckCircle2,
  ListChecks,
  CalendarDays,
  Timer,
  Tag,
  Link2,
  User2,
  LayoutList,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Clock,
  Target,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { getInitialsFromName, nameToColor } from "@/utils/avatar";
import { cn } from "@/lib/utils";

export type CreatedTask = {
  id: string;
  name: string;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
  dueDate?: string | null;
  idealDurationMinutes?: number | null;
  completionLink?: string | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    image?: string | null;
    role?: { name?: string | null } | null;
  } | null;
  category?: { id: string; name?: string | null } | null;
  templateSiteAsset?: {
    id: number;
    name?: string | null;
    type?: string | null;
  } | null;
  assignment?: { id: string } | null;
};

type Template = { id: string; name: string };

type Client = {
  id: string;
  name?: string;
  company?: string;
  status?: string;
  package?: { name?: string } | null;
  avatar?: string | null;
};

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "overdue"
  | "cancelled"
  | "reassigned"
  | "qc_approved";

type SourcePreview = {
  id: string;
  name: string;
  baseName: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  assetType?: "social_site" | "web2_site" | "other_asset";
  frequency: number;
  categoryName: string; // Social Activity | Blog Posting
};

type CountsByStatus = Record<TaskStatus, number>;

const toTitle = (s?: string | null) =>
  (s ?? "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (m) => m.toUpperCase());

const statusTone: Record<string, string> = {
  pending:
    "bg-linear-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-300 shadow-sm dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300 dark:border-amber-700",
  in_progress:
    "bg-linear-to-r from-blue-50 to-cyan-50 text-blue-800 border-blue-300 shadow-sm dark:from-blue-950/40 dark:to-cyan-950/40 dark:text-blue-300 dark:border-blue-700",
  completed:
    "bg-linear-to-r from-emerald-50 to-green-50 text-emerald-800 border-emerald-300 shadow-sm dark:from-emerald-950/40 dark:to-green-950/40 dark:text-emerald-300 dark:border-emerald-700",
  overdue:
    "bg-linear-to-r from-rose-50 to-red-50 text-rose-800 border-rose-300 shadow-sm dark:from-rose-950/40 dark:to-red-950/40 dark:text-rose-300 dark:border-rose-700",
  cancelled:
    "bg-linear-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-300 shadow-sm dark:from-background dark:to-background dark:text-foreground dark:border-border",
  reassigned:
    "bg-linear-to-r from-purple-50 to-violet-50 text-purple-800 border-purple-300 shadow-sm dark:from-purple-950/40 dark:to-violet-950/40 dark:text-purple-300 dark:border-purple-700",
  qc_approved:
    "bg-linear-to-r from-teal-50 to-emerald-50 text-teal-800 border-teal-300 shadow-sm dark:from-teal-950/40 dark:to-emerald-950/40 dark:text-teal-300 dark:border-teal-700",
};

const priorityTone: Record<string, string> = {
  low: "bg-linear-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-300 dark:from-background dark:to-background dark:text-foreground dark:border-border",
  medium:
    "bg-linear-to-r from-indigo-50 to-blue-50 text-indigo-700 border-indigo-300 dark:from-indigo-950/40 dark:to-blue-950/40 dark:text-indigo-300 dark:border-indigo-700",
  high: "bg-linear-to-r from-orange-50 to-amber-50 text-orange-700 border-orange-300 dark:from-orange-950/40 dark:to-amber-950/40 dark:text-orange-300 dark:border-orange-700",
  urgent: "bg-linear-to-r from-red-50 to-rose-50 text-red-700 border-red-300 dark:from-red-950/40 dark:to-rose-950/40 dark:text-red-300 dark:border-red-700",
};

const typeLabel: Record<string, string> = {
  social_site: "Social Media",
  web2_site: "Web 2.0 Site",
  other_asset: "Other Asset",
};

const typeColors: Record<string, string> = {
  social_site:
    "bg-linear-to-r from-pink-100 to-rose-100 text-pink-800 border-pink-300 dark:from-pink-900/40 dark:to-rose-900/40 dark:text-pink-300 dark:border-pink-700",
  web2_site:
    "bg-linear-to-r from-cyan-100 to-blue-100 text-cyan-800 border-cyan-300 dark:from-cyan-900/40 dark:to-blue-900/40 dark:text-cyan-300 dark:border-cyan-700",
  other_asset:
    "bg-linear-to-r from-violet-100 to-purple-100 text-violet-800 border-violet-300 dark:from-violet-900/40 dark:to-purple-900/40 dark:text-violet-300 dark:border-violet-700",
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50/50 rounded-lg px-3 py-2 dark:text-muted-foreground dark:bg-muted/40">
      <Icon className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
      <span className="font-medium text-slate-700 dark:text-foreground">{label}:</span>
      <span className="truncate font-medium text-slate-900 dark:text-foreground" title={value}>
        {value}
      </span>
    </div>
  );
}

function TaskListCard({ task }: { task: CreatedTask }) {
  const createdAt = task.createdAt ? new Date(task.createdAt) : null;
  const dueAt = task.dueDate ? new Date(task.dueDate) : null;

  const sKey = (task.status ?? "").toLowerCase();
  const pKey = (task.priority ?? "").toLowerCase();

  const formatDueDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
      return `${date.toLocaleDateString()} (${Math.abs(
        diffDays,
      )} days overdue)`;
    } else if (diffDays === 0) {
      return `${date.toLocaleDateString()} (Due today)`;
    } else if (diffDays <= 7) {
      return `${date.toLocaleDateString()} (${diffDays} days left)`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getDueDateStyle = (date: Date) => {
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
      return "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800";
    } else if (diffDays <= 3) {
      return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800";
    } else {
      return "text-slate-600 bg-slate-50 border-slate-200 dark:text-muted-foreground dark:bg-muted/40 dark:border-border";
    }
  };

  return (
    <Card className="border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 bg-linear-to-br from-white to-slate-50/50 dark:border-border dark:from-card dark:to-background/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="hidden sm:block">
            <Avatar className="h-12 w-12 ring-2 ring-slate-200 shadow-md dark:ring-border">
              {task.assignedTo?.image ? (
                <AvatarImage
                  src={task.assignedTo.image || "/placeholder.svg"}
                  alt={task.assignedTo?.name ?? "Agent"}
                />
              ) : (
                <AvatarFallback
                  className="text-sm font-bold"
                  style={{
                    backgroundColor: nameToColor(
                      task.assignedTo?.name ?? task.name ?? "?",
                    ),
                  }}
                >
                  {getInitialsFromName(
                    task.assignedTo?.name ?? task.name ?? "?",
                  )}
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h4
                className="text-sm sm:text-base font-bold text-slate-900 truncate dark:text-foreground"
                title={task.name}
              >
                {task.name}
              </h4>
              {task.templateSiteAsset?.type && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-7 rounded-full border font-medium",
                    typeColors[task.templateSiteAsset.type] ??
                      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {typeLabel[task.templateSiteAsset.type] ??
                    toTitle(task.templateSiteAsset.type)}
                </Badge>
              )}
              {task.category?.name && (
                <Badge
                  variant="outline"
                  className="h-7 rounded-full border bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-700 border-indigo-200 font-medium dark:from-indigo-950/40 dark:to-purple-950/40 dark:text-indigo-300 dark:border-indigo-800"
                >
                  <Tag className="h-3.5 w-3.5 mr-1" /> {task.category.name}
                </Badge>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <InfoRow
                icon={CalendarDays}
                label="Created"
                value={createdAt ? createdAt.toLocaleString() : undefined}
              />
              <InfoRow
                icon={Timer}
                label="Duration"
                value={
                  task.idealDurationMinutes
                    ? `${task.idealDurationMinutes} min`
                    : undefined
                }
              />
              {dueAt && (
                <div
                  className={cn(
                    "flex items-center gap-2 text-sm rounded-lg px-3 py-2 border",
                    getDueDateStyle(dueAt),
                  )}
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="font-medium">Due Date:</span>
                  <span
                    className="truncate font-medium"
                    title={formatDueDate(dueAt)}
                  >
                    {formatDueDate(dueAt)}
                  </span>
                </div>
              )}
              <InfoRow
                icon={User2}
                label="Assignee"
                value={task.assignedTo?.name ?? undefined}
              />
              <InfoRow
                icon={Link2}
                label="Completion Link"
                value={task.completionLink ?? undefined}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {task.status && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  statusTone[sKey] ??
                    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
                )}
                title={toTitle(task.status)}
              >
                {toTitle(task.status)}
              </Badge>
            )}
            {task.priority && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  priorityTone[pKey] ??
                    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
                )}
                title={toTitle(task.priority)}
              >
                <Target className="h-3 w-3 mr-1" />
                {toTitle(task.priority)}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CreatePostingTasksPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const roleSegment = useRoleSegment();
  const distributionBasePath = `/${roleSegment}/distribution/client-agent`;

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("auto");

  // UI enums (server ignores status; keeps priority override optional)
  const [status] = useState<"PENDING" | "IN_PROGRESS" | "HOLD" | "DONE">(
    "PENDING",
  );
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [createdTasks, setCreatedTasks] = useState<CreatedTask[]>([]);
  const [search, setSearch] = useState("");
  const [openDurationModal, setOpenDurationModal] = useState(false);
  const [firstCycleDueDate, setFirstCycleDueDate] = useState<string>("");

  const [existingTasks, setExistingTasks] = useState<CreatedTask[]>([]);
  const [loadingExistingTasks, setLoadingExistingTasks] = useState(false);

  // ---------- NEW: preview state ----------
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    tasks: SourcePreview[];
    countsByStatus: CountsByStatus;
    allApproved: boolean;
    totalWillCreate: number;
  }>({
    tasks: [],
    countsByStatus: {
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
      cancelled: 0,
      reassigned: 0,
      qc_approved: 0,
    },
    allApproved: false,
    totalWillCreate: 0,
  });

  const [clientModalOpen, setClientModalOpen] = useState(false);

  const fetchExistingTasks = async () => {
    if (!clientId) return; // Use clientId instead of selectedClientId
    setLoadingExistingTasks(true);
    try {
      const res = await fetch(
        `/api/tasks?clientId=${clientId}&categories=Social Activity,Blog Posting,Social Communication`,
        {
          cache: "no-store",
        },
      );
      if (res.ok) {
        const data = await res.json();
        setExistingTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      } else {
        setExistingTasks([]);
      }
    } catch (e: any) {
      console.error("Failed to fetch existing tasks:", e);
      setExistingTasks([]);
    } finally {
      setLoadingExistingTasks(false);
    }
  };

  const fetchPreview = async () => {
    if (!clientId) return; // Use clientId instead of selectedClientId
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams({ clientId });
      // only pass templateId if not "auto"
      if (templateId && templateId !== "auto")
        params.set("templateId", templateId);
      const res = await fetch(
        `/api/tasks/create-posting-tasks?${params.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.message || "Failed to load preview");
        return;
      }
      setPreview({
        tasks: json.tasks || [],
        countsByStatus: json.countsByStatus || preview.countsByStatus,
        allApproved: !!json.allApproved,
        totalWillCreate: json.totalWillCreate ?? 0,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Fetch client + templates
  useEffect(() => {
    if (!clientId) {
      setSelectedClient(null);
      setTemplates([]);
      setTemplateId("auto");
      setCreatedCount(null);
      setCreatedTasks([]);
      setExistingTasks([]);
      setPreview({
        tasks: [],
        countsByStatus: {
          pending: 0,
          in_progress: 0,
          completed: 0,
          overdue: 0,
          cancelled: 0,
          reassigned: 0,
          qc_approved: 0,
        },
        allApproved: false,
        totalWillCreate: 0,
      });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}`, {
          cache: "no-store",
        });
        const client = (await res.json()) as Client;
        setSelectedClient(client);
      } catch {
        toast.error("Failed to load client details");
      }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/templates`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Template[];
          setTemplates(data ?? []);
        } else {
          setTemplates([]);
        }
      } catch {
        setTemplates([]);
      }
    })();

    fetchExistingTasks();
  }, [clientId]); // Depend on clientId instead of selectedClientId

  // Fetch preview when client or template changes
  useEffect(() => {
    if (clientId) fetchPreview(); // Use clientId instead of selectedClientId
  }, [clientId, templateId]);

  const filteredCreatedTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return createdTasks;
    return createdTasks.filter((t) =>
      [t.name, t.category?.name, t.templateSiteAsset?.name, t.assignedTo?.name]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [createdTasks, search]);

  const hasExistingPostingTasks = existingTasks.length > 0;
  const canCreateTasks = preview.allApproved && preview.totalWillCreate > 0;

  // ---------- Create handler with QC gate ----------
  const handleCreate = async () => {
    if (!clientId) {
      // Use clientId instead of selectedClientId
      toast.warning("Client not found.");
      return;
    }

    if (!firstCycleDueDate) {
      toast.warning("Please select Cycle 1 due date.");
      return;
    }
    // client-side gate
    if (!preview.allApproved) {
      toast.warning("Please complete & QC-approve all source tasks first.");
      return;
    }

    if (preview.totalWillCreate <= 0) {
      toast.warning("No new posting cycles to create (all existing).");
      return;
    }

    setCreating(true);
    setCreatedCount(null);
    setCreatedTasks([]);

    try {
      const body: any = {
        clientId, // Use clientId instead of selectedClientId
        // priority override optional
        priority,
        firstCycleDueDate,
      };
      if (templateId !== "auto") body.templateId = templateId;

      const res = await fetch("/api/tasks/create-posting-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        // server also gates and returns countsByStatus
        toast.error(json?.message || "Failed to create posting tasks");
        if (json?.countsByStatus) {
          const c = json.countsByStatus;
          toast.message("Current status", {
            description: `qc_approved: ${c.qc_approved}, pending: ${c.pending}, in_progress: ${c.in_progress}, completed: ${c.completed}`,
          });
        }
        return;
      }

      const tasksRaw = Array.isArray(json?.tasks) ? json.tasks : [];
      setCreatedTasks(tasksRaw);
      setCreatedCount(tasksRaw.length);

      toast.success(json?.message || `Created ${tasksRaw.length} task(s).`);
      // refresh preview (copies now exist -> frequency names may de-dup)
      fetchPreview();
      fetchExistingTasks();
    } catch (err: any) {
      toast.error("Task creation failed", {
        description: err?.message ?? "Unknown error",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-cyan-50 dark:from-indigo-950/40 dark:via-card dark:to-cyan-950/40">
      <Card className="shadow-2xl border-0 bg-linear-to-br from-white via-slate-50/50 to-indigo-50/30 overflow-hidden backdrop-blur-sm dark:from-card dark:via-background/50 dark:to-indigo-950/40">
        <CardHeader className="relative overflow-hidden bg-linear-to-r from-indigo-600 via-purple-600 to-cyan-600 text-white p-8 rounded-t-xl">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_400px_at_0%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Button
                  onClick={() => router.push(distributionBasePath)}
                  variant="outline"
                  className="flex items-center gap-2 text-gray-600 font-semibold dark:text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                Create Posting Tasks
              </CardTitle>
              <CardDescription className="text-indigo-100 text-lg">
                Generate frequency-based tasks for{" "}
                <span className="font-semibold text-white">social media</span>,{" "}
                <span className="font-semibold text-white">web 2.0 sites</span>,
                and{" "}
                <span className="font-semibold text-white">other assets</span>
              </CardDescription>
            </div>
            <div className="hidden lg:flex items-center">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 shadow-lg flex items-center justify-center dark:bg-card/10">
                <TrendingUp className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 lg:p-10 space-y-10">
          {/* Show selected client info */}
          {selectedClient && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-linear-to-r from-slate-50 to-indigo-50 rounded-2xl border border-slate-200 dark:from-background dark:to-indigo-950/40 dark:border-border">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 dark:text-foreground">
                    <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    Selected Client
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-muted-foreground">
                    Creating posting tasks for this client.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 p-6 bg-linear-to-br from-white to-slate-50 border border-slate-200 rounded-2xl shadow-lg dark:from-card dark:to-background dark:border-border">
                <Avatar className="h-20 w-20 ring-4 ring-indigo-500/20 shadow-lg">
                  {selectedClient.avatar ? (
                    <AvatarImage
                      src={selectedClient.avatar || "/placeholder.svg"}
                      alt={selectedClient.name || "Client avatar"}
                    />
                  ) : null}
                  <AvatarFallback
                    className="text-white text-2xl font-bold"
                    style={{
                      backgroundColor: nameToColor(selectedClient.name || ""),
                    }}
                  >
                    {getInitialsFromName(selectedClient.name || "")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900 truncate dark:text-foreground">
                      {selectedClient.name || "Unnamed Client"}
                    </h2>
                  </div>
                  <p className="mt-1 text-base text-slate-600 flex items-center gap-2 dark:text-muted-foreground">
                    <Building2 className="inline-block h-5 w-5 text-slate-500 dark:text-muted-foreground" />
                    {selectedClient.company || "N/A"}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {selectedClient.status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "border px-3 py-1.5 rounded-full text-sm font-medium",
                          selectedClient.status === "active"
                            ? "bg-linear-to-r from-green-50 to-emerald-50 text-green-800 border-green-300 dark:from-green-950/40 dark:to-emerald-950/40 dark:text-green-300 dark:border-green-700"
                            : "bg-linear-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-300 dark:from-background dark:to-background dark:text-foreground dark:border-border",
                        )}
                      >
                        {selectedClient.status}
                      </Badge>
                    )}
                    {selectedClient.package?.name && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-sm bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-800 px-3 py-1.5 font-medium dark:from-indigo-950/40 dark:to-purple-950/40 dark:text-indigo-300"
                      >
                        📦 {selectedClient.package.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {clientId && existingTasks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3 p-6 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center dark:bg-amber-900/40">
                    <CheckCircle2 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">
                      Existing Posting Tasks Found
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This client already has {existingTasks.length} posting
                      task{existingTasks.length === 1 ? "" : "s"}. New cycles
                      will continue from the last created number.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-800 border-amber-300 px-3 py-1.5 font-semibold dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                >
                  {existingTasks.length} Tasks
                </Badge>
              </div>

              <div className="grid gap-4">
                {existingTasks.slice(0, 5).map((task) => (
                  <TaskListCard key={task.id} task={task} />
                ))}
                {existingTasks.length > 5 && (
                  <div className="text-center text-slate-600 py-4 dark:text-muted-foreground">
                    ... and {existingTasks.length - 5} more tasks
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ---------- NEW: SOURCE PREVIEW + SUMMARY ---------- */}
          {clientId && (
            <section className="space-y-6">
              <div className="flex items-start justify-between gap-4 p-6 bg-linear-to-r from-cyan-50 to-blue-50 rounded-2xl border border-cyan-200 dark:from-cyan-950/40 dark:to-blue-950/40 dark:border-cyan-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center dark:bg-cyan-900/40">
                    <LayoutList className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-cyan-900 dark:text-cyan-300">
                      Source Tasks Overview
                    </h3>
                    <p className="text-sm text-cyan-700 dark:text-cyan-300">
                      All tasks that will be copied with frequency multipliers.{" "}
                      <b>All must be QC Approved</b> to proceed.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={fetchPreview}
                    disabled={previewLoading}
                    className="h-10 bg-white/80 backdrop-blur-sm border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:bg-card/80 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
                  >
                    {previewLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-600 border-t-transparent" />
                        Refreshing
                      </div>
                    ) : (
                      "Refresh"
                    )}
                  </Button>
                </div>
              </div>

              {/* status summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Object.entries(preview.countsByStatus).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col items-center justify-center rounded-xl border p-4 bg-linear-to-br from-white to-slate-50 shadow-sm hover:shadow-md transition-shadow dark:from-card dark:to-background"
                  >
                    <span className="text-xs font-medium capitalize text-slate-600 mb-1 dark:text-muted-foreground">
                      {k.replace("_", " ")}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-lg font-bold px-3 py-1"
                    >
                      {v}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* list of source tasks */}
              <div className="grid gap-4">
                {preview.tasks.map((t) => (
                  <Card
                    key={t.id}
                    className="border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 bg-linear-to-br from-white to-slate-50/50 dark:border-border dark:from-card dark:to-background/50"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-3">
                            <h4
                              className="text-base font-bold text-slate-900 truncate dark:text-foreground"
                              title={t.baseName}
                            >
                              {t.baseName}
                            </h4>
                            <Badge
                              variant="outline"
                              className="h-7 rounded-full bg-linear-to-r from-indigo-50 to-purple-50 border-indigo-200 text-indigo-700 font-medium dark:from-indigo-950/40 dark:to-purple-950/40 dark:border-indigo-800 dark:text-indigo-300"
                            >
                              <Tag className="h-3.5 w-3.5 mr-1" />
                              {t.categoryName}
                            </Badge>
                            {t.assetType && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-7 rounded-full border font-medium",
                                  typeColors[t.assetType] ??
                                    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
                                )}
                              >
                                <Sparkles className="h-3.5 w-3.5 mr-1" />
                                {typeLabel[t.assetType]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 dark:text-muted-foreground dark:bg-muted/40">
                            Original: {t.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge
                            variant="outline"
                            className="rounded-xl border px-3 py-2 text-sm bg-linear-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 font-bold dark:from-emerald-950/40 dark:to-green-950/40 dark:text-emerald-300 dark:border-emerald-700"
                          >
                            <Repeat className="h-4 w-4 mr-1" />
                            {t.frequency}x
                          </Badge>
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border",
                              statusTone[t.status] ??
                                "bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
                            )}
                          >
                            {t.status === "qc_approved" ? (
                              <ShieldCheck className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                            {toTitle(t.status)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {!previewLoading && preview.tasks.length === 0 && (
                  <div className="text-center text-slate-500 py-12 bg-slate-50 rounded-2xl dark:text-muted-foreground dark:bg-muted/40">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-slate-400 dark:text-muted-foreground" />
                    <p className="text-lg font-medium">No source tasks found</p>
                    <p className="text-sm">
                      Create some source tasks first to generate posting tasks.
                    </p>
                  </div>
                )}
              </div>

              {/* footer line: total to be created */}
              <div className="flex items-center justify-between p-6 bg-linear-to-r from-slate-50 to-indigo-50 rounded-2xl border border-slate-200 dark:from-background dark:to-indigo-950/40 dark:border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center dark:bg-indigo-900/40">
                    <Target className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-foreground">
                      Will create{" "}
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {preview.totalWillCreate}
                      </span>{" "}
                      posting task
                      {preview.totalWillCreate === 1 ? "" : "s"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-muted-foreground">
                      Based on frequency multipliers from source tasks
                    </p>
                  </div>
                </div>
                {!preview.allApproved ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700 bg-amber-50 px-4 py-2 font-semibold dark:border-amber-700 dark:text-amber-300 dark:bg-amber-950/40"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Complete all source tasks first
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 bg-emerald-50 px-4 py-2 font-semibold dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/40"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    All QC Approved
                  </Badge>
                )}
              </div>
            </section>
          )}

          {/* CREATION CONTROLS */}
          {clientId && (
            <section className="space-y-6">
              <div className="border rounded-2xl p-8 bg-linear-to-br from-purple-50 via-white to-indigo-50 border-purple-200/70 shadow-lg dark:from-purple-950/40 dark:via-card dark:to-indigo-950/40 dark:border-purple-800/70">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 dark:text-foreground">
                      <LayoutList className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Template Source
                    </label>
                    <Select
                      value={templateId}
                      onValueChange={(v) => setTemplateId(v)}
                    >
                      <SelectTrigger className="w-full h-12 rounded-xl border-slate-300 bg-white shadow-sm dark:border-border dark:bg-card">
                        <SelectValue placeholder="Choose template source" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border border-slate-200 bg-white dark:border-border dark:bg-card">
                        <SelectItem value="auto">
                          Use latest assignment template (recommended)
                        </SelectItem>
                        {templates.length > 0 && (
                          <div className="px-2 pt-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                            Or choose specific template
                          </div>
                        )}
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name || t.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 dark:text-foreground">
                      <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Default Task Priority
                    </label>
                    <Select
                      value={priority}
                      onValueChange={(v: any) => setPriority(v)}
                    >
                      <SelectTrigger className="w-full h-12 rounded-xl border-slate-300 bg-white shadow-sm dark:border-border dark:bg-card">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border border-slate-200 bg-white dark:border-border dark:bg-card">
                        <SelectItem value="LOW">Low Priority</SelectItem>
                        <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                        <SelectItem value="HIGH">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 dark:text-foreground">
                      <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Quick Search (Created)
                    </label>
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter created tasks..."
                      className="h-12 rounded-xl border-slate-300 bg-white shadow-sm dark:border-border dark:bg-card"
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <Button
                    onClick={() => setOpenDurationModal(true)}
                    disabled={creating || !canCreateTasks}
                    className={cn(
                      "w-full h-14 bg-linear-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-700 hover:via-purple-700 hover:to-cyan-700 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 text-lg",
                      (creating || !canCreateTasks) &&
                        "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {creating ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent dark:border-border" />
                        Creating Posting Tasks...
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <ListChecks className="h-6 w-6" />
                        Configure Time & Create Tasks
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* RESULT */}
          {clientId && createdCount !== null && (
            <section
              aria-live="polite"
              className={cn(
                "rounded-2xl p-8 shadow-lg",
                createdCount > 0
                  ? "bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-200 dark:from-emerald-950/40 dark:to-green-950/40 dark:border-emerald-800"
                  : "bg-linear-to-r from-yellow-50 to-amber-50 border border-yellow-200 dark:from-yellow-950/40 dark:to-amber-950/40 dark:border-yellow-800",
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "mt-1 h-12 w-12 rounded-xl flex items-center justify-center shadow-sm",
                    createdCount > 0 ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-yellow-100 dark:bg-yellow-900/40",
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      "h-7 w-7",
                      createdCount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-yellow-700 dark:text-yellow-300",
                    )}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <h4 className="text-xl font-bold text-slate-900 dark:text-foreground">
                      {createdCount > 0
                        ? `Successfully Created ${createdCount} Task${
                            createdCount === 1 ? "" : "s"
                          }! 🎉`
                        : "No New Tasks Created"}
                    </h4>
                    {createdCount > 0 && (
                      <div className="hidden md:flex items-center text-base text-slate-700 gap-2 bg-white/60 rounded-lg px-4 py-2 dark:text-foreground dark:bg-card/60">
                        <LayoutList className="h-5 w-5" />
                        <span className="font-semibold">
                          {createdCount} total
                        </span>
                      </div>
                    )}
                  </div>

                  {createdCount > 0 && (
                    <div className="grid gap-4">
                      {filteredCreatedTasks.map((t) => (
                        <TaskListCard key={t.id} task={t} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </CardContent>
      </Card>

      {/* Duration Settings Modal */}
      <Dialog open={openDurationModal} onOpenChange={setOpenDurationModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Posting Task Duration Settings</DialogTitle>
          </DialogHeader>

          {/* Warning / Confirmation note */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-start gap-3">
              <div className="mt-2 h-3.5 w-3.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <p className="text-xl font-semibold text-amber-900 dark:text-amber-300">
                  Are you ready to create the tasks?
                </p>
                <p className="mt-1 text-md text-amber-800 dark:text-amber-300">
                  Click <span className="font-medium">Create Tasks</span> to
                  proceed, or <span className="font-medium">Cancel</span> to go
                  back without creating anything.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-semibold text-slate-700 dark:text-foreground">
              Cycle 1 Due Date
            </label>
            <Input
              type="date"
              value={firstCycleDueDate}
              onChange={(e) => setFirstCycleDueDate(e.target.value)}
              className="mt-2 h-12 rounded-xl border-slate-300 bg-white shadow-sm dark:border-border dark:bg-card"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setOpenDurationModal(false)}
            >
              Cancel
            </Button>

            {/* Keep your onClick logic same */}
            <Button
              onClick={() => {
                setOpenDurationModal(false);
                handleCreate();
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Create Tasks
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
