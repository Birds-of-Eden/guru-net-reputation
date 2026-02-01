import prisma from "@/lib/prisma";
import {
  formatAssetTypeLabel,
  normalizeAssetTypeSlug,
} from "@/lib/asset-types";

export type AssetTypeRecord = {
  id: string;
  slug: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  categoryName: string | null;
};

export async function fetchAssetTypes(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  const assetTypes = await prisma.assetType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true,
      slug: true,
      label: true,
      isActive: true,
      sortOrder: true,
      categoryName: true,
    },
  });

  return assetTypes;
}

export async function fetchAssetTypeMap(options?: { includeInactive?: boolean }) {
  const list = await fetchAssetTypes(options);
  return new Map(list.map((t) => [t.slug, t]));
}

export async function fetchActiveAssetTypeSlugs() {
  const list = await fetchAssetTypes();
  return list.map((t) => t.slug);
}

export function normalizeAssetTypeList(values: Array<string | null | undefined>) {
  return values
    .map((v) => normalizeAssetTypeSlug(String(v ?? "")))
    .filter(Boolean);
}

export function resolveCategoryName(
  slug: string,
  assetTypeMap: Map<string, AssetTypeRecord>,
  fallbackMap: Record<string, string>,
  fallbackName = "Other Task"
) {
  const normalized = normalizeAssetTypeSlug(slug);
  const fromDb = assetTypeMap.get(normalized)?.categoryName;
  if (fromDb) return fromDb;
  if (fallbackMap[normalized]) return fallbackMap[normalized];
  return fallbackName;
}

export function resolveCategoryFromMap(
  slug: string,
  overrides: Record<string, string>,
  assetTypeMap: Map<string, AssetTypeRecord>,
  fallbackMap: Record<string, string>,
  fallbackName = "Other Task"
) {
  const normalized = normalizeAssetTypeSlug(slug);
  if (!normalized) return fallbackName;
  if (overrides[normalized]) return overrides[normalized];
  const fromDb = assetTypeMap.get(normalized)?.categoryName;
  if (fromDb) return fromDb;
  if (fallbackMap[normalized]) return fallbackMap[normalized];
  return fallbackName;
}

export function resolveAssetTypeLabel(
  slug: string,
  assetTypeMap: Map<string, AssetTypeRecord>
) {
  const normalized = normalizeAssetTypeSlug(slug);
  const fromDb = assetTypeMap.get(normalized)?.label;
  if (fromDb) return fromDb;
  return formatAssetTypeLabel(normalized);
}
