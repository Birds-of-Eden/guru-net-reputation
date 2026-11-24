// lib/posting-schedule.ts
// Server-side posting cycle helpers. Pure logic lives in ./posting-cycle (client-safe).
import prisma from "@/lib/prisma";
import {
  EVERY_MONTH,
  getPostingFrequency,
  POSTING_INTERVAL_FIELD,
  POSTING_OFFSET_FIELD,
  SETTING_INTERVAL_FIELD,
  SETTING_OFFSET_FIELD,
  resolvePostingCycle,
  type PostingCycle,
} from "./posting-cycle";

export * from "./posting-cycle";

/**
 * Loads cycles for many template assets in one query (+ optional per-assignment
 * overrides). Missing ids resolve to EVERY_MONTH.
 */
export async function loadPostingCycles(
  templateSiteAssetIds: Array<number | null | undefined>,
  assignmentId?: string | null
): Promise<Map<number, PostingCycle>> {
  const ids = Array.from(
    new Set(templateSiteAssetIds.filter((id): id is number => typeof id === "number"))
  );
  const map = new Map<number, PostingCycle>();
  if (!ids.length) return map;

  const [assets, settings] = await Promise.all([
    prisma.templateSiteAsset.findMany({
      where: { id: { in: ids } },
      select: { id: true, [POSTING_INTERVAL_FIELD]: true, [POSTING_OFFSET_FIELD]: true } as any,
    }),
    assignmentId
      ? prisma.assignmentSiteAssetSetting.findMany({
          where: { assignmentId, templateSiteAssetId: { in: ids } },
          select: {
            templateSiteAssetId: true,
            [SETTING_INTERVAL_FIELD]: true,
            [SETTING_OFFSET_FIELD]: true,
          } as any,
        })
      : Promise.resolve([] as any[]),
  ]);

  const settingById = new Map<number, any>(
    (settings as any[]).map((s) => [s.templateSiteAssetId, s])
  );
  for (const a of assets as any[]) {
    map.set(a.id, resolvePostingCycle(a, settingById.get(a.id)));
  }
  return map;
}

/**
 * Per-client Posts/Month overrides (AssignmentSiteAssetSetting.requiredFrequency).
 * Use with `postsPerMonth(map, assetId, defaultFreq)`.
 */
export async function loadRequiredFrequencies(
  templateSiteAssetIds: Array<number | null | undefined>,
  assignmentId?: string | null
): Promise<Map<number, number | null>> {
  const ids = Array.from(
    new Set(templateSiteAssetIds.filter((id): id is number => typeof id === "number"))
  );
  const map = new Map<number, number | null>();
  if (!ids.length || !assignmentId) return map;
  const rows = await prisma.assignmentSiteAssetSetting.findMany({
    where: { assignmentId, templateSiteAssetId: { in: ids } },
    select: { templateSiteAssetId: true, requiredFrequency: true },
  });
  for (const r of rows) map.set(r.templateSiteAssetId, r.requiredFrequency);
  return map;
}

/** Effective Posts/Month: per-client override first, then the template default. */
export function postsPerMonth(
  required: Map<number, number | null>,
  assetId: number | null | undefined,
  defaultFreq: number | null | undefined
): number {
  const r = typeof assetId === "number" ? required.get(assetId) : undefined;
  return getPostingFrequency({ required: r, defaultFreq });
}

/** Highest "-N" suffix among existing task names for one base name. */
export function maxSeqForBase(names: string[], base: string): number {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*(\\d+)\\s*$`);
  let max = 0;
  for (const n of names) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

export function cycleFor(
  map: Map<number, PostingCycle>,
  assetId: number | null | undefined
): PostingCycle {
  return (typeof assetId === "number" && map.get(assetId)) || EVERY_MONTH;
}
