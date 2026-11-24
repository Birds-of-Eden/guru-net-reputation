// components/clients/clientsID/template-customization/customize-dialog.tsx
//lint error fixed
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { formatAssetTypeLabel, normalizeAssetTypeSlug } from "@/lib/asset-types";
import {
  CYCLE_SELECT_OPTIONS,
  cycleSelectValue,
  getPostingFrequency,
  postingCycleLabel,
  resolvePostingCycle,
} from "@/lib/posting-cycle";

interface CustomizeTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: any;
  currentTemplate: any;
  clientName: string;
  onSuccess?: () => void;
}

// Asset types will be loaded dynamically from API
interface AssetTypeOption {
  value: string;
  label: string;
}

interface NewAsset {
  type: string;
  name: string;
  customName: string;  // User's custom name
  url: string;
  description: string;
  isRequired: boolean;
  defaultPostingFrequency: number;
  postingInterval: number;      // 1 = every month, 2 = alternate, 3 = every 3 months
  postingStartOffset: number;   // 0 = from 1st month, 1 = from 2nd month
  defaultIdealDurationMinutes: number;
}

interface Replacement {
  oldAssetId: number;
  newAssetType: string;
  newAssetName: string;
  newAssetUrl: string;
  newAssetDescription: string;
  isRequired: boolean;
  defaultPostingFrequency: number;
  postingInterval: number;
  postingStartOffset: number;
  defaultIdealDurationMinutes: number;
}

// Default fallback asset types
const DEFAULT_ASSET_TYPES: AssetTypeOption[] = [
  { value: "social_site", label: "Social Sites" },
  { value: "web2_site", label: "Web 2.0 Sites" },
  { value: "other_asset", label: "Additional Sites" },
  { value: "graphics_design", label: "Graphics Design" },
  { value: "content_writing", label: "Content Writing" },
  { value: "youtube_video_optimization", label: "YouTube Optimization" },
  { value: "guest_posting", label: "Guest Posting" },
];

const parseFrequency = (raw: string) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : Math.min(30, Math.max(0, n));
};

const parseDuration = (raw: string) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n <= 0 ? 30 : Math.min(480, n);
};

