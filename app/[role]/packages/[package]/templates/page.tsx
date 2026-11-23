// app/admin/packages/[package]/templates/page.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit3,
  Trash2,
  FileText,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  X,
  RotateCcw,
  Users,
  Eye,
  Sparkles,
  TrendingUp,
  Star,
  Activity,
  Target,
  Copy,
} from "lucide-react";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { hasPermissionClient } from "@/lib/permissions-client";
import { CreateTemplateModal } from "@/components/package/create-template-modal";
import { cn } from "@/lib/utils";
import { TemplateViewModal } from "@/components/package/Template-View-Modal";
import { AssignTemplateModal } from "@/components/package/assign-template-modal";
import { toast } from "sonner";
import DangerDeleteTemplateModal from "@/components/package/DangerDeleteTemplateModal";
import type { AssetTypeOption } from "@/types/asset-types";
import { formatAssetTypeLabel, normalizeAssetTypeSlug } from "@/lib/asset-types";
import { getTemplateStatusLabel, normalizeTemplateStatus } from "@/lib/template-status";

interface TemplateSiteAsset {
  id: number;
  type:
    | "social_site"
    | "web2_site"
    | "other_asset"
    | "graphics_design"
    | "image_optimization"
    | "content_studio"
    | "content_writing"
    | "backlinks"
    | "completed_com"
    | "youtube_video_optimization"
    | "monitoring"
    | "review_removal"
    | "summary_report"
    | "guest_posting";
  name: string;
  url?: string;
  description?: string;
  isRequired: boolean;
  defaultPostingFrequency?: number;
  defaultIdealDurationMinutes?: number;
}

interface TemplateTeamMember {
  agentId: string;
  role?: string;
  teamId?: string;
  assignedDate?: Date;
  agent: {
    id: string;
    name?: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

interface Template {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  packageId?: string;
  package?: {
    id: string;
    name: string;
  };
  sitesAssets?: TemplateSiteAsset[];
  templateTeamMembers?: TemplateTeamMember[];
  _count?: {
    sitesAssets: number;
    templateTeamMembers: number;
    assignments: number;
  };
  assignedClients?: Array<{
    id: string;
    name: string | null;
    company: string | null;
    avatar?: string | null;
    status?: string | null;
  }>;
  assignedClientsCount?: number;
  tasksCount: number;
  pendingDraftClientsCount?: number;
  hasPendingDraftPublish?: boolean;
}

type FilterStatus = "all" | "draft" | "requested" | "approved" | "rejected";

export default function TemplateListPage() {
  const { package: slug } = useParams();
  const packageId = String(slug).replace("id-", "");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user: currentUser, loading: sessionLoading } = useUserSession();
  const currentUserRole = String(
    typeof (currentUser as any)?.role === "string"
      ? (currentUser as any)?.role
      : (currentUser as any)?.role?.name ?? ""
  )
    .trim()
    .toLowerCase();
  const shouldHideDraftAttention = ["am", "am_ceo"].includes(currentUserRole);

  const canViewTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_view");
  const canCreateTemplate =
    !sessionLoading &&
    (hasPermissionClient(currentUser?.permissions, "template_create") ||
      hasPermissionClient(currentUser?.permissions, "template_edit"));
  const canEditTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_edit");
  const canDeleteTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_delete");
  const canAssignTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_assign");
  const canDuplicateTemplate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "template_duplicate");

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [assigningTemplate, setAssigningTemplate] = useState<Template | null>(
    null
  );

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [targetTemplate, setTargetTemplate] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ⚡ OPTIMIZED: Use SWR for parallel data fetching with caching
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  // Fetch package name
  const { data: packageData, error: packageError } = useSWR(
    packageId ? `/api/zisanpackages/${packageId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const packageName = packageData?.name || (packageError ? "Package Not Found" : "Loading...");

  // Fetch asset types (for dynamic labels + ordering)
  const { data: assetTypeData } = useSWR<{ assetTypes: AssetTypeOption[] }>(
    "/api/asset-types",
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  const assetTypes = assetTypeData?.assetTypes ?? [];

  const assetTypeOrder = useMemo(() => {
    const map = new Map<string, number>();
    assetTypes.forEach((t) => map.set(t.slug, t.sortOrder ?? 0));
    return map;
  }, [assetTypes]);

  const labelBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    assetTypes.forEach((t) => {
      map[t.slug] = t.label;
    });
    return map;
  }, [assetTypes]);

  // Fetch templates
  const {
    data: rawTemplates = [],
    isLoading: templatesLoading,
    mutate: mutateTemplates,
  } = useSWR<Template[]>(
    packageId ? `/api/zisanpackages/${packageId}/templates?include=full` : null,
    jsonFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  );

  // ⚡ OPTIMIZED: Memoize filtered templates for current package
  const templates = useMemo(() => {
    return rawTemplates.filter((template: Template) => {
      return template.packageId === packageId || template.package?.id === packageId;
    });
  }, [rawTemplates, packageId]);

  const loading = templatesLoading || !packageData;

  // Filtered and searched templates with additional packageId validation
  const filteredTemplates = useMemo(() => {
    let filtered = templates.filter((template) => {
      // Ensure template belongs to current package
      return (
        template.packageId === packageId || template.package?.id === packageId
      );
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          (template.description &&
            template.description.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (template) => normalizeTemplateStatus(template.status) === statusFilter
      );
    }

    return filtered;
  }, [templates, searchQuery, statusFilter, packageId]);

  // ⚡ OPTIMIZED: Use SWR mutate instead of manual fetch
  const reloadTemplates = useCallback(() => {
    mutateTemplates();
  }, [mutateTemplates]);

  // NO browser confirm/alert here
  const handleDeleteTemplate = async () => {
    if (!targetTemplate) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/templates/${targetTemplate.id}?actorId=${currentUser?.id ?? ""}`,
        {
          method: "DELETE",
          headers: { "x-actor-id": currentUser?.id ?? "" },
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "Failed to delete template");
      }
      toast.success("Template deleted successfully");
      setOpenDeleteModal(false);
      setTargetTemplate(null);
      // ⚡ OPTIMIZED: Use SWR mutate
      await mutateTemplates();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const duplicateTemplate = async (templateId: string) => {
    const ok = confirm(
      "Duplicate this template? A draft copy will be created."
    );
    if (!ok) return;

    setDuplicatingId(templateId);
    try {
      const res = await fetch(
        `/api/templates/${templateId}/duplicate?actorId=${
          currentUser?.id ?? ""
        }`,
        {
          method: "POST",
          headers: {
            "x-actor-id": currentUser?.id ?? "",
          },
        }
      );

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "Duplication failed");
      }

