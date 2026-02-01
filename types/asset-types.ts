export type AssetTypeSlug = string;

export interface AssetTypeOption {
  id: string;
  slug: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  categoryName?: string | null;
}
