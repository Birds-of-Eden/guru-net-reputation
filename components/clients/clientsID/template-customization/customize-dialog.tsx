// components/clients/clientsID/template-customization/customize-dialog.tsx
//lint error fixed
"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader,
  ArrowRight,
  ArrowLeftRight,
  ChevronDown,
  Info,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

/** Normalized field values shared by "new asset" and "replacement" cards. */
interface AssetFieldValues {
  type: string;
  name: string;
  url: string;
  description: string;
  isRequired: boolean;
  frequency: number;
  interval: number;
  offset: number;
  duration: number;
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground">
      {children}
      {hint && <span className="ml-1 font-normal opacity-70">({hint})</span>}
    </Label>
  );
}

/** Compact form body used by both cards: type/name, schedule, and collapsible extras. */
function AssetFields({
  idPrefix,
  values,
  onChange,
  typeSelect,
  namePlaceholder,
}: {
  idPrefix: string;
  values: AssetFieldValues;
  onChange: (patch: Partial<AssetFieldValues>) => void;
  typeSelect: ReactNode;
  namePlaceholder: string;
}) {
  const [showMore, setShowMore] = useState(
    Boolean(values.url || values.description)
  );

  return (
    <div className="space-y-4">
      {/* Type + name */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel>Asset type</FieldLabel>
          {typeSelect}
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Name</FieldLabel>
          <Input
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={namePlaceholder}
          />
        </div>
      </div>

      {/* Schedule */}
      <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <FieldLabel>Posts / month</FieldLabel>
          <Input
            type="number"
            min="0"
            max="30"
            value={values.frequency}
            onChange={(e) => onChange({ frequency: parseFrequency(e.target.value) })}
            className="bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Posting cycle</FieldLabel>
          <PostingCycleSelect
            interval={values.interval}
            offset={values.offset}
            disabled={values.frequency <= 0}
            onChange={(interval, offset) => onChange({ interval, offset })}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Minutes / task</FieldLabel>
          <Input
            type="number"
            min="5"
            max="480"
            step="5"
            value={values.duration}
            onChange={(e) => onChange({ duration: parseDuration(e.target.value) })}
            className="bg-background"
          />
        </div>
      </div>

      {/* Required + more details toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id={`${idPrefix}-required`}
            checked={values.isRequired}
            onCheckedChange={(checked) => onChange({ isRequired: checked })}
          />
          <Label htmlFor={`${idPrefix}-required`} className="cursor-pointer text-sm">
            Required asset
          </Label>
        </div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showMore ? "Hide" : "Add"} URL &amp; notes
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")}
          />
        </button>
      </div>

      {showMore && (
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <FieldLabel hint="optional">URL</FieldLabel>
            <Input
              value={values.url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel hint="optional">Notes</FieldLabel>
            <Textarea
              value={values.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Instructions for whoever works on this asset"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

const newAssetToFields = (a: NewAsset): AssetFieldValues => ({
  type: a.type,
  name: a.name,
  url: a.url,
  description: a.description,
  isRequired: a.isRequired,
  frequency: a.defaultPostingFrequency,
  interval: a.postingInterval,
  offset: a.postingStartOffset,
  duration: a.defaultIdealDurationMinutes,
});

const replacementToFields = (r: Replacement): AssetFieldValues => ({
  type: r.newAssetType,
  name: r.newAssetName,
  url: r.newAssetUrl,
  description: r.newAssetDescription,
  isRequired: r.isRequired,
  frequency: r.defaultPostingFrequency,
  interval: r.postingInterval,
  offset: r.postingStartOffset,
  duration: r.defaultIdealDurationMinutes,
});

/** Maps a field patch back onto NewAsset / Replacement keys. */
const fieldsPatchTo = <T,>(
  patch: Partial<AssetFieldValues>,
  keys: Record<keyof AssetFieldValues, keyof T>
): Partial<T> => {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch)) {
    (out as any)[keys[k as keyof AssetFieldValues]] = v;
  }
  return out;
};

const NEW_ASSET_KEYS: Record<keyof AssetFieldValues, keyof NewAsset> = {
  type: "type",
  name: "name",
  url: "url",
  description: "description",
  isRequired: "isRequired",
  frequency: "defaultPostingFrequency",
  interval: "postingInterval",
  offset: "postingStartOffset",
  duration: "defaultIdealDurationMinutes",
};

const REPLACEMENT_KEYS: Record<keyof AssetFieldValues, keyof Replacement> = {
  type: "newAssetType",
  name: "newAssetName",
  url: "newAssetUrl",
  description: "newAssetDescription",
  isRequired: "isRequired",
  frequency: "defaultPostingFrequency",
  interval: "postingInterval",
  offset: "postingStartOffset",
  duration: "defaultIdealDurationMinutes",
};

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

  const totalChanges = newAssets.length + replacements.length;
  const defaultTemplateName = `${currentTemplate.name} - Custom (${clientName})`;

  const typeSelect = (value: string, onValueChange: (v: string) => void) => (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full" disabled={loadingAssetTypes}>
        <SelectValue placeholder={loadingAssetTypes ? "Loading types..." : "Select type"} />
      </SelectTrigger>
      <SelectContent className="max-h-[400px] overflow-y-auto">
        {renderTypeSelectItems(typeOptionsWith(value))}
      </SelectContent>
    </Select>
  );

  const emptyState = (
    icon: ReactNode,
    title: string,
    text: string,
    action?: ReactNode
  ) => (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 mb-4 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );

  const removeButton = (onClick: () => void, label: string) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {/* Header */}
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Customize template
          </DialogTitle>
          <DialogDescription>
            Based on <span className="font-medium text-foreground">{currentTemplate.name}</span>.
            Changes apply only to{" "}
            <span className="font-medium text-foreground">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="customTemplateName" className="text-sm font-medium">
              Template name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="customTemplateName"
              value={customTemplateName}
              onChange={(e) => setCustomTemplateName(e.target.value)}
              placeholder={defaultTemplateName}
            />
            <p className="text-xs text-muted-foreground">Leave empty to use the name shown.</p>
          </div>

          <Tabs defaultValue="add">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add" className="gap-2">
                <Plus className="h-4 w-4" />
                Add assets
                {newAssets.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{newAssets.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="replace" className="gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Replace assets
                {replacements.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{replacements.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Add */}
            <TabsContent value="add" className="mt-4 space-y-3">
              {newAssets.length === 0 ? (
                emptyState(
                  <Plus className="h-5 w-5" />,
                  "No new assets yet",
                  "Add an asset to this client's template, such as a new social profile.",
                  <Button onClick={handleAddAsset} disabled={loadingAssetTypes} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add asset
                  </Button>
                )
              ) : (
                <>
                  {newAssets.map((asset, index) => (
                    <div key={index} className="rounded-xl border bg-card p-4 shadow-xs">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          New asset {newAssets.length > 1 && <span className="text-muted-foreground">#{index + 1}</span>}
                        </p>
                        {removeButton(() => handleRemoveAsset(index), "Remove asset")}
                      </div>
                      <AssetFields
                        idPrefix={`new-${index}`}
                        values={newAssetToFields(asset)}
                        onChange={(patch) => patchAsset(index, fieldsPatchTo<NewAsset>(patch, NEW_ASSET_KEYS))}
                        typeSelect={typeSelect(asset.type, (v) => handleAssetTypeChange(index, v))}
                        namePlaceholder="e.g. Company Facebook Page"
                      />
                    </div>
                  ))}
                  <Button onClick={handleAddAsset} variant="outline" className="w-full gap-2 border-dashed">
                    <Plus className="h-4 w-4" />
                    Add another asset
                  </Button>
                </>
              )}
            </TabsContent>

            {/* Replace */}
            <TabsContent value="replace" className="mt-4 space-y-3">
              {templateAssets.length === 0 ? (
                emptyState(
                  <Info className="h-5 w-5" />,
                  "Nothing to replace",
                  "This template has no assets yet."
                )
              ) : replacements.length === 0 ? (
                emptyState(
                  <ArrowLeftRight className="h-5 w-5" />,
                  "No replacements yet",
                  "Swap an existing template asset for a different one. Its schedule is copied over so you only change what's needed.",
                  <Button onClick={handleAddReplacement} disabled={loadingAssetTypes} className="gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Replace an asset
                  </Button>
                )
              ) : (
                <>
                  {replacements.map((replacement, index) => {
                    const oldAsset = templateAssets.find((a: any) => a.id === replacement.oldAssetId);
                    const oldSetting = oldAsset ? settingsByAssetId.get(oldAsset.id) : null;
                    const oldFreq = oldAsset
                      ? getPostingFrequency({
                          required: oldSetting?.requiredFrequency,
                          defaultFreq: oldAsset.defaultPostingFrequency,
                        })
                      : 0;
                    const oldCycle = oldAsset ? resolvePostingCycle(oldAsset, oldSetting) : null;
                    const selectableOldAssets = templateAssets.filter(
                      (a: any) => a.id === replacement.oldAssetId || !usedOldAssetIds.has(a.id)
                    );

                    return (
                      <div key={index} className="rounded-xl border bg-card p-4 shadow-xs">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            Replacement {replacements.length > 1 && <span className="text-muted-foreground">#{index + 1}</span>}
                          </p>
                          {removeButton(() => handleRemoveReplacement(index), "Remove replacement")}
                        </div>

                        {/* Which asset is being replaced */}
                        <div className="mb-4 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                          <FieldLabel>Replacing</FieldLabel>
                          <Select
                            value={String(replacement.oldAssetId)}
                            onValueChange={(value) => handleOldAssetChange(index, Number(value))}
                          >
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[400px] overflow-y-auto">
                              {selectableOldAssets.map((a: any) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {a.name} · {typeLabel(a.type)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {oldAsset && (
                            <p className="text-xs text-muted-foreground">
                              Currently {oldFreq}x/month · {postingCycleLabel(oldCycle)}
                            </p>
                          )}
                        </div>

                        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5" />
                          With
                        </p>
                        <AssetFields
                          idPrefix={`rep-${index}`}
                          values={replacementToFields(replacement)}
                          onChange={(patch) =>
                            patchReplacement(index, fieldsPatchTo<Replacement>(patch, REPLACEMENT_KEYS))
                          }
                          typeSelect={typeSelect(replacement.newAssetType, (v) =>
                            patchReplacement(index, { newAssetType: v })
                          )}
                          namePlaceholder={oldAsset ? `Replaces "${oldAsset.name}"` : "New asset name"}
                        />
                      </div>
                    );
                  })}
                  <Button
                    onClick={handleAddReplacement}
                    variant="outline"
                    className="w-full gap-2 border-dashed"
                    disabled={availableToReplace.length === 0}
                  >
                    <Plus className="h-4 w-4" />
                    {availableToReplace.length === 0
                      ? "Every asset already has a replacement"
                      : "Replace another asset"}
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Review */}
          {totalChanges > 0 && (
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="mb-2 text-sm font-semibold">Review changes</p>
              <ul className="space-y-1.5 text-sm">
                {newAssets.map((a, i) => (
                  <li key={`add-${i}`} className="flex items-start gap-2">
                    <Badge className="mt-0.5 h-5 bg-emerald-100 px-1.5 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Add
                    </Badge>
                    <span>
                      <span className="font-medium">{a.customName.trim() || a.name.trim() || "Untitled asset"}</span>
                      <span className="text-muted-foreground">
                        {" "}· {typeLabel(a.type)} · {a.defaultPostingFrequency}x/month
                      </span>
                    </span>
                  </li>
                ))}
                {replacements.map((r, i) => {
                  const oldAsset = templateAssets.find((a: any) => a.id === r.oldAssetId);
                  return (
                    <li key={`rep-${i}`} className="flex items-start gap-2">
                      <Badge className="mt-0.5 h-5 bg-amber-100 px-1.5 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300">
                        Swap
                      </Badge>
                      <span>
                        <span className="text-muted-foreground line-through">{oldAsset?.name ?? "asset"}</span>
                        {" → "}
                        <span className={cn("font-medium", !r.newAssetName.trim() && "text-red-600 dark:text-red-400")}>
                          {r.newAssetName.trim() || "name required"}
                        </span>
                        <span className="text-muted-foreground"> · {r.defaultPostingFrequency}x/month</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Saves as <span className="font-medium">{customTemplateName.trim() || defaultTemplateName}</span>.
                Other clients on this template are not affected.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t bg-muted/30 px-6 py-3 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {totalChanges === 0
              ? "No changes yet"
              : `${totalChanges} change${totalChanges === 1 ? "" : "s"}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || totalChanges === 0} className="gap-2">
              {loading && <Loader className="h-4 w-4 animate-spin" />}
              {loading ? "Saving..." : "Apply changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