/** Posting Cycle dropdown (Every month / Alternate / Every 3 months). */
function PostingCycleSelect({
  interval,
  offset,
  disabled,
  onChange,
}: {
  interval: number;
  offset: number;
  disabled?: boolean;
  onChange: (interval: number, offset: number) => void;
}) {
  return (
    <Select
      value={cycleSelectValue({ postingInterval: interval, postingStartOffset: offset })}
      onValueChange={(value) => {
        const [i, o] = value.split(":").map(Number);
        onChange(i, o);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className="w-full"
        title={disabled ? "Set Posting Frequency above 0 to choose a cycle" : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CYCLE_SELECT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CustomizeTemplateDialog({
  open,
  onOpenChange,
  assignment,
  currentTemplate,
  clientName,
  onSuccess,
}: CustomizeTemplateDialogProps) {
  const { user } = useUserSession();
  const [loading, setLoading] = useState(false);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([]);
  const [customTemplateName, setCustomTemplateName] = useState("");  // Custom template name
  const [newAssets, setNewAssets] = useState<NewAsset[]>([]);
  const [replacements, setReplacements] = useState<Replacement[]>([]);

  const templateAssets: any[] = useMemo(
    () => currentTemplate?.sitesAssets ?? [],
    [currentTemplate]
  );

  // Per-client overrides (frequency / duration / cycle) keyed by template asset id
  const settingsByAssetId = useMemo(() => {
    const map = new Map<number, any>();
    for (const s of assignment?.siteAssetSettings ?? []) {
      map.set(s.templateSiteAssetId, s);
    }
    return map;
  }, [assignment]);

  // Load all available asset types from API
  useEffect(() => {
    const fetchAssetTypes = async () => {
      try {
        setLoadingAssetTypes(true);
        const response = await fetch("/api/asset-types");
        if (response.ok) {
          const data = await response.json();
          const types = Array.isArray(data?.assetTypes)
            ? data.assetTypes.map((type: any) => ({
                value: type.slug,
                label: type.label || formatAssetTypeLabel(type.slug),
              }))
            : [];
          setAssetTypes(types.length > 0 ? types : DEFAULT_ASSET_TYPES);
        } else {
          // Fallback to default types if API fails
          setAssetTypes(DEFAULT_ASSET_TYPES);
        }
      } catch (error) {
        console.error("Error fetching asset types:", error);
        // Fallback to default types
        setAssetTypes(DEFAULT_ASSET_TYPES);
      } finally {
        setLoadingAssetTypes(false);
      }
    };

    if (open) {
      fetchAssetTypes();
    }
  }, [open]);

  // Template changed (e.g. after a customization) -> old asset ids are stale
  useEffect(() => {
    setReplacements([]);
  }, [currentTemplate?.id]);

  const typeLabel = (slug: string) =>
    assetTypes.find((t) => t.value === slug)?.label || formatAssetTypeLabel(slug);

  /** True when the name was auto-filled from a type label (safe to overwrite). */
  const isAutoFilledName = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return true;
    return [...assetTypes, ...DEFAULT_ASSET_TYPES].some(
      (t) =>
        t.label.toLowerCase() === n ||
        formatAssetTypeLabel(t.value).toLowerCase() === n
    );
  };

  /** Options for a type dropdown; keeps a current value visible even if it's no longer listed. */
  const typeOptionsWith = (current?: string): AssetTypeOption[] => {
    if (!current || assetTypes.some((t) => t.value === current)) return assetTypes;
    return [...assetTypes, { value: current, label: formatAssetTypeLabel(current) }];
  };

  const renderTypeSelectItems = (options: AssetTypeOption[]) =>
    loadingAssetTypes ? (
      <div className="p-4 text-center text-sm text-slate-500 dark:text-muted-foreground">
        <Loader className="h-4 w-4 animate-spin mx-auto mb-2" />
        Loading asset types...
      </div>
    ) : options.length === 0 ? (
      <div className="p-4 text-center text-sm text-slate-500 dark:text-muted-foreground">
        No asset types available
      </div>
    ) : (
      options.map((type) => (
        <SelectItem
          key={type.value}
          value={type.value}
          className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900"
        >
          {type.label}
        </SelectItem>
      ))
    );

  // ---------- New assets ----------

  const handleAddAsset = () => {
    const defaultType = assetTypes[0]?.value ?? "social_site";
    setNewAssets((prev) => [
      ...prev,
      {
        type: defaultType,
        name: typeLabel(defaultType),
        customName: "",  // User can customize this
        url: "",
        description: "",
        isRequired: true,
        defaultPostingFrequency: 3,
        postingInterval: 1,
        postingStartOffset: 0,
        defaultIdealDurationMinutes: 30,
      },
    ]);
  };

  const handleRemoveAsset = (index: number) => {
    setNewAssets((prev) => prev.filter((_, i) => i !== index));
  };

  // Functional update: several fields can change in one go without a stale copy
  // overwriting the other (this used to reset the selected type).
  const patchAsset = (index: number, patch: Partial<NewAsset>) => {
    setNewAssets((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
    );
  };

  const handleAssetTypeChange = (index: number, value: string) => {
    setNewAssets((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        return {
          ...a,
          type: value,
          // Follow the type unless the user typed their own name
          name: isAutoFilledName(a.name) ? typeLabel(value) : a.name,
        };
      })
    );
  };

  // ---------- Replacements ----------

  /** Prefill a replacement from the asset being replaced (its effective client values). */
  const replacementFromAsset = (asset: any): Replacement => {
    const setting = settingsByAssetId.get(asset.id);
    const cycle = resolvePostingCycle(asset, setting);
    return {
      oldAssetId: asset.id,
      newAssetType: normalizeAssetTypeSlug(asset.type) || asset.type,
      newAssetName: "",
      newAssetUrl: "",
      newAssetDescription: asset.description ?? "",
      isRequired: asset.isRequired ?? true,
      defaultPostingFrequency: getPostingFrequency({
        required: setting?.requiredFrequency,
        defaultFreq: asset.defaultPostingFrequency,
      }),
      postingInterval: cycle.interval,
      postingStartOffset: cycle.offset,
      defaultIdealDurationMinutes:
        setting?.idealDurationMinutes ?? asset.defaultIdealDurationMinutes ?? 30,
    };
  };

  const usedOldAssetIds = new Set(replacements.map((r) => r.oldAssetId));
  const availableToReplace = templateAssets.filter((a) => !usedOldAssetIds.has(a.id));

  const handleAddReplacement = () => {
    const next = availableToReplace[0];
    if (!next) {
      toast.info("Every asset in this template already has a replacement");
      return;
    }
    setReplacements((prev) => [...prev, replacementFromAsset(next)]);
  };

  const handleRemoveReplacement = (index: number) => {
    setReplacements((prev) => prev.filter((_, i) => i !== index));
  };

  const patchReplacement = (index: number, patch: Partial<Replacement>) => {
    setReplacements((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const handleOldAssetChange = (index: number, oldAssetId: number) => {
    const asset = templateAssets.find((a) => a.id === oldAssetId);
    if (!asset) return;
    setReplacements((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...replacementFromAsset(asset),
              // Keep what the user already typed for the new asset
              newAssetName: r.newAssetName,
              newAssetUrl: r.newAssetUrl,
            }
          : r
      )
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (newAssets.length === 0 && replacements.length === 0) {
      toast.error("Please add at least one new asset or replacement");
      return;
    }

    // Validate new assets
    for (const asset of newAssets) {
      if (!asset.type) {
        toast.error("All new assets must have an asset type");
        return;
      }
      if (!asset.name.trim() && !asset.customName.trim()) {
        toast.error("All new assets must have a name");
        return;
      }
    }

    // Validate replacements
    const seen = new Set<number>();
    for (const replacement of replacements) {
      if (seen.has(replacement.oldAssetId)) {
        toast.error("The same asset cannot be replaced more than once");
        return;
      }
      seen.add(replacement.oldAssetId);
      if (!replacement.newAssetName.trim()) {
        toast.error("All replacements must have a new name");
        return;
      }
      if (!replacement.newAssetType) {
        toast.error("All replacements must have an asset type");
        return;
      }
    }

    const newAssetsPayload = newAssets.map((a) => ({
      ...a,
      name: a.name.trim() || a.customName.trim(),
      customName: a.customName.trim(),
      url: a.url.trim(),
      description: a.description.trim(),
    }));

    const replacementsPayload = replacements.map((r) => ({
      ...r,
      newAssetName: r.newAssetName.trim(),
      newAssetUrl: r.newAssetUrl.trim(),
      newAssetDescription: r.newAssetDescription.trim(),
    }));

    setLoading(true);
    try {
      const response = await fetch(
        `/api/assignments/${assignment.id}/customize-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-actor-id": user?.id || "",
          },
          body: JSON.stringify({
            newAssets: newAssetsPayload.length > 0 ? newAssetsPayload : undefined,
            replacements:
              replacementsPayload.length > 0 ? replacementsPayload : undefined,
            customTemplateName: customTemplateName.trim() || undefined,  // Send custom name if provided
            idempotencyKey: `customize-${assignment.id}-${Date.now()}`,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        onSuccess?.();
        setNewAssets([]);
        setReplacements([]);
        setCustomTemplateName("");
      } else {
        toast.error(data.message || "Failed to customize template");
      }
    } catch (error) {
      console.error("Error customizing template:", error);
      toast.error("An error occurred while customizing template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Customize Template
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700">
                  {clientName}
                </Badge>
              </div>
              <p className="text-sm font-normal text-slate-500 mt-1 dark:text-muted-foreground">
                Current Template: <span className="font-semibold">{currentTemplate.name}</span>
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            ✨ Add new assets or replace existing ones to create a personalized template.
            <br />
            💡 Your changes will only affect <span className="font-semibold">{clientName}</span> - other clients remain unchanged.
          </DialogDescription>
        </DialogHeader>

        {/* Custom Template Name Field */}
        <div className="space-y-2 p-4 bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl">
          <Label htmlFor="customTemplateName" className="text-sm font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Custom Template Name
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700">
              Optional
            </Badge>
          </Label>
          <Input
            id="customTemplateName"
            value={customTemplateName}
            onChange={(e) => setCustomTemplateName(e.target.value)}
            placeholder={`${currentTemplate.name} - Custom (${clientName})`}
            className="border-2 border-purple-300 focus:border-purple-500 bg-white dark:bg-slate-800 font-medium dark:border-purple-700"
          />
          <p className="text-xs text-purple-700 dark:text-purple-400 flex items-start gap-1">
            <span>💡</span>
            <span>
              If not provided, a default name will be generated: <span className="font-semibold">"{currentTemplate.name} - Custom ({clientName})"</span>
            </span>
          </p>
        </div>

        <Tabs defaultValue="add" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="add" className="gap-2 data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              <Plus className="h-4 w-4" />
              Add New Assets
            </TabsTrigger>
            <TabsTrigger value="replace" className="gap-2 data-[state=active]:bg-linear-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
              <Sparkles className="h-4 w-4" />
              Replace Assets
            </TabsTrigger>
          </TabsList>

          {/* Add New Assets Tab */}
          <TabsContent value="add" className="space-y-4 mt-4">
            {newAssets.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <Plus className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4 dark:text-muted-foreground">No new assets added yet</p>
                <Button onClick={handleAddAsset} className="gap-2" disabled={loadingAssetTypes}>
                  <Plus className="h-4 w-4" />
                  Add Your First Asset
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {newAssets.map((asset, index) => (
                  <div
                    key={index}
                    className="p-5 border-2 border-blue-200 dark:border-blue-700 rounded-xl space-y-4 bg-linear-to-br from-blue-50 to-indigo-50 dark:bg-linear-to-br dark:from-blue-900/20 dark:to-indigo-900/20 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 px-3 py-1 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">
                          ✨ New Asset #{index + 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-muted">
                          {typeLabel(asset.type)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAsset(index)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          📦 Asset Type *
                        </Label>
                        <Select
                          value={asset.type}
                          onValueChange={(value) => handleAssetTypeChange(index, value)}
                        >
                          <SelectTrigger className="border-2 font-medium" disabled={loadingAssetTypes}>
                            <SelectValue placeholder={loadingAssetTypes ? "Loading types..." : "Select asset type"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[400px] overflow-y-auto">
                            {renderTypeSelectItems(typeOptionsWith(asset.type))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">
                          The asset will be created under <span className="font-semibold">{typeLabel(asset.type)}</span>
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Asset Name *
                          <Badge variant="outline" className="text-xs">
                            Auto-filled
                          </Badge>
                        </Label>
                        <Input
                          value={asset.name}
                          onChange={(e) => patchAsset(index, { name: e.target.value })}
                          placeholder="e.g., Facebook, Instagram"
                          className="bg-slate-100 dark:bg-slate-800"
                        />
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Default template asset name</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          Custom Name
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Optional
                          </Badge>
                        </Label>
                        <Input
                          value={asset.customName}
                          onChange={(e) => patchAsset(index, { customName: e.target.value })}
                          placeholder="Enter your custom name (e.g., My Company Facebook Page)"
                          className="border-blue-300 focus:border-blue-500 dark:border-blue-700"
                        />
                        <p className="text-xs text-blue-600 dark:text-blue-400">💡 If provided, this custom name will be used instead of the default</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          🔗 URL
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Input
                          value={asset.url}
                          onChange={(e) => patchAsset(index, { url: e.target.value })}
                          placeholder="https://example.com/your-asset"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Link to the asset (if applicable)</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          📝 Description
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Textarea
                          value={asset.description}
                          onChange={(e) => patchAsset(index, { description: e.target.value })}
                          placeholder="Add any notes or special instructions for this asset..."
                          rows={2}
                          className="resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          🗓️ Posting Frequency (per month)
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            {asset.defaultPostingFrequency}x
                          </Badge>
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            value={asset.defaultPostingFrequency}
                            onChange={(e) =>
                              patchAsset(index, {
                                defaultPostingFrequency: parseFrequency(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-slate-600 dark:text-muted-foreground">tasks/month</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          🔁 Posting Cycle
                        </Label>
                        <PostingCycleSelect
                          interval={asset.postingInterval}
                          offset={asset.postingStartOffset}
                          disabled={asset.defaultPostingFrequency <= 0}
                          onChange={(interval, offset) =>
                            patchAsset(index, {
                              postingInterval: interval,
                              postingStartOffset: offset,
                            })
                          }
                        />
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Which months the posting tasks run</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          ⏱️ Duration (minutes)
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            {asset.defaultIdealDurationMinutes}min
                          </Badge>
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="5"
                            max="480"
                            step="5"
                            value={asset.defaultIdealDurationMinutes}
                            onChange={(e) =>
                              patchAsset(index, {
                                defaultIdealDurationMinutes: parseDuration(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-slate-600 dark:text-muted-foreground">minutes</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Estimated time to complete each task</p>
                      </div>

                      <div className="flex items-center space-x-2 col-span-2">
                        <Checkbox
                          id={`required-${index}`}
                          checked={asset.isRequired}
                          onCheckedChange={(checked) =>
                            patchAsset(index, { isRequired: checked === true })
                          }
                        />
                        <Label htmlFor={`required-${index}`} className="cursor-pointer">
                          This asset is required
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}

                <Button onClick={handleAddAsset} variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Asset
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Replace Assets Tab */}
          <TabsContent value="replace" className="space-y-4 mt-4">
            {templateAssets.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-muted-foreground">No assets available to replace</p>
              </div>
            ) : replacements.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <Plus className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4 dark:text-muted-foreground">No replacements added yet</p>
                <Button onClick={handleAddReplacement} className="gap-2" disabled={loadingAssetTypes}>
                  <Plus className="h-4 w-4" />
                  Add Your First Replacement
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {replacements.map((replacement, index) => {
                  const oldAsset = templateAssets.find(
                    (a: any) => a.id === replacement.oldAssetId
                  );
                  const oldSetting = oldAsset ? settingsByAssetId.get(oldAsset.id) : null;
                  const oldFreq = oldAsset
                    ? getPostingFrequency({
                        required: oldSetting?.requiredFrequency,
                        defaultFreq: oldAsset.defaultPostingFrequency,
                      })
                    : 0;
                  const oldCycle = oldAsset ? resolvePostingCycle(oldAsset, oldSetting) : null;
                  // The asset picked here plus everything not picked elsewhere
                  const selectableOldAssets = templateAssets.filter(
                    (a: any) =>
                      a.id === replacement.oldAssetId || !usedOldAssetIds.has(a.id)
                  );

                  return (
                  <div
                    key={index}
                    className="p-5 border-2 border-amber-200 dark:border-amber-700 rounded-xl space-y-4 bg-linear-to-br from-amber-50 to-orange-50 dark:bg-linear-to-br dark:from-amber-900/20 dark:to-orange-900/20 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 px-3 py-1 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                          🔄 Replacement #{index + 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-muted">
                          {typeLabel(replacement.newAssetType)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveReplacement(index)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Old -> New preview */}
                    {oldAsset && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs dark:border-amber-800 dark:bg-slate-900/40">
                        <span className="text-slate-500 dark:text-muted-foreground">Current:</span>
                        <span className="font-semibold line-through decoration-red-400">{oldAsset.name}</span>
                        <span className="text-slate-500 dark:text-muted-foreground">
                          ({typeLabel(oldAsset.type)} · {oldFreq}x/month · {postingCycleLabel(oldCycle)})
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          {replacement.newAssetName.trim() || "New asset"}
                        </span>
                        <span className="text-slate-500 dark:text-muted-foreground">
                          ({typeLabel(replacement.newAssetType)} · {replacement.defaultPostingFrequency}x/month ·{" "}
                          {postingCycleLabel({
                            interval: replacement.postingInterval,
                            offset: replacement.postingStartOffset,
                          })})
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          🎯 Replace Asset *
                        </Label>
                        <Select
                          value={String(replacement.oldAssetId)}
                          onValueChange={(value) => handleOldAssetChange(index, Number(value))}
                        >
                          <SelectTrigger className="border-2 font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[400px] overflow-y-auto">
                            {selectableOldAssets.map((a: any) => (
                              <SelectItem key={a.id} value={String(a.id)}>
                                {a.name} ({typeLabel(a.type)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">The existing asset to replace</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          📦 New Asset Type *
                        </Label>
                        <Select
                          value={replacement.newAssetType}
                          onValueChange={(value) =>
                            patchReplacement(index, { newAssetType: value })
                          }
                        >
                          <SelectTrigger className="border-2 font-medium" disabled={loadingAssetTypes}>
                            <SelectValue placeholder={loadingAssetTypes ? "Loading types..." : "Select asset type"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[400px] overflow-y-auto">
                            {renderTypeSelectItems(typeOptionsWith(replacement.newAssetType))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">
                          The new asset will be under <span className="font-semibold">{typeLabel(replacement.newAssetType)}</span>
                        </p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>New Asset Name *</Label>
                        <Input
                          value={replacement.newAssetName}
                          onChange={(e) =>
                            patchReplacement(index, { newAssetName: e.target.value })
                          }
                          placeholder={oldAsset ? `Replaces "${oldAsset.name}" (e.g., Instagram)` : "New asset name"}
                          className="border-amber-300 focus:border-amber-500 dark:border-amber-700"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          🔗 New Asset URL
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Input
                          value={replacement.newAssetUrl}
                          onChange={(e) =>
                            patchReplacement(index, { newAssetUrl: e.target.value })
                          }
                          placeholder="https://..."
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Leave empty if the new asset has no URL yet</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          📝 Description
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Textarea
                          value={replacement.newAssetDescription}
                          onChange={(e) =>
                            patchReplacement(index, { newAssetDescription: e.target.value })
                          }
                          placeholder="Add any notes or special instructions for this asset..."
                          rows={2}
                          className="resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          🗓️ Posting Frequency (per month)
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            {replacement.defaultPostingFrequency}x
                          </Badge>
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            value={replacement.defaultPostingFrequency}
                            onChange={(e) =>
                              patchReplacement(index, {
                                defaultPostingFrequency: parseFrequency(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-slate-600 dark:text-muted-foreground">tasks/month</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          🔁 Posting Cycle
                        </Label>
                        <PostingCycleSelect
                          interval={replacement.postingInterval}
                          offset={replacement.postingStartOffset}
                          disabled={replacement.defaultPostingFrequency <= 0}
                          onChange={(interval, offset) =>
                            patchReplacement(index, {
                              postingInterval: interval,
                              postingStartOffset: offset,
                            })
                          }
                        />
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Which months the posting tasks run</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          ⏱️ Duration (minutes)
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            {replacement.defaultIdealDurationMinutes}min
                          </Badge>
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="5"
                            max="480"
                            step="5"
                            value={replacement.defaultIdealDurationMinutes}
                            onChange={(e) =>
                              patchReplacement(index, {
                                defaultIdealDurationMinutes: parseDuration(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-slate-600 dark:text-muted-foreground">minutes</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">Estimated time to complete each task</p>
                      </div>

                      <div className="flex items-center space-x-2 col-span-2">
                        <Checkbox
                          id={`replacement-required-${index}`}
                          checked={replacement.isRequired}
                          onCheckedChange={(checked) =>
                            patchReplacement(index, { isRequired: checked === true })
                          }
                        />
                        <Label htmlFor={`replacement-required-${index}`} className="cursor-pointer">
                          This asset is required
                        </Label>
                      </div>
                    </div>
                  </div>
                );
                })}

                <Button
                  onClick={handleAddReplacement}
                  variant="outline"
                  className="w-full gap-2"
                  disabled={availableToReplace.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  {availableToReplace.length === 0
                    ? "All assets already have a replacement"
                    : "Add Another Replacement"}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {(newAssets.length > 0 || replacements.length > 0) && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-blue-900 dark:text-blue-300">
                Changes Summary
              </h4>
            </div>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {customTemplateName.trim() && (
                <p>• Custom template name: <span className="font-semibold">"{customTemplateName}"</span></p>
              )}
              {newAssets.map((a, i) => (
                <p key={`add-${i}`}>
                  • Add <span className="font-semibold">{a.customName.trim() || a.name || "New asset"}</span> under{" "}
                  <span className="font-semibold">{typeLabel(a.type)}</span> ({a.defaultPostingFrequency}x/month ·{" "}
                  {postingCycleLabel({ interval: a.postingInterval, offset: a.postingStartOffset })})
                </p>
              ))}
              {replacements.map((r, i) => {
                const oldAsset = templateAssets.find((a: any) => a.id === r.oldAssetId);
                return (
                  <p key={`rep-${i}`}>
                    • Replace <span className="font-semibold">{oldAsset?.name ?? "asset"}</span> with{" "}
                    <span className="font-semibold">{r.newAssetName.trim() || "(name required)"}</span> under{" "}
                    <span className="font-semibold">{typeLabel(r.newAssetType)}</span> ({r.defaultPostingFrequency}x/month ·{" "}
                    {postingCycleLabel({ interval: r.postingInterval, offset: r.postingStartOffset })})
                  </p>
                );
              })}
              <p>• Will create a custom template for this client</p>
              {replacements.length > 0 && (
                <p>• Replaced assets will have pending status and be immediately assignable</p>
              )}
              <p>• Other clients using the same template will not be affected</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (newAssets.length === 0 && replacements.length === 0)}
            className="gap-2 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Customizing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Apply Customization
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
