// @ts-nocheck
//components/TemplateViewModal.tsx

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash, Save, Edit, X, Share2, Globe, FileText } from "lucide-react"
import { formatAssetTypeLabel, normalizeAssetTypeSlug } from "@/lib/asset-types"
import type { AssetTypeOption } from "@/types/asset-types"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AssetTypeSlug = string

interface TemplateAsset {
  id: number
  type: AssetTypeSlug
  name: string
  url?: string
  description?: string
  isRequired: boolean
  defaultPostingFrequency?: number
  defaultIdealDurationMinutes?: number
}

interface Template {
  id: string
  name: string
  description?: string
  packageId?: string
  status?: string
  sitesAssets: TemplateAsset[]
}

interface TemplateViewModalProps {
  templateId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TemplateViewModal({ templateId, open, onOpenChange, onSuccess }: TemplateViewModalProps) {
  const [template, setTemplate] = useState<
    | (Omit<Template, "sitesAssets"> & {
      sitesAssets: (TemplateAsset | Omit<TemplateAsset, "id">)[]
    })
    | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newAsset, setNewAsset] = useState({
    type: "social_site" as AssetTypeSlug,
    name: "",
    url: "",
    description: "",
    isRequired: true,
    defaultPostingFrequency: undefined as number | undefined,
    defaultIdealDurationMinutes: undefined as number | undefined,
  })
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])

  useEffect(() => {
    if (open && templateId) {
      fetchTemplate()
    } else {
      setTemplate(null)
      setEditing(false)
    }
  }, [open, templateId])

  useEffect(() => {
    if (!open) return
    const fetchAssetTypes = async () => {
      try {
        const res = await fetch("/api/asset-types")
        const data = await res.json()
        setAssetTypes(Array.isArray(data?.assetTypes) ? data.assetTypes : [])
      } catch (error) {
        console.error("Error fetching asset types:", error)
      }
    }
    fetchAssetTypes()
  }, [open])

  const fetchTemplate = async () => {
    if (!templateId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/templates/${templateId}`)
      const data = await response.json()
      setTemplate(data)
    } catch (error) {
      console.error("Error fetching template:", error)
      toast.error("Failed to load template")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!template) return
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          packageId: template.packageId,
          status: template.status,
          sitesAssets: template.sitesAssets,
        }),
      })
      const updatedTemplate = await response.json()
      setTemplate(updatedTemplate)
      setEditing(false)
      toast.success("Template updated successfully")
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating template:", error)
      toast.error("Failed to update template")
    }
  }

  const handleAddAsset = () => {
    if (!newAsset.name || !template) return
    setTemplate({
      ...template,
      sitesAssets: [...template.sitesAssets, newAsset],
    })
    setNewAsset({
      type: "social_site",
      name: "",
      url: "",
      description: "",
      isRequired: true,
      defaultPostingFrequency: undefined,
      defaultIdealDurationMinutes: undefined,
    })
    toast.success("Asset added. Click Save to confirm.")
  }

  const handleDeleteAsset = (assetId: number) => {
    if (!confirm("Are you sure you want to delete this asset?")) return
    if (!template) return
    setTemplate({
      ...template,
      sitesAssets: template.sitesAssets.filter((asset) => ("id" in asset ? asset.id !== assetId : false)),
    })
    toast.success("Asset marked for deletion. Click Save to confirm.")
  }

  const handleCancel = () => {
    setEditing(false)
    fetchTemplate()
  }

  const typeLabelBySlug = assetTypes.reduce<Record<string, string>>((acc, t) => {
    acc[t.slug] = t.label
    return acc
  }, {})

  const resolveTypeLabel = (type: string) =>
    typeLabelBySlug[type] ?? formatAssetTypeLabel(type)

  // Group assets by type
  const groupedAssets =
    template?.sitesAssets.reduce(
      (acc, asset) => {
        const key = normalizeAssetTypeSlug(asset.type)
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(asset)
        return acc
      },
      {} as Record<string, typeof template.sitesAssets>,
    ) || {}

  // Asset type configurations
  const assetTypeConfig: Record<string, { label: string; icon: any; color: string; badgeVariant: "default" | "secondary" | "outline" }> = {
    social_site: {
      label: resolveTypeLabel("social_site"),
      icon: Share2,
      color: "bg-blue-50 border-blue-200",
      badgeVariant: "default",
    },
    web2_site: {
      label: resolveTypeLabel("web2_site"),
      icon: Globe,
      color: "bg-green-50 border-green-200",
      badgeVariant: "secondary",
    },
    other_asset: {
      label: resolveTypeLabel("other_asset"),
      icon: FileText,
      color: "bg-purple-50 border-purple-200",
      badgeVariant: "outline",
    },
  }

  const displayTypes =
    assetTypes.length > 0
      ? Array.from(
          new Set([...assetTypes.map((t) => t.slug), ...Object.keys(groupedAssets)])
        )
      : Object.keys(assetTypeConfig)

  const renderAssetGroup = (type: string, assets: typeof template.sitesAssets) => {
    const config =
      assetTypeConfig[type] || {
        label: resolveTypeLabel(type),
        icon: FileText,
        color: "bg-gray-50 border-gray-200",
        badgeVariant: "outline" as const,
      }
    const IconComponent = config.icon

    return (
      <Card key={type} className={`${config.color}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconComponent className="h-5 w-5" />
            {config.label}
            <Badge variant={config.badgeVariant} className="ml-auto">
              {assets.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length > 0 ? (
            <div className="border rounded-lg bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Required</TableHead>
                    {editing && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset, index) => (
                    <TableRow key={"id" in asset ? asset.id : `new-${index}`}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>
                        {asset.url ? (
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {asset.url.length > 30 ? `${asset.url.substring(0, 30)}...` : asset.url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">No URL</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {asset.isRequired ? (
                          <Badge variant="default" className="bg-amber-800 text-white">Required</Badge>
                        ) : (
                          <Badge variant="outline">Optional</Badge>
                        )}
                      </TableCell>
                      {editing && "id" in asset && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="h-8 w-8"
                          >
                            <Trash className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground bg-white rounded-lg border">
              <IconComponent className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No {config.label.toLowerCase()} found</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">Template Details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : template ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
              <div className="lg:col-span-2 space-y-6">
                {/* Template Basic Info */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold">Basic Information</h3>
                    <span className="text-lg font-normal">
                      {editing ? "Edit Template" : "Template Details"}
                      {template && !editing && <span className="ml-2">- {template.name}</span>}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Template Name</Label>
                      {editing ? (
                        <Input
                          id="name"
                          value={template.name}
                          onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                        />
                      ) : (
                        <div className="text-sm py-2 px-3 border rounded-md bg-muted/50">{template.name}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      {editing ? (
                        <Select
                          value={template.status || "active"}
                          onValueChange={(value) => setTemplate({ ...template, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm py-2 px-3 border rounded-md bg-muted/50">
                          <Badge
                            variant="outline"
                            className={
                              template.status === 'active'
                                ? 'text-green-600 border-green-600 bg-green-100'
                                : 'text-red-600 border-red-600 bg-red-100'
                            }
                          >
                            {template.status || 'active'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    {editing ? (
                      <Textarea
                        id="description"
                        value={template.description || ""}
                        onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                        rows={3}
                      />
                    ) : (
                      <div className="text-sm py-2 px-3 border rounded-md min-h-[80px] bg-muted/50">
                        {template.description || "No description"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Site Assets - Grouped by Type */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Site Assets ({template.sitesAssets.length})</h3>
                    <div className="flex gap-2">
                      {displayTypes.map((type) => {
                        const config =
                          assetTypeConfig[type] || {
                            label: resolveTypeLabel(type),
                            badgeVariant: "outline" as const,
                          }
                        const count = groupedAssets[type as string]?.length || 0
                        return (
                          <Badge key={type} variant={config.badgeVariant} className="text-xs bg-amber-700 text-white">
                            {config.label}: {count}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {displayTypes.map((type) => {
                      const assets = groupedAssets[type as string] || []
                      return renderAssetGroup(type as string, assets)
                    })}
                  </div>
                </div>
              </div>

              {/* Add New Asset Panel (only in edit mode) */}
              {editing && (
                <div className="space-y-6">
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                    <h3 className="font-medium flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      Add New Asset
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="asset-type">Type</Label>
                        <Select
                          value={newAsset.type}
                          onValueChange={(value: string) => setNewAsset({ ...newAsset, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset type" />
                          </SelectTrigger>
                          <SelectContent>
                            {(assetTypes.length ? assetTypes : [
                              { slug: "social_site", label: "Social Site" },
                              { slug: "web2_site", label: "Web 2.0 Site" },
                              { slug: "other_asset", label: "Other Asset" },
                            ]).map((type) => (
                              <SelectItem key={type.slug} value={type.slug}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asset-name">Name *</Label>
                        <Input
                          id="asset-name"
                          value={newAsset.name}
                          onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                          placeholder="Enter asset name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asset-url">URL</Label>
                        <Input
                          id="asset-url"
                          value={newAsset.url}
                          onChange={(e) => setNewAsset({ ...newAsset, url: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asset-description">Description</Label>
                        <Input
                          id="asset-description"
                          value={newAsset.description}
                          onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                          placeholder="Brief description"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="asset-required"
                          checked={newAsset.isRequired}
                          onChange={(e) =>
                            setNewAsset({ ...newAsset, isRequired: e.target.checked })
                          }
                        />
                        <Label htmlFor="asset-required">Required</Label>
                      </div>
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white hover:text-white" onClick={handleAddAsset} disabled={!newAsset.name}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Asset
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Template not found</div>
          )}
        </ScrollArea>
        <DialogFooter>
          <div className="flex items-center space-x-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel} className="bg-red-600 hover:bg-red-700 text-white hover:text-white">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white hover:text-white">
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEditing(true)} className="bg-green-600 hover:bg-green-700 text-white hover:text-white">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// @ts-nocheck
