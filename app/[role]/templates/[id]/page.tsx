// src/app/templates/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { AssetTypeOption } from '@/types/asset-types'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  description?: string
  packageId?: string
  status?: string
  sitesAssets: {
    id: number
    type: string
    name: string
    url?: string
    description?: string
    isRequired: boolean
    defaultPostingFrequency?: number
    defaultIdealDurationMinutes?: number
    defaultIdealDurationMinutesForPosting?: number
  }[]
}

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])
  const [newAsset, setNewAsset] = useState({
    type: 'social_site' as string,
    name: '',
    url: '',
    description: '',
    isRequired: false,
    defaultPostingFrequency: undefined as number | undefined,
    defaultIdealDurationMinutes: undefined as number | undefined,
  })
  const router = useRouter()

  useEffect(() => {
    let active = true
    Promise.resolve(params).then((resolved) => {
      if (active) setTemplateId(resolved.id)
    })
    return () => {
      active = false
    }
  }, [params])

  useEffect(() => {
    if (!templateId) return
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/templates/${templateId}`)
        const data = await response.json()
        setTemplate(data)
      } catch (error) {
        console.error('Error fetching template:', error)
        toast('Failed to load template')
      } finally {
        setLoading(false)
      }
    }
    
    fetchTemplate()
  }, [templateId, toast])

  useEffect(() => {
    const fetchAssetTypes = async () => {
      try {
        const res = await fetch('/api/asset-types')
        const data = await res.json()
        setAssetTypes(Array.isArray(data?.assetTypes) ? data.assetTypes : [])
      } catch (error) {
        console.error('Error fetching asset types:', error)
      }
    }
    fetchAssetTypes()
  }, [])

  const handleSave = async () => {
    if (!template || !templateId) return
    
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
      toast('Template updated successfully')
    } catch (error) {
      console.error('Error updating template:', error)
      toast('Failed to update template')
    }
  }

  const handleAddAsset = async () => {
    if (!newAsset.name || !template || !templateId) return
    
    try {
      const response = await fetch(`/api/templates/${templateId}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAsset),
      })
      
      const createdAsset = await response.json()
      setTemplate({
        ...template,
        sitesAssets: [...template.sitesAssets, createdAsset],
      })
      setNewAsset({
        type: 'social_site',
        name: '',
        url: '',
        description: '',
        isRequired: false,
        defaultPostingFrequency: undefined,
        defaultIdealDurationMinutes: undefined,
      })
      toast('Asset added successfully')
    } catch (error) {
      console.error('Error adding asset:', error)
      toast('Failed to add asset')
    }
  }

  const handleDeleteAsset = async (assetId: number) => {
    if (!confirm('Are you sure you want to delete this asset?')) return
    
    try {
      if (!templateId) return
      await fetch(`/api/templates/${templateId}/assets/${assetId}`, {
        method: 'DELETE',
      })
      
      if (template) {
        setTemplate({
          ...template,
          sitesAssets: template.sitesAssets.filter(asset => asset.id !== assetId),
        })
      }
      toast('Asset deleted successfully')
    } catch (error) {
      console.error('Error deleting asset:', error)
      toast('Failed to delete asset')
    }
  }

  if (loading) {
    return <div className="container mx-auto py-8">Loading...</div>
  }

  if (!template) {
    return <div className="container mx-auto py-8">Template not found</div>
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold ml-2">
          {editing ? 'Edit Template' : template.name}
        </h1>
        <div className="ml-auto flex space-x-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                {editing ? (
                  <Input
                    id="name"
                    value={template.name}
                    onChange={(e) =>
                      setTemplate({ ...template, name: e.target.value })
                    }
                  />
                ) : (
                  <div className="text-sm py-2 px-3 border rounded-md">
                    {template.name}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {editing ? (
                  <Select
                    value={template.status || 'active'}
                    onValueChange={(value) =>
                      setTemplate({ ...template, status: value })
                    }
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
                  <div className="text-sm py-2 px-3 border rounded-md">
                    {template.status || 'active'}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {editing ? (
                <Textarea
                  id="description"
                  value={template.description || ''}
                  onChange={(e) =>
                    setTemplate({ ...template, description: e.target.value })
                  }
                />
              ) : (
                <div className="text-sm py-2 px-3 border rounded-md min-h-[80px]">
                  {template.description || 'No description'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Site Assets</h2>
              {editing && (
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Posts/Month</TableHead>
                  <TableHead>Duration (min)</TableHead>
                  <TableHead>Posting Duration (min)</TableHead>
                  {editing && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {template.sitesAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {asset.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>
                      {asset.url ? (
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {asset.url}
                        </a>
                      ) : (
                        'No URL'
                      )}
                    </TableCell>
                    <TableCell>
                      {asset.isRequired ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input
                          type="number"
                          min={0}
                          value={asset.defaultPostingFrequency ?? 0}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              sitesAssets: template.sitesAssets.map((a) =>
                                a.id === asset.id
                                  ? {
                                      ...a,
                                      defaultPostingFrequency: Math.max(
                                        0,
                                        Number.parseInt(e.target.value, 10) || 0
                                      ),
                                    }
                                  : a
                              ),
                            })
                          }
                        />
                      ) : (
                        asset.defaultPostingFrequency ?? 0
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input
                          type="number"
                          min={1}
                          value={asset.defaultIdealDurationMinutes ?? 30}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              sitesAssets: template.sitesAssets.map((a) =>
                                a.id === asset.id
                                  ? {
                                      ...a,
                                      defaultIdealDurationMinutes: Math.max(
                                        1,
                                        Number.parseInt(e.target.value, 10) || 1
                                      ),
                                    }
                                  : a
                              ),
                            })
                          }
                        />
                      ) : (
                        `${asset.defaultIdealDurationMinutes ?? 30}`
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input
                          type="number"
                          min={1}
                          value={asset.defaultIdealDurationMinutesForPosting ?? 30}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              sitesAssets: template.sitesAssets.map((a) =>
                                a.id === asset.id
                                  ? {
                                      ...a,
                                      defaultIdealDurationMinutesForPosting: Math.max(
                                        1,
                                        Number.parseInt(e.target.value, 10) || 1
                                      ),
                                    }
                                  : a
                              ),
                            })
                          }
                        />
                      ) : (
                        `${asset.defaultIdealDurationMinutesForPosting ?? 30}`
                      )}
                    </TableCell>
                    {editing && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAsset(asset.id)}
                        >
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {template.sitesAssets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={editing ? 8 : 7} className="h-24 text-center">
                      No assets found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {editing && (
          <div className="space-y-6">
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-medium">Add New Asset</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="asset-type">Type</Label>
                  <Select
                    value={newAsset.type}
                    onValueChange={(value: string) =>
                      setNewAsset({ ...newAsset, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assetTypes.length
                        ? assetTypes
                        : [
                            { slug: 'social_site', label: 'Social Site' },
                            { slug: 'web2_site', label: 'Web 2.0 Site' },
                            { slug: 'other_asset', label: 'Other Asset' },
                          ]
                      ).map((type) => (
                        <SelectItem key={type.slug} value={type.slug}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-name">Name</Label>
                  <Input
                    id="asset-name"
                    value={newAsset.name}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-url">URL (optional)</Label>
                  <Input
                    id="asset-url"
                    value={newAsset.url}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, url: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-description">Description (optional)</Label>
                  <Input
                    id="asset-description"
                    value={newAsset.description}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, description: e.target.value })
                    }
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
                <Button
                  className="w-full"
                  onClick={handleAddAsset}
                  disabled={!newAsset.name}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
