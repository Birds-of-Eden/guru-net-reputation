// app/[role]/distribution/client-agent/page.tsx

"use client";

import {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
  useTransition,
  useCallback,
} from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import {
  Users,
  Building2,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
  Package,
  TrendingUp,
  Globe,
  Share2,
  Layers,
  ListChecks,
  FileText,
  Bookmark,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitialsFromName, nameToColor } from "@/utils/avatar";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/** ---------- Types (match /api/tasks/clients) ---------- */
type TaskStats = {
  categories: Record<string, { total: number; completed: number }>;
  assetTypes: Record<string, { total: number; completed: number }>;
  isReadyForTaskCreation: boolean;
  totalTasks: number;
  completedTasks: number;

  posting?: {
    categories: Record<string, { total: number; completed: number }>;
    totalPostingTasks: number;
    completedPostingTasks: number;
    isAllPostingCompleted: boolean;
  };
};

type Client = {
  id: string;
  name?: string | null;
  company?: string | null;
  status?: string | null;
  package?: { name?: string } | null;
  avatar?: string | null;
  socialMedias?: any[];
  taskStats?: TaskStats;

  postingTasksCreated?: boolean;
  existingPostingTasksCount?: number;
};

// OPTIMIZATION (virtual batching): hard-cap initial DOM work to small slices to keep Time To Interactive low.
const CLIENT_BATCH_SIZE = 12;

