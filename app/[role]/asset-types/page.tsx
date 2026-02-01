"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasPermissionClient } from "@/lib/permissions-client";
import {
  formatAssetTypeLabel,
  normalizeAssetTypeSlug,
  slugifyAssetType,
} from "@/lib/asset-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";

type AssetType = {
  id: string;
  slug: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  categoryName: string | null;
};

type FormState = {
  label: string;
  slug: string;
  categoryName: string;
  sortOrder: string;
  isActive: boolean;
};

const PERMISSION_ID = "asset_type_manage";

export default function AssetTypesPage() {
  const { user } = useAuth();
  const canManage = hasPermissionClient(user?.permissions, PERMISSION_ID);

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AssetType | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const [form, setForm] = useState<FormState>({
    label: "",
    slug: "",
    categoryName: "",
    sortOrder: "0",
    isActive: true,
  });

  const fetchAssetTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/asset-types?includeInactive=1", {
        cache: "no-store",
      });
      const data = await res.json();
      setAssetTypes(Array.isArray(data?.assetTypes) ? data.assetTypes : []);
    } catch (err) {
      console.error("Failed to load asset types:", err);
      toast.error("Failed to load asset types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetTypes();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assetTypes
      .filter((t) => {
        if (filter === "active" && !t.isActive) return false;
        if (filter === "inactive" && t.isActive) return false;
        if (!q) return true;
        return (
          t.label.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.categoryName ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const order =
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.label.localeCompare(b.label);
        return order;
      });
  }, [assetTypes, filter, search]);

  const openCreate = () => {
    setEditing(null);
    setSlugTouched(false);
    setForm({
      label: "",
      slug: "",
      categoryName: "",
      sortOrder: "0",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (item: AssetType) => {
    setEditing(item);
    setSlugTouched(true);
    setForm({
      label: item.label,
      slug: item.slug,
      categoryName: item.categoryName ?? "",
      sortOrder: String(item.sortOrder ?? 0),
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("You do not have permission to manage asset types");
      return;
    }
    const label = form.label.trim();
    if (!label) {
      toast.error("Label is required");
      return;
    }

    const slugRaw = form.slug.trim() || label;
    const slug = normalizeAssetTypeSlug(slugifyAssetType(slugRaw));

    const payload = {
      slug,
      label,
      categoryName: form.categoryName.trim() || null,
      sortOrder: Number.isFinite(Number(form.sortOrder))
        ? Number(form.sortOrder)
        : 0,
      isActive: form.isActive,
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user?.id) headers["x-actor-id"] = String(user.id);

      const res = await fetch("/api/asset-types", {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editing ? { ...payload, slug: editing.slug } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to save asset type");
      }
      toast.success(editing ? "Asset type updated" : "Asset type created");
      setDialogOpen(false);
      await fetchAssetTypes();
    } catch (err: any) {
      console.error("Save asset type error:", err);
      toast.error(err?.message || "Failed to save asset type");
    }
  };

  const toggleActive = async (item: AssetType) => {
    if (!canManage) {
      toast.error("You do not have permission to manage asset types");
      return;
    }
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user?.id) headers["x-actor-id"] = String(user.id);

      if (item.isActive) {
        const ok = window.confirm(
          `Disable "${item.label}"? It will be hidden from selection.`
        );
        if (!ok) return;
        const res = await fetch(
          `/api/asset-types?slug=${encodeURIComponent(item.slug)}`,
          { method: "DELETE", headers }
        );
        if (!res.ok) throw new Error("Failed to disable asset type");
      } else {
        const res = await fetch("/api/asset-types", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ slug: item.slug, isActive: true }),
        });
        if (!res.ok) throw new Error("Failed to enable asset type");
      }

      await fetchAssetTypes();
    } catch (err) {
      console.error("Toggle asset type error:", err);
      toast.error("Failed to update asset type");
    }
  };

  if (!canManage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border bg-white p-6">
          <h1 className="text-2xl font-bold">Asset Types</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to manage asset types.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Asset Types
            </h1>
            <p className="text-sm text-muted-foreground">
              Create, edit, and disable asset types from one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchAssetTypes}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white hover:text-white"
              onClick={openCreate}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Asset Type
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by label, slug, or category..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              onClick={() => setFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={filter === "inactive" ? "default" : "outline"}
              onClick={() => setFilter("inactive")}
            >
              Inactive
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Sort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length ? (
                filtered.map((item) => (
                  <TableRow key={item.slug}>
                    <TableCell className="font-medium">
                      {item.label || formatAssetTypeLabel(item.slug)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.slug}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.categoryName || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.sortOrder ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.isActive ? "default" : "secondary"}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={item.isActive ? "destructive" : "outline"}
                          onClick={() => toggleActive(item)}
                        >
                          {item.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    No asset types found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Asset Type" : "New Asset Type"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Label *</label>
              <Input
                value={form.label}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) => {
                    const next = { ...prev, label: value };
                    if (!slugTouched && !editing) {
                      next.slug = slugifyAssetType(value);
                    }
                    return next;
                  });
                }}
                placeholder="e.g. Social Sites"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
                placeholder="auto-generated if empty"
                disabled={!!editing}
              />
              {editing && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug updates are disabled to avoid breaking links.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={form.categoryName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, categoryName: e.target.value }))
                }
                placeholder="e.g. Social Asset Creation"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Sort Order</label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">
                  Active types show up in selections.
                </div>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
