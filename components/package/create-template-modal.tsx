"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Share2,
  Globe,
  FileText,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Palette,
  PenTool,
  FileEdit,
  Link as LinkIcon,
  CheckCircle,
  Youtube,
  BarChart,
  ShieldAlert,
  FileBarChart,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { hasPermissionClient } from "@/lib/permissions-client";
import {
  formatAssetTypeLabel,
  normalizeAssetTypeSlug,
  slugifyAssetType,
} from "@/lib/asset-types";
import type { AssetTypeOption } from "@/types/asset-types";
import {
  DEFAULT_SOCIAL_SITES,
  DEFAULT_WEB2_SITES,
  DEFAULT_ADDITIONAL_SITES,
  DEFAULT_GRAPHICS_DESIGN,
  DEFAULT_IMAGE_OPTIMIZATION,
  DEFAULT_CONTENT_STUDIO,
  DEFAULT_CONTENT_WRITING,
  DEFAULT_BACKLINKS,
  DEFAULT_YOUTUBE_VIDEO_OPTIMIZATION,
  DEFAULT_MONITORING,
  DEFAULT_REVIEW_REMOVAL,
  DEFAULT_SUMMARY_REPORT,
  DEFAULT_guest_posting,
} from "@/Data/template_site";

// === Types ===
type SiteAssetTypeTS = string; // allow predefined and custom types

interface SiteAsset {
  type: SiteAssetTypeTS;
  name: string;
  url: string;
  description: string;
  isRequired: boolean;
  defaultPostingFrequency: number; // per month
  defaultIdealDurationMinutes: number;
}

interface TemplateSiteAssetLike extends SiteAsset {}

interface Template {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  sitesAssets?: TemplateSiteAssetLike[];
}

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId: string;
  onCreated: () => void;
  initialData?: Template | null;
  isEditMode?: boolean;
}

