//components/task-distribution/CreateNewTask.tsx
"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  ListTodo,
  AlertCircle,
  CheckCircle,
  Loader,
  CalendarDays,
  Check,
  X,
  ChevronDown,
  Globe,
} from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { formatAssetTypeLabel } from "@/lib/asset-types"

interface ValidationErrors {
  cycleCount?: string
  dueDate?: string
  siteAssetTypes?: string
}

interface CreateNewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  clientId: string
}

const CATEGORY_BY_ASSET: Record<string, string> = {
  social_site: "Social Activity",
  web2_site: "Blog Posting",
  other_asset: "Social Activity",
};

type AssetTypeOption = {
  value: string
  label: string
  categoryName?: string | null
}

type SiteAsset = {
  id: number
  name: string
  url: string | null
  type: string
  eligible: boolean
}

const FALLBACK_ASSET_TYPES: AssetTypeOption[] = [
  { value: "social_site", label: "Social Site", categoryName: "Social Activity" },
  { value: "web2_site", label: "Web2 Site", categoryName: "Blog Posting" },
  { value: "other_asset", label: "Other Asset", categoryName: "Social Activity" },
]

export function CreateNewTaskModal({ isOpen, onClose, onSuccess, clientId }: CreateNewTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>(FALLBACK_ASSET_TYPES)
  const [siteAssets, setSiteAssets] = useState<SiteAsset[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([])
  const [expandedTypes, setExpandedTypes] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) return
    const fetchAssetTypes = async () => {
      try {
        const res = await fetch("/api/asset-types")
        const data = await res.json()
        const types: AssetTypeOption[] = Array.isArray(data?.assetTypes)
          ? data.assetTypes.map((t: any) => ({
              value: t.slug,
              label: t.label || formatAssetTypeLabel(t.slug),
              categoryName: t.categoryName ?? null,
            }))
          : []
        if (types.length) setAssetTypes(types)
      } catch (error) {
        console.error("Failed to fetch asset types:", error)
      }
    }
    const fetchSiteAssets = async () => {
      if (!clientId) return
      try {
        setSitesLoading(true)
        const res = await fetch(`/api/createnewtasks?clientId=${encodeURIComponent(clientId)}`)
        const data = await res.json()
        setSiteAssets(Array.isArray(data?.assets) ? data.assets : [])
      } catch (error) {
        console.error("Failed to fetch site assets:", error)
        setSiteAssets([])
      } finally {
        setSitesLoading(false)
      }
    }
    fetchAssetTypes()
    fetchSiteAssets()
  }, [isOpen, clientId])

  // Sub-sites grouped by asset type (category)
  const sitesByType = useMemo(() => {
    const map = new Map<string, SiteAsset[]>()
    for (const asset of siteAssets) {
      const list = map.get(asset.type) ?? []
      list.push(asset)
      map.set(asset.type, list)
    }
    return map
  }, [siteAssets])

  const selectedSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds])

  const eligibleIdsOf = (type: string) =>
    (sitesByType.get(type) ?? []).filter((s) => s.eligible).map((s) => s.id)

  const clearSiteError = () => {
    if (validationErrors.siteAssetTypes) {
      setValidationErrors((prev) => ({ ...prev, siteAssetTypes: undefined }))
    }
  }

  const validateForm = (formData: FormData): boolean => {
    const errors: ValidationErrors = {}
    const cycleCountRaw = formData.get("cycleCount") as string
    const dueDate = formData.get("dueDate") as string

    const cycleCount = parseInt(cycleCountRaw)

    if (!cycleCountRaw?.trim()) {
      errors.cycleCount = "Number of cycles is required"
    } else if (isNaN(cycleCount) || cycleCount < 1 || cycleCount > 100) {
      errors.cycleCount = "Number of cycles must be between 1 and 100"
    }

    if (!dueDate?.trim()) {
      errors.dueDate = "Due date is required"
    } else {
      const selectedDate = new Date(dueDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (selectedDate < today) {
        errors.dueDate = "Due date cannot be in the past"
      }
    }

    if (selectedAssetIds.length === 0) {
      errors.siteAssetTypes = "Please select at least one site"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    if (!validateForm(formData)) {
      toast.error("Please fix the validation errors", {
        description: "Check the form fields and try again",
        icon: <AlertCircle className="h-4 w-4" />,
      })
      return
    }

    const cycleCount = parseInt(formData.get("cycleCount") as string)
    const dueDate = formData.get("dueDate") as string
    const selectedTypes = Array.from(
      new Set(siteAssets.filter((s) => selectedSet.has(s.id)).map((s) => s.type))
    )

    try {
      setLoading(true)

      const res = await fetch("/api/createnewtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          cycleCount,
          dueDate,
          siteAssetTypes: selectedTypes,
          templateSiteAssetIds: selectedAssetIds,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json) {
        throw new Error(json.message || "Unknown error occurred")
      }

      toast.success("Posting tasks created successfully!", {
        description: `${json.created} manual posting task(s) created`,
        icon: <CheckCircle className="h-4 w-4" />,
      })

      form.reset()
      setSelectedAssetIds([])
      setValidationErrors({})
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error("Failed to create tasks", {
        description: error.message || "Unexpected error",
        icon: <AlertCircle className="h-4 w-4" />,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string) => {
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSelectAll = () => {
    setSelectedAssetIds(siteAssets.filter((s) => s.eligible).map((s) => s.id))
    clearSiteError()
  }

  const handleClearAll = () => {
    setSelectedAssetIds([])
  }

  // Toggle every eligible sub-site of a category
  const handleTypeToggle = (type: string, checked: boolean) => {
    const ids = eligibleIdsOf(type)
    setSelectedAssetIds((prev) => {
      const rest = prev.filter((id) => !ids.includes(id))
      return checked ? [...rest, ...ids] : rest
    })
    clearSiteError()
  }

  const handleSiteToggle = (id: number, checked: boolean) => {
    setSelectedAssetIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    )
    clearSiteError()
  }

  const toggleExpanded = (type: string) => {
    setExpandedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  useEffect(() => {
    if (!isOpen) {
      setSelectedAssetIds([])
      setExpandedTypes([])
      setValidationErrors({})
    }
  }, [isOpen])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl gap-0 p-0 overflow-hidden [&>button:last-child]:text-white [&>button:last-child]:opacity-90"
      >
        <div className="shrink-0 bg-linear-to-r from-sky-600 to-cyan-600 px-4 py-5 sm:px-6 text-white">
          <SheetHeader className="p-0 pr-8">
            <SheetTitle className="text-lg sm:text-2xl font-bold flex items-center gap-3 text-white">
              <div className="p-2 bg-white/20 rounded-lg shrink-0">
                <ListTodo className="h-5 w-5" />
              </div>
              <span className="truncate">Create Posting Tasks Manually</span>
            </SheetTitle>
            <SheetDescription className="text-white/80 pt-1 text-xs sm:text-sm">
              Social Site &amp; Other Asset -&gt; Social Activity | Web2 Site -&gt; Blog Posting
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="shrink-0 px-4 sm:px-6 pt-4">
          <div className="p-4 bg-linear-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl border border-sky-200 dark:border-sky-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <ListTodo className="w-5 h-5 text-sky-600" />
                </div>
                <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                  Total Posting Tasks
                </span>
              </div>
              <span className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                {selectedAssetIds.length}
              </span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4">
          <form id="create-task-form" onSubmit={handleSubmit} className="space-y-6 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Select a category to include all of its sites, or expand it to pick specific sites. One task is created per selected site.
            </p>
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-sm font-medium">Due Date *</Label>
              <div className="relative">
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  className={cn(
                    "h-10 pl-3 pr-10",
                    validationErrors.dueDate && "border-destructive"
                  )}
                  onChange={() => handleInputChange("dueDate")}
                />
                <CalendarDays className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              {validationErrors.dueDate && (
                <ErrorText text={validationErrors.dueDate} />
              )}
            </div>

            {/* Hidden input for cycleCount */}
            <input type="hidden" name="cycleCount" value="1" />

            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={sitesLoading}
                  className="text-xs h-8 gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs h-8 gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear All
                </Button>
              </div>

              {sitesLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader className="h-4 w-4 animate-spin" />
                  Loading sites...
                </div>
              ) : (
                <div className="space-y-2">
                  {assetTypes.map((type) => {
                    const sites = sitesByType.get(type.value) ?? []
                    const eligibleIds = sites.filter((s) => s.eligible).map((s) => s.id)
                    const selectedCount = eligibleIds.filter((id) => selectedSet.has(id)).length
                    const allSelected = eligibleIds.length > 0 && selectedCount === eligibleIds.length
                    const someSelected = selectedCount > 0 && !allSelected
                    const isExpanded = expandedTypes.includes(type.value)
                    const disabled = eligibleIds.length === 0

                    return (
                      <div
                        key={type.value}
                        className={cn(
                          "rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-200",
                          !disabled && "hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md",
                          selectedCount > 0 && "border-sky-300 dark:border-sky-700"
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(type.value)}
                            disabled={sites.length === 0}
                            aria-label={isExpanded ? "Collapse sites" : "Expand sites"}
                            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => sites.length > 0 && toggleExpanded(type.value)}
                            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            <span className="max-w-full truncate" title={type.label}>{type.label}</span>
                            <span
                              className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                              title={type.categoryName || CATEGORY_BY_ASSET[type.value] || "Other Task"}
                            >
                              <ListTodo className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {type.categoryName || CATEGORY_BY_ASSET[type.value] || "Other Task"}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-normal text-muted-foreground">
                              {sites.length === 0
                                ? "No sites"
                                : `${selectedCount}/${eligibleIds.length} sites`}
                            </span>
                          </button>
                          <Checkbox
                            id={`asset-${type.value}`}
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              handleTypeToggle(type.value, checked === true)
                            }
                            className="h-5 w-5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary/40 data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary/40"
                          />
                        </div>

                        {isExpanded && sites.length > 0 && (
                          <div className="border-t border-slate-100 dark:border-gray-700 px-2 sm:px-4 py-2 space-y-1">
                            {sites.map((site) => (
                              <label
                                key={site.id}
                                htmlFor={`site-${site.id}`}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                                  site.eligible
                                    ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50"
                                    : "cursor-not-allowed opacity-50"
                                )}
                              >
                                <Checkbox
                                  id={`site-${site.id}`}
                                  checked={selectedSet.has(site.id)}
                                  disabled={!site.eligible}
                                  onCheckedChange={(checked) =>
                                    handleSiteToggle(site.id, checked === true)
                                  }
                                  className="h-4 w-4 rounded"
                                />
                                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className="block truncate font-medium text-gray-700 dark:text-gray-300"
                                    title={site.name}
                                  >
                                    {site.name}
                                  </span>
                                  {site.url && (
                                    <span className="block truncate text-xs text-muted-foreground" title={site.url}>
                                      {site.url}
                                    </span>
                                  )}
                                </span>
                                {!site.eligible && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    0 frequency
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {validationErrors.siteAssetTypes && (
                <div className="mt-3">
                  <ErrorText text={validationErrors.siteAssetTypes} />
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="shrink-0 border-t bg-muted/30 px-4 sm:px-6 py-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 sm:flex-none sm:min-w-[100px] h-11 font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            disabled={loading || selectedAssetIds.length === 0}
            className="flex-1 sm:flex-none sm:min-w-[140px] h-11 font-semibold bg-linear-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 gap-2"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <ListTodo className="h-5 w-5" />
                Create Tasks
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Reusable error component
function ErrorText({ text }: { text: string }) {
  return (
    <p className="text-sm text-destructive flex items-center gap-1.5 mt-1.5 font-medium">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </p>
  )
}