export default function ClientUnifiedDashboard() {
  const router = useRouter();
  const roleSegment = useRoleSegment();
  const distributionBasePath = `/${roleSegment}/distribution/client-agent`;
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  // OPTIMIZATION (React useTransition): keep UI responsive while large client lists re-filter.
  const [isFilteringPending, startFilteringTransition] = useTransition();
  // OPTIMIZATION (virtual batching state): track how many slices of the grid are rendered.
  const [visibleBatch, setVisibleBatch] = useState(1);

  const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load clients");
    return res.json();
  };

  const { data, isLoading, error } = useSWR(
    "/api/tasks/clients",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  );

  const clients: Client[] = useMemo(() => {
    return Array.isArray((data as any)?.clients) ? ((data as any).clients as Client[]) : [];
  }, [data]);

  useEffect(() => {
    if (error) {
      const msg = error instanceof Error ? error.message : "Failed to load clients";
      toast.error(msg);
    }
  }, [error]);

  // Unique package names for the filter dropdown
  const packageOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of clients) {
      const n = c.package?.name?.trim();
      if (n) s.add(n);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  const normalizedSearch = search.trim().toLowerCase();
  // OPTIMIZATION (React useDeferredValue): let React defer filter-heavy work while the user types quickly.
  const deferredSearch = useDeferredValue(normalizedSearch);
  const hasActiveFilters =
    normalizedSearch.length > 0 || packageFilter !== "all";
  const isClearDisabled = !hasActiveFilters;

  // OPTIMIZATION (memoized filtering): ensure expensive filtering only reruns when clients/search/filter actually change.
  const filteredClients = useMemo(() => {
    if (!clients?.length) return [];
    return clients.filter((c) => {
      if (packageFilter !== "all") {
        const p = c.package?.name?.trim() ?? "";
        if (p !== packageFilter) return false;
      }

      if (!deferredSearch) return true;
      const target = deferredSearch;
      return (
        (c.name ?? "").toLowerCase().includes(target) ||
        (c.company ?? "").toLowerCase().includes(target) ||
        c.id.toLowerCase().includes(target)
      );
    });
  }, [clients, packageFilter, deferredSearch]);

  const visibleClients = useMemo(() => {
    return filteredClients.slice(0, visibleBatch * CLIENT_BATCH_SIZE);
  }, [filteredClients, visibleBatch]);
  const remainingClients = Math.max(
    filteredClients.length - visibleClients.length,
    0
  );
  const hasMoreClients = remainingClients > 0;
  const nextBatchCount = Math.min(remainingClients, CLIENT_BATCH_SIZE);

  useEffect(() => {
    setVisibleBatch(1);
  }, [deferredSearch, packageFilter, clients.length]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setVisibleBatch(1);
  }, []);

  const handlePackageChange = useCallback(
    (value: string) => {
      startFilteringTransition(() => {
        setPackageFilter(value);
        setVisibleBatch(1);
      });
    },
    [startFilteringTransition]
  );

  const handleClearFilters = useCallback(() => {
    if (!hasActiveFilters) return;
    setSearch("");
    startFilteringTransition(() => {
      setPackageFilter("all");
      setVisibleBatch(1);
    });
  }, [hasActiveFilters, startFilteringTransition]);

  const handleLoadMoreClients = useCallback(() => {
    setVisibleBatch((prev) => prev + 1);
  }, []);

  /** ---------- Routes ---------- */
  const openDistribution = (clientId: string) => {
    router.push(`${distributionBasePath}/${clientId}`);
  };

  const conditionalRouteAndLabel = (client: Client) => {
    const ready = client.taskStats?.isReadyForTaskCreation === true;
    const already =
      client.postingTasksCreated === true ||
      (client.existingPostingTasksCount ?? 0) > 0 ||
      (client.taskStats?.posting?.totalPostingTasks ?? 0) > 0;

    if (already) {
      return {
        label: "Show Tasks",
        icon: <Layers className="h-4 w-4" />,
        go: () =>
          router.push(`${distributionBasePath}/tasks?clientId=${client.id}`),
        klass:
          "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white",
      };
    }
    if (ready) {
      return {
        label: "Create Tasks",
        icon: <Target className="h-4 w-4" />,
        go: () =>
          router.push(`${distributionBasePath}/client/${client.id}`),
        klass:
          "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white",
      };
    }
    // not ready → view details (same as second component)
    return {
      label: "View Details",
      icon: <Building2 className="h-4 w-4" />,
      go: () => router.push(`${distributionBasePath}/client/${client.id}`),
      klass:
        "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white",
    };
  };

  /** ---------- UI helpers ---------- */
  const getStatusBadge = (client: Client) => {
    const t = client.taskStats;
    const already =
      client.postingTasksCreated === true ||
      (client.existingPostingTasksCount ?? 0) > 0 ||
      (client.taskStats?.posting?.totalPostingTasks ?? 0) > 0;

    if (!t || t.totalTasks === 0) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-600 border-slate-300"
        >
          <Clock className="h-3 w-3 mr-1" />
          No Tasks
        </Badge>
      );
    }

    if (already) {
      return (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border-indigo-300 font-semibold"
          title={`Posting tasks created: ${
            client.existingPostingTasksCount ?? 0
          }`}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Already Task is created
        </Badge>
      );
    }

    if (t.isReadyForTaskCreation) {
      return (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 font-semibold"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Ready for Task Creation
        </Badge>
      );
    }

    return null;
  };

  const getAssetTypeIcon = (assetType: string) => {
    switch (assetType) {
      case "social_site":
        return <Share2 className="h-3 w-3" />;
      case "web2_site":
        return <Globe className="h-3 w-3" />;
      case "other_asset":
        return <Layers className="h-3 w-3" />;
      default:
        return <Package className="h-3 w-3" />;
    }
  };

  const fmtAssetType = (assetType: string) => {
    switch (assetType) {
      case "social_site":
        return "Social Site";
      case "web2_site":
        return "Web2 Site";
      case "other_asset":
        return "Other Asset";
      default:
        return assetType
          .replace("_", " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const getPostingCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Social Activity":
        return <Share2 className="h-3 w-3" />;
      case "Blog Posting":
        return <FileText className="h-3 w-3" />;
      default:
        return <Bookmark className="h-3 w-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div>
        <Card className="shadow-2xl border-0 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 overflow-hidden backdrop-blur-sm">
          <CardHeader className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 text-white px-8 py-4">
            <div className="absolute inset-0 bg-[radial-gradient(1200px_400px_at_0%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  Client to Agent Task Flow
                </CardTitle>
              </div>
              <div className="hidden lg:flex items-center">
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 shadow-lg flex items-center justify-center">
                  <TrendingUp className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {/* Search + Package Filter */}
            <div className="mb-8 grid grid-cols-12 gap-3 items-center">
              {/* Search (7 cols) */}
              <div className="relative col-span-12 md:col-span-7">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search clients by name, company, or ID..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-12 h-12 rounded-xl border-slate-300 bg-white shadow-sm text-base w-full"
                />
              </div>

              {/* Package filter (3 cols) */}
              <div className="relative col-span-12 md:col-span-3">
                {/* Floating label */}
                <span className="absolute -top-2 left-3 px-2 text-[11px] font-semibold tracking-wide text-indigo-600 bg-white rounded-full shadow-sm ring-1 ring-indigo-100">
                  Package
                </span>
                {/* Icon */}
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 pointer-events-none" />

                <Select value={packageFilter} onValueChange={handlePackageChange}>
                  <SelectTrigger
                    className="h-12 pl-10 rounded-xl bg-white/90 shadow-sm border-0 ring-1 ring-slate-300 hover:ring-indigo-300 focus:ring-2 focus:ring-indigo-400 transition w-full"
                    aria-busy={isFilteringPending}
                  >
                    <SelectValue placeholder="Filter by package" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                    <SelectItem value="all">All Packages</SelectItem>
                    {packageOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear button (2 cols, beside filter) */}
              <div className="col-span-12 md:col-span-2">
                <Button
                  onClick={handleClearFilters}
                  disabled={isClearDisabled}
                  className={cn(
                    "h-10 w-full rounded-xl font-semibold transition shadow-md",
                    isClearDisabled
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-500 text-white hover:opacity-90 hover:shadow-lg"
                  )}
                  title="Clear search and package filter"
                >
                  Clear Filter
                </Button>
              </div>
            </div>

            {/* Client Grid */}
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card
                    key={`skeleton-${index}`}
                    className="border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50/50 rounded-2xl overflow-hidden"
                  >
                    <CardContent className="p-6">
                      {/* Identity Skeleton */}
                      <div className="flex items-start gap-4 mb-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>

                      {/* Status & Package Skeleton */}
                      <div className="space-y-3 mb-4">
                        <Skeleton className="h-6 w-48 rounded-full" />
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-6 w-28 rounded-full" />
                        </div>
                      </div>

                      {/* Progress Bars Skeleton */}
                      <div className="mb-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="h-3 w-24 ml-auto" />
                      </div>

                      {/* Buttons Skeleton */}
                      <div className="mt-6 flex flex-col sm:flex-row gap-2">
                        <Skeleton className="h-11 flex-1 rounded-xl" />
                        <Skeleton className="h-11 flex-1 rounded-xl" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-16 w-16 mx-auto mb-6 text-slate-400" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  No clients found
                </h3>
                <p className="text-slate-600">
                  {search || packageFilter !== "all"
                    ? "Try adjusting your search or package filter"
                    : "No clients available at the moment"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {visibleClients.map((client) => {
                  const t = client.taskStats;
                  const postingCreated = client.postingTasksCreated;
                  const conditional = conditionalRouteAndLabel(client);

                  return (
                    <Card
                      key={client.id}
                      className="group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 border-slate-200 hover:border-indigo-300 bg-gradient-to-br from-white to-slate-50/50 rounded-2xl overflow-hidden"
                    >
                      <CardContent className="p-6">
                        {/* Identity */}
                        <div className="flex items-start gap-4 mb-4">
                          <Avatar className="h-16 w-16 ring-4 ring-slate-200 group-hover:ring-indigo-300 transition-all duration-300 shadow-lg">
                            {client.avatar ? (
                              <AvatarImage
                                src={client.avatar || "/placeholder.svg"}
                                alt={client.name || "Client"}
                              />
                            ) : null}
                            <AvatarFallback
                              className="text-white font-bold text-lg"
                              style={{
                                backgroundColor: nameToColor(
                                  client.name || client.id
                                ),
                              }}
                            >
                              {getInitialsFromName(client.name || client.id)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <h3
                              className="font-bold text-lg text-slate-900 truncate mb-1"
                              title={client.name || "Unnamed Client"}
                            >
                              {client.name || "Unnamed Client"}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                              <Building2 className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {client.company || "No company"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono truncate">
                              ID: {client.id}
                            </div>
                          </div>
                        </div>

                        {/* Status & Package */}
                        <div className="space-y-3 mb-4">
                          {getStatusBadge(client)}

                          <div className="flex flex-wrap gap-2">
                            {client.status && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-medium",
                                  client.status === "active"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : client.status === "qc_approved"
                                    ? "bg-teal-50 text-teal-700 border-teal-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                )}
                                title={
                                  client.status === "qc_approved"
                                    ? "QC Approved"
                                    : "Client status"
                                }
                              >
                                {client.status === "qc_approved" ? (
                                  <span className="flex items-center gap-1">
                                    <span className="font-bold">10/10</span>
                                    <span>(1-10)</span>
                                  </span>
                                ) : (
                                  client.status
                                )}
                              </Badge>
                            )}

                            {client.package?.name && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
                                title="Client package"
                              >
                                <Package className="h-3 w-3 mr-1" />
                                {client.package.name}
                              </Badge>
                            )}

                            {typeof client.existingPostingTasksCount ===
                              "number" && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  postingCreated
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                )}
                                title="Posting tasks created count"
                              >
                                <ListChecks className="h-3 w-3 mr-1" />
                                {client.existingPostingTasksCount} Posting Task
                                {client.existingPostingTasksCount === 1
                                  ? ""
                                  : "s"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Required Assets */}
                        {t && (
                          <div className="mb-4 space-y-3">
                            <div>
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-slate-600 font-medium">
                                  Required Assets
                                </span>
                                <span className="text-slate-900 font-semibold">
                                  {t.completedTasks}/{t.totalTasks}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {[
                                  "social_site",
                                  "web2_site",
                                  "other_asset",
                                ].map((assetType) => {
                                  const stats = t.assetTypes[assetType];
                                  const has = !!stats && stats.total > 0;
                                  const complete =
                                    has && stats.completed === stats.total;

                                  return (
                                    <Badge
                                      key={assetType}
                                      variant="outline"
                                      className={cn(
                                        "text-xs font-medium",
                                        !has
                                          ? "bg-slate-50 text-slate-400 border-slate-200"
                                          : complete
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-amber-50 text-amber-700 border-amber-200"
                                      )}
                                    >
                                      {getAssetTypeIcon(assetType)}
                                      <span className="ml-1">
                                        {fmtAssetType(assetType)}
                                      </span>
                                      {has && (
                                        <span className="ml-1">
                                          ({stats!.completed}/{stats!.total})
                                        </span>
                                      )}
                                    </Badge>
                                  );
                                })}
                              </div>

                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                  className={cn(
                                    "h-2 rounded-full transition-all duration-300",
                                    t.isReadyForTaskCreation
                                      ? "bg-gradient-to-r from-emerald-500 to-green-500"
                                      : "bg-gradient-to-r from-amber-500 to-orange-500"
                                  )}
                                  style={{
                                    width: `${
                                      t.totalTasks > 0
                                        ? (t.completedTasks / t.totalTasks) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              <div className="text-xs text-slate-500 mt-1 text-right">
                                {t.totalTasks > 0
                                  ? Math.round(
                                      (t.completedTasks / t.totalTasks) * 100
                                    )
                                  : 0}
                                % Complete
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Posting Tasks */}
                        {t?.posting && (
                          <div className="mt-5 space-y-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-slate-600 font-medium">
                                Posting Tasks
                              </span>
                              <span className="text-slate-900 font-semibold">
                                {t.posting.completedPostingTasks}/
                                {t.posting.totalPostingTasks}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1 mb-2">
                              {["Social Activity", "Blog Posting"].map(
                                (cat) => {
                                  const stats = t.posting!.categories[cat];
                                  const has = !!stats && stats.total > 0;
                                  const complete =
                                    has && stats.completed === stats.total;
                                  return (
                                    <Badge
                                      key={cat}
                                      variant="outline"
                                      className={cn(
                                        "text-xs font-medium",
                                        !has
                                          ? "bg-slate-50 text-slate-400 border-slate-200"
                                          : complete
                                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                          : "bg-blue-50 text-blue-700 border-blue-200"
                                      )}
                                    >
                                      {getPostingCategoryIcon(cat)}
                                      <span className="ml-1">{cat}</span>
                                      {has && (
                                        <span className="ml-1">
                                          ({stats!.completed}/{stats!.total})
                                        </span>
                                      )}
                                    </Badge>
                                  );
                                }
                              )}
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all duration-300",
                                  t.posting.isAllPostingCompleted
                                    ? "bg-gradient-to-r from-indigo-500 to-blue-500"
                                    : "bg-gradient-to-r from-blue-500 to-sky-500"
                                )}
                                style={{
                                  width: `${
                                    t.posting.totalPostingTasks > 0
                                      ? (t.posting.completedPostingTasks /
                                          t.posting.totalPostingTasks) *
                                        100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <div className="text-xs text-slate-500 mt-1 text-right">
                              {t.posting.totalPostingTasks > 0
                                ? Math.round(
                                    (t.posting.completedPostingTasks /
                                      t.posting.totalPostingTasks) *
                                      100
                                  )
                                : 0}
                              % Complete
                            </div>
                          </div>
                        )}

                        {/* Buttons: 1) Open Distribution, 2) Conditional */}
                        <div className="mt-6 flex flex-col sm:flex-row gap-2">
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDistribution(client.id);
                            }}
                            className="h-11 flex-1 rounded-xl border-slate-300 hover:border-indigo-300 hover:text-indigo-700"
                            title="Open classic distribution"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Open Distribution
                          </Button>

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              conditional.go();
                            }}
                            className={cn(
                              "h-11 flex-1 rounded-xl font-semibold transition-all duration-300 group-hover:shadow-lg",
                              conditional.klass
                            )}
                            title="Proceed (condition wise)"
                          >
                            <div className="flex items-center gap-2">
                              {conditional.icon}
                              {conditional.label}
                              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                  })}
                </div>
                {hasMoreClients && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-indigo-200/70 bg-white/80 p-4 text-center">
                    <p className="text-sm text-slate-600">
                      Showing {visibleClients.length} of {filteredClients.length} clients
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleLoadMoreClients}
                      className="rounded-full px-6 shadow-sm"
                      aria-busy={isFilteringPending}
                    >
                      {/* OPTIMIZATION (virtual batching control): avoid rendering hundreds of cards at once, let users opt-in for more */}
                      Load {nextBatchCount} more client
                      {nextBatchCount !== 1 ? "s" : ""}{" "}
                      {remainingClients > 0 && `(${remainingClients} left)`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