      // ⚡ OPTIMIZED: Use SWR mutate
      await mutateTemplates();
      toast.success("Template duplicated successfully");
    } catch (err: any) {
      alert(err?.message || "Duplication failed");
      console.error(err);
    } finally {
      setDuplicatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const statusLower = normalizeTemplateStatus(status);
    if (statusLower === "approved") {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-800/50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    } else if (statusLower === "requested") {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-800/50">
          <Clock className="w-3 h-3 mr-1" />
          Requested
        </Badge>
      );
    } else if (statusLower === "draft") {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-800/50">
          <Clock className="w-3 h-3 mr-1" />
          Draft
        </Badge>
      );
    } else if (statusLower === "rejected") {
      return (
        <Badge
          className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-800/50"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    return <Badge variant="outline">{getTemplateStatusLabel(status)}</Badge>;
  };

  const getFilterButtonClass = (filter: FilterStatus) => {
    const baseClass =
      "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105";
    if (statusFilter === filter) {
      return `${baseClass} bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md dark:bg-card dark:text-muted-foreground dark:border-border dark:hover:bg-muted/40 dark:hover:border-border`;
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== "all";

  // Get templates count for current package only
  const currentPackageTemplates = templates.filter((template) => {
    return (
      template.packageId === packageId || template.package?.id === packageId
    );
  });

  // Get type counts for a template (dynamic)
  const getTemplateTypeEntries = (template: Template) => {
    const counts: Record<string, number> = {};
    for (const site of template.sitesAssets ?? []) {
      const normalized = normalizeAssetTypeSlug(site.type) || site.type;
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => {
      const orderA = assetTypeOrder.get(a[0]) ?? 0;
      const orderB = assetTypeOrder.get(b[0]) ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a[0].localeCompare(b[0]);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-background dark:via-blue-950/40 dark:to-indigo-900/40">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-40" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-80" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-16" />
                </CardContent>
                <CardFooter className="pt-4">
                  <div className="flex gap-2 w-full">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 flex-1" />
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if package not found
  if (packageName === "Package Not Found") {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-background dark:via-blue-950/40 dark:to-indigo-900/40">
        <div className="p-6 max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-red-100 rounded-full mb-4 dark:bg-red-900/40">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-900 mb-2 dark:text-red-300">
                Package Not Found
              </h3>
              <p className="text-red-700 mb-6 max-w-sm dark:text-red-300">
                The package you're looking for doesn't exist or you don't have
                access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-background dark:via-blue-950/40 dark:to-indigo-900/40">
      <div className="p-6 space-y-8">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
                Templates
              </h1>
              <p className="text-gray-600 mt-2 text-lg dark:text-muted-foreground">
                Managing templates for{" "}
                <span className="font-semibold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
                  {packageName}
                </span>
                <span className="text-sm text-gray-400 ml-2 dark:text-muted-foreground">
                  (ID: {packageId})
                </span>
              </p>
            </div>
          </div>

          {/* Search and Filter Section */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-card/80">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 dark:text-muted-foreground" />
                  <Input
                    placeholder="Search templates by name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-12 h-12 text-base border-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors dark:text-muted-foreground dark:hover:text-muted-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 mr-2">
                    <Filter className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
                    <span className="text-sm text-gray-600 font-medium dark:text-muted-foreground">
                      Filter:
                    </span>
                  </div>
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={getFilterButtonClass("all")}
                  >
                    All ({currentPackageTemplates.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("requested")}
                    className={getFilterButtonClass("requested")}
                  >
                    Requested (
                    {
                      currentPackageTemplates.filter(
                        (t) => normalizeTemplateStatus(t.status) === "requested"
                      ).length
                    }
                    )
                  </button>
                  <button
                    onClick={() => setStatusFilter("draft")}
                    className={getFilterButtonClass("draft")}
                  >
                    Draft (
                    {
                      currentPackageTemplates.filter(
                        (t) => normalizeTemplateStatus(t.status) === "draft"
                      ).length
                    }
                    )
                  </button>
                  <button
                    onClick={() => setStatusFilter("approved")}
                    className={getFilterButtonClass("approved")}
                  >
                    Approved (
                    {
                      currentPackageTemplates.filter(
                        (t) => normalizeTemplateStatus(t.status) === "approved"
                      ).length
                    }
                    )
                  </button>
                  <button
                    onClick={() => setStatusFilter("rejected")}
                    className={getFilterButtonClass("rejected")}
                  >
                    Rejected (
                    {
                      currentPackageTemplates.filter(
                        (t) => normalizeTemplateStatus(t.status) === "rejected"
                      ).length
                    }
                    )
                  </button>
                </div>
              </div>

              {/* Active Filters & Results Count */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100 dark:border-border">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 flex items-center gap-2 dark:text-muted-foreground">
                    <Activity className="w-4 h-4" />
                    Showing{" "}
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {filteredTemplates.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-gray-900 dark:text-foreground">
                      {currentPackageTemplates.length}
                    </span>{" "}
                    templates
                  </span>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="text-gray-600 border-gray-300 hover:bg-gray-50 bg-transparent rounded-lg dark:text-muted-foreground dark:border-border dark:hover:bg-muted/40"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>

                {canCreateTemplate && (
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl px-6"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Template
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300 bg-white/50 backdrop-blur-sm dark:border-border dark:bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-6 bg-linear-to-br from-gray-100 to-gray-200 rounded-full mb-6 dark:from-background dark:to-muted">
                {hasActiveFilters ? (
                  <Search className="w-12 h-12 text-gray-400 dark:text-muted-foreground" />
                ) : (
                  <FileText className="w-12 h-12 text-gray-400 dark:text-muted-foreground" />
                )}
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3 dark:text-foreground">
                {hasActiveFilters ? "No templates found" : "No templates yet"}
              </h3>
              <p className="text-gray-500 mb-8 max-w-md text-lg dark:text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your search or filter criteria to find what you're looking for."
                  : "Get started by creating your first template for this package."}
              </p>
              {hasActiveFilters ? (
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="lg"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent rounded-xl px-8 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              ) : (
                canCreateTemplate && (
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    size="lg"
                    className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl px-8"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Template
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTemplates.map((template) => {
              const typeEntries = getTemplateTypeEntries(template);
              // Detect if this is a customized template
              const isCustomized = template.description?.includes("Custom template for client:") || false;
              const isMainTemplate = !isCustomized;
              const hasPendingDraftPublish =
                !!template.hasPendingDraftPublish && !shouldHideDraftAttention;
              
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "group overflow-hidden backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-900 border-0 ring-2 hover:scale-101",
                    hasPendingDraftPublish
                      ? "bg-linear-to-br from-amber-50 to-orange-50 ring-amber-300 hover:ring-amber-400 dark:from-amber-950/40 dark:to-orange-950/40"
                      : isCustomized 
                        ? "bg-linear-to-br from-purple-50 to-pink-50 ring-purple-300 hover:ring-purple-400 dark:from-purple-950/40 dark:to-pink-950/40"
                        : "bg-white/90 ring-gray-200 hover:ring-blue-300 dark:bg-card/90 dark:ring-border"
                  )}
                >
                  <CardHeader className={cn(
                    "pb-4 relative overflow-hidden",
                    isCustomized
                      ? "bg-linear-to-r from-purple-100 via-pink-100 to-purple-100 dark:from-purple-900/40 dark:via-pink-900/40 dark:to-purple-900/40"
                      : "bg-linear-to-r from-slate-50 via-blue-50 to-indigo-50 dark:from-background dark:via-blue-950/40 dark:to-indigo-950/40"
                  )}>
                    <div className={cn(
                      "absolute inset-0",
                      isCustomized
                        ? "bg-linear-to-r from-purple-600/10 to-pink-600/10"
                        : "bg-linear-to-r from-blue-600/5 to-purple-600/5"
                    )}></div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shadow-sm",
                            isCustomized
                              ? "bg-linear-to-br from-purple-500 to-pink-600"
                              : "bg-linear-to-br from-blue-500 to-purple-600"
                          )}>
                            {isCustomized ? (
                              <Sparkles className="w-5 h-5 text-white" />
                            ) : (
                              <FileText className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={cn(
                                "font-bold group-hover:text-blue-600 transition-colors text-lg leading-tight dark:group-hover:text-blue-400",
                                isCustomized ? "text-purple-900 dark:text-purple-300" : "text-gray-900 dark:text-foreground"
                              )}>
                                {template.name}
                              </h3>
                              {isCustomized && (
                                <Badge className="bg-linear-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Customized
                                </Badge>
                              )}
                              {isMainTemplate && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs px-2 py-0.5 flex items-center gap-1 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">
                                  <Star className="w-3 h-3" />
                                  Main
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 dark:text-muted-foreground">
                              Template ID: {template.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(template.status)}
                      </div>
                      {hasPendingDraftPublish && (
                        <div className="mt-2">
                          <Badge className="bg-linear-to-r from-orange-500 to-amber-500 text-white animate-[pulse_900ms_ease-in-out_infinite]">
                            Pending Publish {template.pendingDraftClientsCount ? `(${template.pendingDraftClientsCount})` : ""}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-5">
                    {template.description ? (
                      <div className="space-y-2">
                        {isCustomized && (
                          <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg dark:bg-purple-950/40 dark:border-purple-800">
                            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 shrink-0 dark:text-purple-400" />
                            <div>
                              <p className="text-xs font-semibold text-purple-900 mb-1 dark:text-purple-300">Customized Template</p>
                              <p className="text-xs text-purple-700 leading-relaxed dark:text-purple-300">
                                {template.description.replace("Custom template for client: ", "").split(".")[0]}
                              </p>
                            </div>
                          </div>
                        )}
                        {!isCustomized && (
                          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/40 dark:border-blue-800">
                            <Star className="w-4 h-4 text-blue-600 mt-0.5 shrink-0 dark:text-blue-400" />
                            <p className="text-sm text-blue-900 leading-relaxed line-clamp-2 dark:text-blue-300">
                              {template.description}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic dark:text-muted-foreground">
                        No description provided
                      </p>
                    )}

                    {/* Detailed Site Statistics */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 dark:text-muted-foreground">
                          <Target className="w-3 h-3" />
                          Site Breakdown
                        </h4>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="p-1.5 bg-amber-100 rounded-md dark:bg-amber-900/40">
                            <Users className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          </div>
                          <span className="text-gray-600 dark:text-muted-foreground">Clients:</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {template.assignedClientsCount ?? 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {typeEntries.length ? (
                          typeEntries.map(([type, count]) => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="bg-white text-gray-700 border-gray-200 dark:bg-card dark:text-foreground dark:border-border"
                            >
                              {labelBySlug[type] || formatAssetTypeLabel(type)}: {count}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-muted-foreground">No assets</span>
                        )}
                      </div>
                    </div>

                    {/* Team, Assignments & Tasks — compact chips */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-border">
                      {/* Team */}
                      <div
                        className="group flex items-center justify-between rounded-lg border bg-white px-2.5 py-2 hover:shadow-sm transition dark:bg-card"
                        aria-label="Team members on this template"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950/40 dark:border-orange-800">
                            <Users className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                          </span>
                          <span className="text-[11px] leading-none text-gray-600 dark:text-muted-foreground">
                            Assets
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-orange-700 tabular-nums dark:text-orange-300">
                          {template._count?.sitesAssets ??
                            template.sitesAssets?.length ??
                            0}
                        </span>
                      </div>

                      {/* Assignments */}
                      <div
                        className="group flex items-center justify-between rounded-lg border bg-white px-2.5 py-2 hover:shadow-sm transition dark:bg-card"
                        aria-label="Assignments on this template"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800">
                            <Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          </span>
                          <span className="text-[11px] leading-none text-gray-600 dark:text-muted-foreground">
                            Assignments
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-indigo-700 tabular-nums dark:text-indigo-300">
                          {template._count?.assignments ?? 0}
                        </span>
                      </div>

                      {/* Tasks */}
                      <div
                        className="group flex items-center justify-between rounded-lg border bg-white px-2.5 py-2 hover:shadow-sm transition dark:bg-card"
                        aria-label="Tasks on this template"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
                            <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </span>
                          <span className="text-[11px] leading-none text-gray-600 dark:text-muted-foreground">
                            Tasks
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-blue-700 tabular-nums dark:text-blue-300">
                          {template.tasksCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <div className="flex gap-2 w-full ">
                      {/* View Button */}

                      {canViewTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 bg-transparent rounded-lg dark:border-blue-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          onClick={() => setViewingTemplate(template)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      )}

                      {canEditTemplate &&
                        ((template.assignedClientsCount ?? 0) === 0 ||
                          normalizeTemplateStatus(template.status) === "draft" ||
                          template.hasPendingDraftPublish) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-200 hover:border-green-300 hover:bg-green-50 hover:text-green-600 transition-all duration-200 bg-transparent rounded-lg dark:border-green-800 dark:hover:border-green-700 dark:hover:bg-green-950/40 dark:hover:text-green-400"
                          onClick={() => setEditingTemplate(template)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}

                      {/* Delete button hidden */}
                      {/* {canDeleteTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all duration-200 bg-transparent rounded-lg px-3"
                          onClick={() => {
                            setTargetTemplate(template);
                            setOpenDeleteModal(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )} */}
                      {canDuplicateTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-teal-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600 transition-all duration-200 bg-transparent rounded-lg px-3 dark:border-teal-800 dark:hover:border-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-400"
                          onClick={() => duplicateTemplate(template.id)}
                          disabled={duplicatingId === template.id}
                        >
                          {duplicatingId === template.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-teal-300 border-t-teal-600 dark:border-teal-700" />
                          ) : (
                            <Copy className="w-4 h-4 mr-1" />
                          )}
                          {duplicatingId === template.id
                            ? "Duplicating..."
                            : "Duplicate"}
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modals */}
        <CreateTemplateModal
          isOpen={isCreateModalOpen || !!editingTemplate}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingTemplate(null);
          }}
          packageId={packageId}
          onCreated={reloadTemplates}
          initialData={editingTemplate}
          isEditMode={!!editingTemplate}
        />

        <TemplateViewModal
          isOpen={!!viewingTemplate}
          onClose={() => setViewingTemplate(null)}
          template={viewingTemplate}
          assetTypeLabels={labelBySlug}
        />

        <AssignTemplateModal
          isOpen={!!assigningTemplate}
          onClose={() => setAssigningTemplate(null)}
          templateId={assigningTemplate?.id || ""}
          templateName={assigningTemplate?.name || ""}
          packageId={assigningTemplate?.packageId || ""}
          onAssignComplete={(clientId) => {
            setAssigningTemplate(null);
            reloadTemplates(); // optional refresh
          }}
        />

        <DangerDeleteTemplateModal
          open={openDeleteModal}
          onOpenChange={(v) => {
            if (!v) setTargetTemplate(null);
            setOpenDeleteModal(v);
          }}
          templateId={targetTemplate?.id || ""}
          templateName={targetTemplate?.name || ""}
          isDeleting={isDeleting}
          onConfirm={handleDeleteTemplate}
        />
      </div>
    </div>
  );
}

