export const TEMPLATE_STATUSES = [
  "draft",
  "requested",
  "approved",
  "rejected",
] as const;

export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export function isTemplateStatus(value: unknown): value is TemplateStatus {
  return TEMPLATE_STATUSES.includes(String(value) as TemplateStatus);
}

export function normalizeTemplateStatus(
  value: unknown,
  fallback: TemplateStatus = "draft",
): TemplateStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "active") return "approved";
  if (normalized === "inactive") return "draft";
  return isTemplateStatus(normalized) ? normalized : fallback;
}

export function isApprovedTemplateStatus(value: unknown): boolean {
  return normalizeTemplateStatus(value, "draft") === "approved";
}

export function getTemplateStatusLabel(value: unknown): string {
  const status = normalizeTemplateStatus(value, "draft");
  switch (status) {
    case "draft":
      return "Draft";
    case "requested":
      return "Requested";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
  }
}