export function CreateTemplateModal({
  isOpen,
  onClose,
  packageId,
  onCreated,
  initialData,
  isEditMode = false,
}: CreateTemplateModalProps) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();
  const canManageAssetTypes = hasPermissionClient(
    user?.permissions,
    "asset_type_manage"
  );
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([]);

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");

  // Per-type site-asset state
  const [socialSites, setSocialSites] = useState<SiteAsset[]>([]);
  const [web2Sites, setWeb2Sites] = useState<SiteAsset[]>([]);
  const [additionalSites, setAdditionalSites] = useState<SiteAsset[]>([]);
  const [graphicsDesign, setGraphicsDesign] = useState<SiteAsset[]>([]);
  const [imageOptimization, setImageOptimization] = useState<SiteAsset[]>([]);
  const [contentStudio, setContentStudio] = useState<SiteAsset[]>([]);
  const [contentWriting, setContentWriting] = useState<SiteAsset[]>([]);
  const [backlinks, setBacklinks] = useState<SiteAsset[]>([]);
  const [completedCom, setCompletedCom] = useState<SiteAsset[]>([]);
  const [youtubeOptimization, setYoutubeOptimization] = useState<SiteAsset[]>(
    [],
  );
  const [monitoring, setMonitoring] = useState<SiteAsset[]>([]);
  const [reviewRemoval, setReviewRemoval] = useState<SiteAsset[]>([]);
  const [summaryReport, setSummaryReport] = useState<SiteAsset[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<SiteAsset[]>([]);
  // store dynamic custom type lists
  const [customTypes, setCustomTypes] = useState<Record<string, SiteAsset[]>>(
    {},
  );
  // Add this state near your other state declarations
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeError, setNewTypeError] = useState("");
  const [creatingType, setCreatingType] = useState(false);

  // Dynamic enabled types for steps (after Basic Info)
  const FALLBACK_TYPES: SiteAssetTypeTS[] = [
    "social_site",
    "web2_site",
    "other_asset",
    "graphics_design",
    "image_optimization",
    "content_studio",
    "content_writing",
    "backlinks",
    "completed_com",
    "youtube_video_optimization",
    "monitoring",
    "review_removal",
    "summary_report",
    "guest_posting",
  ];
  const allTypes = useMemo(
    () =>
      (assetTypes.length ? assetTypes.map((t) => t.slug) : FALLBACK_TYPES) as
        SiteAssetTypeTS[],
    [assetTypes],
  );

  const labelBySlug = useMemo(
    () =>
      assetTypes.reduce<Record<string, string>>((acc, t) => {
        acc[t.slug] = t.label;
        return acc;
      }, {}),
    [assetTypes],
  );

  const TYPE_CONFIG: Record<
    SiteAssetTypeTS,
    { title: string; colorClass: string; icon: React.ReactNode }
  > = {
    social_site: {
      title: "Social Sites",
      colorClass: "bg-blue-500",
      icon: <Share2 className="w-5 h-5" />,
    },
    web2_site: {
      title: "Web 2.0 Sites",
      colorClass: "bg-purple-500",
      icon: <Globe className="w-5 h-5" />,
    },
    other_asset: {
      title: "Additional Sites",
      colorClass: "bg-green-500",
      icon: <Sparkles className="w-5 h-5" />,
    },
    graphics_design: {
      title: "Graphics Design",
      colorClass: "bg-rose-500",
      icon: <Palette className="w-5 h-5" />,
    },
    image_optimization: {
      title: "Image Optimization",
      colorClass: "bg-rose-500",
      icon: <Palette className="w-5 h-5" />,
    },
    content_studio: {
      title: "Content Studio",
      colorClass: "bg-emerald-500",
      icon: <PenTool className="w-5 h-5" />,
    },
    content_writing: {
      title: "Content Writing",
      colorClass: "bg-indigo-500",
      icon: <FileEdit className="w-5 h-5" />,
    },
    backlinks: {
      title: "Backlinks",
      colorClass: "bg-sky-500",
      icon: <LinkIcon className="w-5 h-5" />,
    },
    completed_com: {
      title: "Completed.com",
      colorClass: "bg-green-500",
      icon: <CheckCircle className="w-5 h-5" />,
    },
    youtube_video_optimization: {
      title: "YouTube Optimization",
      colorClass: "bg-red-500",
      icon: <Youtube className="w-5 h-5" />,
    },
    monitoring: {
      title: "Monitoring",
      colorClass: "bg-slate-500",
      icon: <BarChart className="w-5 h-5" />,
    },
    review_removal: {
      title: "Review Removal",
      colorClass: "bg-amber-500",
      icon: <ShieldAlert className="w-5 h-5" />,
    },
    summary_report: {
      title: "Summary Report",
      colorClass: "bg-fuchsia-500",
      icon: <FileBarChart className="w-5 h-5" />,
    },
    guest_posting: {
      title: "Guest Posting",
      colorClass: "bg-fuchsia-500",
      icon: <FileBarChart className="w-5 h-5" />,
    },
  };

  const [enabledTypes, setEnabledTypes] =
    useState<SiteAssetTypeTS[]>(allTypes);

  const steps = [
    {
      id: "basic",
      title: "Basic Info",
      description: "Template details",
      icon: FileText,
    },
    ...enabledTypes.map((t) => {
      const cfg = TYPE_CONFIG[t];
      const title =
        labelBySlug[t] ||
        (cfg
          ? cfg.title
          : t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
      return {
        id: t,
        title,
        description: "",
        icon: () => null,
      };
    }),
  ];

  // Helpers to create default SiteAsset from a simple default item
  const mapDefaults = (type: SiteAssetTypeTS) => (site: SiteAsset) => ({
    type,
    name: site.name,
    url: site.url ?? "",
    description: site.description ?? "",
    isRequired: site.isRequired ?? true,
    defaultPostingFrequency: site.defaultPostingFrequency ?? 3,
    defaultIdealDurationMinutes: site.defaultIdealDurationMinutes ?? 30,
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");
        setStatus(initialData.status || "draft");

        const assets = initialData.sitesAssets ?? [];
        const pick = (t: SiteAssetTypeTS) =>
          assets.filter((a) => normalizeAssetTypeSlug(a.type) === t) as SiteAsset[];

        setSocialSites(
          pick("social_site").length
            ? pick("social_site")
            : DEFAULT_SOCIAL_SITES.map(mapDefaults("social_site")),
        );
        setWeb2Sites(
          pick("web2_site").length
            ? pick("web2_site")
            : DEFAULT_WEB2_SITES.map(mapDefaults("web2_site")),
        );
        setAdditionalSites(
          pick("other_asset").length
            ? pick("other_asset")
            : DEFAULT_ADDITIONAL_SITES.map(mapDefaults("other_asset")),
        );
        setGraphicsDesign(
          pick("graphics_design").length
            ? pick("graphics_design")
            : DEFAULT_GRAPHICS_DESIGN.map(mapDefaults("graphics_design")),
        );
        setImageOptimization(
          pick("image_optimization").length
            ? pick("image_optimization")
            : DEFAULT_IMAGE_OPTIMIZATION.map(mapDefaults("image_optimization")),
        );
        setContentStudio(
          pick("content_studio").length
            ? pick("content_studio")
            : DEFAULT_CONTENT_STUDIO.map(mapDefaults("content_studio")),
        );
        setContentWriting(
          pick("content_writing").length
            ? pick("content_writing")
            : DEFAULT_CONTENT_WRITING.map(mapDefaults("content_writing")),
        );
        setBacklinks(
          pick("backlinks").length
            ? pick("backlinks")
            : DEFAULT_BACKLINKS.map(mapDefaults("backlinks")),
        );
        setCompletedCom(
          pick("completed_com").length
            ? pick("completed_com")
            : [
                {
                  type: "completed_com",
                  name: "Completed.com",
                  url: "https://Completed.com",
                  description: "",
                  isRequired: true,
                  defaultPostingFrequency: 1,
                  defaultIdealDurationMinutes: 30,
                },
              ],
        );
        setYoutubeOptimization(
          pick("youtube_video_optimization").length
            ? pick("youtube_video_optimization")
            : DEFAULT_YOUTUBE_VIDEO_OPTIMIZATION.map(
                mapDefaults("youtube_video_optimization"),
              ),
        );
        setMonitoring(
          pick("monitoring").length
            ? pick("monitoring")
            : DEFAULT_MONITORING.map(mapDefaults("monitoring")),
        );
        setReviewRemoval(
          pick("review_removal").length
            ? pick("review_removal")
            : DEFAULT_REVIEW_REMOVAL.map(mapDefaults("review_removal")),
        );
        setSummaryReport(
          pick("summary_report").length
            ? pick("summary_report")
            : DEFAULT_SUMMARY_REPORT.map(mapDefaults("summary_report")),
        );
        setMonthlyReport(
          pick("guest_posting").length
            ? pick("guest_posting")
            : DEFAULT_guest_posting.map(mapDefaults("guest_posting")),
        );
        // Enable types which have assets in initial data
        const presentTypes = Array.from(
          new Set(
            (assets as SiteAsset[]).map((a) =>
              normalizeAssetTypeSlug(a.type) as SiteAssetTypeTS
            ),
          ),
        );
        setEnabledTypes(presentTypes.length ? presentTypes : allTypes);

        // Populate custom type lists for types not handled by fixed state lists
        const fixedTypeSet = new Set(FALLBACK_TYPES);
        const customPresentTypes = presentTypes.filter((t) => !fixedTypeSet.has(t));
        if (customPresentTypes.length) {
          const map: Record<string, SiteAsset[]> = {};
          for (const t of customPresentTypes) {
            map[t] = (assets as SiteAsset[]).filter(
              (a) => normalizeAssetTypeSlug(a.type) === t,
            ) as SiteAsset[];
          }
          setCustomTypes(map);
        } else {
          setCustomTypes({});
        }
      } else {
        initializeDefaultAssets();
      }
      setCurrentStep(0);
    }
  }, [isOpen, isEditMode, initialData]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchAssetTypes = async () => {
      try {
        const res = await fetch("/api/asset-types");
        const data = await res.json();
        setAssetTypes(Array.isArray(data?.assetTypes) ? data.assetTypes : []);
      } catch (error) {
        console.error("Failed to load asset types:", error);
      }
    };
    fetchAssetTypes();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && initialData) return;
    setEnabledTypes(allTypes);
  }, [allTypes, isOpen, isEditMode, initialData]);

  const initializeDefaultAssets = () => {
    setName("");
    setDescription("");
    setStatus("active");

    setSocialSites(DEFAULT_SOCIAL_SITES.map(mapDefaults("social_site")));
    setWeb2Sites(DEFAULT_WEB2_SITES.map(mapDefaults("web2_site")));
    setAdditionalSites(
      DEFAULT_ADDITIONAL_SITES.map(mapDefaults("other_asset")),
    );
    setGraphicsDesign(
      DEFAULT_GRAPHICS_DESIGN.map(mapDefaults("graphics_design")),
    );
    setImageOptimization(
      DEFAULT_IMAGE_OPTIMIZATION.map(mapDefaults("image_optimization")),
    );
    setContentStudio(DEFAULT_CONTENT_STUDIO.map(mapDefaults("content_studio")));
    setContentWriting(
      DEFAULT_CONTENT_WRITING.map(mapDefaults("content_writing")),
    );
    setBacklinks(DEFAULT_BACKLINKS.map(mapDefaults("backlinks")));
    setCompletedCom([
      {
        type: "completed_com",
        name: "Completed.com",
        url: "https://Completed.com",
        description: "",
        isRequired: false,
        defaultPostingFrequency: 1,
        defaultIdealDurationMinutes: 30,
      },
    ]);
    setYoutubeOptimization(
      DEFAULT_YOUTUBE_VIDEO_OPTIMIZATION.map(
        mapDefaults("youtube_video_optimization"),
      ),
    );
    setMonitoring(DEFAULT_MONITORING.map(mapDefaults("monitoring")));
    setReviewRemoval(DEFAULT_REVIEW_REMOVAL.map(mapDefaults("review_removal")));
    setSummaryReport(DEFAULT_SUMMARY_REPORT.map(mapDefaults("summary_report")));
    setMonthlyReport(DEFAULT_guest_posting.map(mapDefaults("guest_posting")));
    setEnabledTypes(allTypes);
    setCustomTypes({});
  };

  const resetForm = () => {
    initializeDefaultAssets();
    setCurrentStep(0);
  };

  // Generic helpers to operate on the correct list
  const getListAndSetter = (
    type: SiteAssetTypeTS,
  ): [SiteAsset[], React.Dispatch<React.SetStateAction<SiteAsset[]>>] => {
    switch (type) {
      case "social_site":
        return [socialSites, setSocialSites];
      case "web2_site":
        return [web2Sites, setWeb2Sites];
      case "other_asset":
        return [additionalSites, setAdditionalSites];
      case "graphics_design":
        return [graphicsDesign, setGraphicsDesign];
      case "image_optimization":
        return [imageOptimization, setImageOptimization];
      case "content_studio":
        return [contentStudio, setContentStudio];
      case "content_writing":
        return [contentWriting, setContentWriting];
      case "backlinks":
        return [backlinks, setBacklinks];
      case "completed_com":
        return [completedCom, setCompletedCom];
      case "youtube_video_optimization":
        return [youtubeOptimization, setYoutubeOptimization];
      case "monitoring":
        return [monitoring, setMonitoring];
      case "review_removal":
        return [reviewRemoval, setReviewRemoval];
      case "summary_report":
        return [summaryReport, setSummaryReport];
      case "guest_posting":
        return [monthlyReport, setMonthlyReport];
      default: {
        const list = customTypes[type] || [];
        const setter: React.Dispatch<React.SetStateAction<SiteAsset[]>> = (
          updater,
        ) => {
          setCustomTypes((prev) => {
            const current = prev[type] || [];
            const next =
              typeof updater === "function"
                ? (updater as any)(current)
                : updater;
            return { ...prev, [type]: next };
          });
        };
        return [list, setter];
      }
    }
  };

  const addSiteAsset = (type: SiteAssetTypeTS) => {
    const [list, setter] = getListAndSetter(type);
    const newAsset: SiteAsset = {
      type,
      name: "",
      url: "",
      description: "",
      isRequired: false,
      defaultPostingFrequency: 3,
      defaultIdealDurationMinutes: 30,
    };
    setter([...list, newAsset]);
  };

  const removeSiteAsset = (type: SiteAssetTypeTS, index: number) => {
    const [list, setter] = getListAndSetter(type);
    setter(list.filter((_, i) => i !== index));
  };

  const updateSiteAsset = (
    type: SiteAssetTypeTS,
    index: number,
    field: keyof SiteAsset,
    value: any,
  ) => {
    const [list, setter] = getListAndSetter(type);
    const updated = [...list];
    updated[index] = { ...updated[index], [field]: value } as SiteAsset;
    setter(updated);
  };

  const nextStep = () =>
    currentStep < steps.length - 1 && setCurrentStep(currentStep + 1);
  const prevStep = () => currentStep > 0 && setCurrentStep(currentStep - 1);
  const canProceed = () => (currentStep === 0 ? name.trim().length > 0 : true);

  const handleCreateType = async () => {
    if (!canManageAssetTypes) {
      setNewTypeError("You do not have permission to add asset types");
      return;
    }
    const label = newTypeName.trim();
    if (!label) {
      setNewTypeError("Type name is required");
      return;
    }
    const slug = normalizeAssetTypeSlug(slugifyAssetType(label));
    if (!slug) {
      setNewTypeError("Invalid type name");
      return;
    }

    setCreatingType(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user?.id && user.id.trim() !== "") {
        headers["x-actor-id"] = user.id.trim();
      }

      const res = await fetch("/api/asset-types", {
        method: "POST",
        headers,
        body: JSON.stringify({ label, slug }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setNewTypeError(error.message || "Failed to create type");
        return;
      }

      const created = await res.json();
      setAssetTypes((prev) => {
        const next = [...prev, created];
        return next.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      });
      setEnabledTypes((prev) =>
        prev.includes(created.slug) ? prev : [...prev, created.slug]
      );
      setNewTypeName("");
      setNewTypeError("");
      setShowAddTypeModal(false);
      toast.success("Asset type created");
    } catch (error) {
      console.error("Create type error:", error);
      setNewTypeError("Failed to create type");
    } finally {
      setCreatingType(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setLoading(true);
    try {
      // Collect all lists
      const customSiteAssets = Object.entries(customTypes).flatMap(
        ([type, list]) =>
          list.map((site) => ({
            ...site,
            type: site.type ? site.type : type,
          })),
      );

      const allSiteAssets = [
        socialSites,
        web2Sites,
        additionalSites,
        graphicsDesign,
        imageOptimization,
        contentStudio,
        contentWriting,
        backlinks,
        completedCom,
        youtubeOptimization,
        monitoring,
        reviewRemoval,
        summaryReport,
        monthlyReport,
        customSiteAssets,
      ]
        .flat()
        .filter((site) => site.name.trim())
        .filter((site) => enabledTypes.includes(normalizeAssetTypeSlug(site.type)));

      const normalizedAssets = allSiteAssets.map((site) => ({
        ...site,
        type: normalizeAssetTypeSlug(site.type),
      }));

      const templateData = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        packageId,
        sitesAssets: normalizedAssets,
      };

      const url =
        isEditMode && initialData
          ? `/api/templates/${initialData.id}`
          : "/api/templates";
      const method = isEditMode ? "PUT" : "POST";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user?.id && user.id.trim() !== "")
        headers["x-actor-id"] = user.id.trim();

      const payload: any = { ...templateData };
      if (user?.id && user.id.trim() !== "") payload.actorId = user.id.trim();

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          isEditMode
            ? "Template updated successfully"
            : "Template created successfully",
        );
        onCreated();
        onClose();
        resetForm();
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || "Failed to save template");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving the template");
    } finally {
      setLoading(false);
    }
  };

  const renderSiteAssetFields = (
    sites: SiteAsset[],
    type: SiteAssetTypeTS,
    title: string,
    icon: React.ReactNode,
    colorClass: string,
  ) => (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-md ${colorClass} text-white`}>
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-gray-500">
              Configure your {title.toLowerCase()}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-gray-100">
          {sites.filter((site) => site.name.trim()).length} Sites
        </Badge>
      </div>

      {/* Compact table-like layout */}
      <div className="border rounded-lg overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 border-b text-xs font-medium text-gray-700">
          <div className="col-span-2">Site Name</div>
          <div className="col-span-3">URL</div>
          <div className="col-span-2">Description</div>
          <div className="col-span-1 text-center">Required</div>
          <div className="col-span-1 text-center">Posts/Month</div>
          <div className="col-span-1 text-center">Duration (min)</div>
          <div className="col-span-2"></div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {sites.map((site, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 p-2 border-b hover:bg-gray-50 items-center">
              <div className="col-span-2">
                <Input
                  value={site.name}
                  onChange={(e) =>
                    updateSiteAsset(type, index, "name", e.target.value)
                  }
                  placeholder="Site name"
                  className="text-sm h-8 bg-white"
                />
              </div>
              <div className="col-span-3">
                <Input
                  value={site.url}
                  onChange={(e) =>
                    updateSiteAsset(type, index, "url", e.target.value)
                  }
                  placeholder="https://..."
                  className="text-sm h-8 bg-white"
                />
              </div>
              <div className="col-span-2">
                <Input
                  value={site.description || ""}
                  onChange={(e) =>
                    updateSiteAsset(
                      type,
                      index,
                      "description",
                      e.target.value,
                    )
                  }
                  placeholder="Brief description..."
                  className="text-sm h-8 bg-white"
                />
              </div>
              <div className="col-span-1 flex justify-center">
                <Switch
                  checked={site.isRequired}
                  onCheckedChange={(checked) =>
                    updateSiteAsset(type, index, "isRequired", checked)
                  }
                  className="data-[state=checked]:bg-blue-500 scale-75"
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  min={0}
                  value={site.defaultPostingFrequency}
                  onChange={(e) =>
                    updateSiteAsset(
                      type,
                      index,
                      "defaultPostingFrequency",
                      e.target.value === ""
                        ? 0
                        : Number.isNaN(Number.parseInt(e.target.value, 10))
                          ? 0
                          : Number.parseInt(e.target.value, 10),
                    )
                  }
                  className="text-sm h-8 bg-white w-full"
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  min={1}
                  value={site.defaultIdealDurationMinutes}
                  onChange={(e) =>
                    updateSiteAsset(
                      type,
                      index,
                      "defaultIdealDurationMinutes",
                      Number.parseInt(e.target.value || "30", 10) || 30,
                    )
                  }
                  className="text-sm h-8 bg-white w-full"
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSiteAsset(type, index)}
                  className="h-6 w-6 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    // Step 0: Basic info
    if (currentStep === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-blue-100 text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Basic Information</h2>
              <p className="text-sm text-gray-500">
                Set up your template details
              </p>
            </div>
          </div>

          <Card className="border shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">
                    Template Name *
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter template name"
                    className="bg-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">
                    Status
                  </Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          Draft
                        </div>
                      </SelectItem>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Active
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-gray-500" />
                          Inactive
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  Description
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this template..."
                  rows={3}
                  className="bg-white"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Subsequent steps map to enabled types
    const type = steps[currentStep].id as SiteAssetTypeTS;
    const [list] = getListAndSetter(type);
    const cfg = TYPE_CONFIG[type] || {
      title: labelBySlug[type] || formatAssetTypeLabel(type),
      colorClass: "bg-gray-500",
      icon: <FileBarChart className="w-5 h-5" />,
    };
    
    return renderSiteAssetFields(
      list,
      type,
      cfg.title,
      cfg.icon,
      cfg.colorClass,
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90vh] overflow-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <FileText className="w-5 h-5 text-blue-600" />
            {isEditMode ? "Edit Template" : "Create New Template"}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon as any;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isActive
                          ? "bg-blue-500 text-white shadow"
                          : isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="mt-1 text-center">
                      <p
                        className={`text-xs font-medium ${
                          isActive ? "text-blue-600" : "text-gray-600"
                        }`}
                      >
                        {step.title}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded-full ${
                        isCompleted ? "bg-green-400" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-1">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {canManageAssetTypes ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewTypeError("");
                  setShowAddTypeModal(true);
                }}
                className="border-dashed bg-purple-500 hover:bg-purple-600 text-white hover:text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Add Type
              </Button>
            ) : null}
            
            {/* Add and Reset buttons - only show on site asset steps */}
            {(() => {
              if (currentStep === 0) return null;
              const type = steps[currentStep].id as SiteAssetTypeTS;
              const cfg = TYPE_CONFIG[type] || {
                title: labelBySlug[type] || formatAssetTypeLabel(type),
              };
              return (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSiteAsset(type)}
                    className="border-dashed bg-purple-500 hover:bg-purple-600 text-white hover:text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add {cfg.title}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={initializeDefaultAssets}
                    className="border-dashed bg-red-600 hover:bg-red-700 text-white hover:text-white"
                  >
                    <RotateCw className="w-4 h-4 mr-2" />
                    Reset Defaults
                  </Button>
                </>
              );
            })()}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className="bg-blue-500 hover:bg-blue-600 text-white hover:text-white"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !canProceed()}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : isEditMode ? (
                  "Update Template"
                ) : (
                  "Create Template"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      <Dialog open={showAddTypeModal} onOpenChange={setShowAddTypeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Add Custom Type
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type-name" className="text-sm font-medium">
                Type Name *
              </Label>
              <Input
                id="type-name"
                value={newTypeName}
                onChange={(e) => {
                  setNewTypeName(e.target.value);
                  setNewTypeError("");
                }}
                placeholder="e.g., Local SEO, Video Production, etc."
                className="w-full"
              />
              {newTypeError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {newTypeError}
                </p>
              )}
              <p className="text-xs text-gray-500">
                This will create a new category for your template assets
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddTypeModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateType}
              disabled={creatingType}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creatingType ? "Creating..." : "Create Type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
