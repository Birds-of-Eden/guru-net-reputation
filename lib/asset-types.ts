export type AssetTypeSeed = {
  slug: string;
  label: string;
  sortOrder: number;
  categoryName?: string | null;
  isActive?: boolean;
};

export const DEFAULT_ASSET_TYPES: AssetTypeSeed[] = [
  {
    slug: "social_site",
    label: "Social Sites",
    categoryName: "Social Asset Creation",
    sortOrder: 10,
  },
  {
    slug: "web2_site",
    label: "Web 2.0 Sites",
    categoryName: "Web 2.0 Asset Creation",
    sortOrder: 20,
  },
  {
    slug: "other_asset",
    label: "Additional Sites",
    categoryName: "Additional Asset Creation",
    sortOrder: 30,
  },
  {
    slug: "graphics_design",
    label: "Graphics Design",
    categoryName: "Graphics Design",
    sortOrder: 40,
  },
  {
    slug: "image_optimization",
    label: "Image Optimization",
    categoryName: "Image Optimization",
    sortOrder: 50,
  },
  {
    slug: "content_studio",
    label: "Content Studio",
    categoryName: "Content Studio",
    sortOrder: 60,
  },
  {
    slug: "content_writing",
    label: "Content Writing",
    categoryName: "Content Writing",
    sortOrder: 70,
  },
  {
    slug: "backlinks",
    label: "Backlinks",
    categoryName: "Backlinks",
    sortOrder: 80,
  },
  {
    slug: "completed_com",
    label: "Completed.com",
    categoryName: "Completed Communication",
    sortOrder: 90,
  },
  {
    slug: "youtube_video_optimization",
    label: "YouTube Optimization",
    categoryName: "YouTube Video Optimization",
    sortOrder: 100,
  },
  {
    slug: "monitoring",
    label: "Monitoring",
    categoryName: "Monitoring",
    sortOrder: 110,
  },
  {
    slug: "review_removal",
    label: "Review Removal",
    categoryName: "Review Removal",
    sortOrder: 120,
  },
  {
    slug: "summary_report",
    label: "Summary Report",
    categoryName: "Summary Report",
    sortOrder: 130,
  },
  {
    slug: "guest_posting",
    label: "Guest Posting",
    categoryName: "Guest Posting",
    sortOrder: 140,
  },
];

const DEFAULT_LABEL_BY_SLUG = DEFAULT_ASSET_TYPES.reduce<Record<string, string>>(
  (acc, t) => {
    acc[t.slug] = t.label;
    return acc;
  },
  {}
);

const DEFAULT_CATEGORY_BY_SLUG = DEFAULT_ASSET_TYPES.reduce<
  Record<string, string>
>((acc, t) => {
  if (t.categoryName) acc[t.slug] = t.categoryName;
  return acc;
}, {});

export function getDefaultCategoryBySlug(): Record<string, string> {
  return { ...DEFAULT_CATEGORY_BY_SLUG };
}

export function normalizeAssetTypeSlug(input: string): string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "additional_site") return "other_asset";
  return raw;
}

export function slugifyAssetType(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function formatAssetTypeLabel(slug: string): string {
  const key = normalizeAssetTypeSlug(slug);
  if (DEFAULT_LABEL_BY_SLUG[key]) return DEFAULT_LABEL_BY_SLUG[key];
  if (!key) return "Unknown";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
